"""
Trains the ClimateTwin AI surrogate model.

The surrogate is a small neural network (scikit-learn MLPRegressor) that learns to approximate the
physics-based simulation engine (src/engine.js). It is trained on engine outputs, NOT on field
measurements. Its job is to screen thousands of candidate plans instantly inside the optimizer.

Usage:  python3 ml/train_surrogate.py            (reads data/surrogate_dataset.csv and surrogate_meta.json)
Output: data/surrogate_model.json  (weights, scalers, metrics, importances) loaded directly by the web app.
"""
import json, os, datetime
import numpy as np, pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.neural_network import MLPRegressor
from sklearn.metrics import r2_score, mean_absolute_error

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, '..', 'data')
df = pd.read_csv(os.path.join(DATA, 'surrogate_dataset.csv'))
meta = json.load(open(os.path.join(DATA, 'surrogate_meta.json')))

FEATURES = ['solarCanopy', 'treesPaved', 'depavePerm', 'depaveLawn', 'treesLawn', 'coolRoof', 'greenRoof', 'rwhTank', 'ambientC', 'stormMm']  # last two are CLIMATE inputs
TARGETS = ['surfTemp', 'runoff', 'netKwh', 'irrig']
X = df[FEATURES].values
Y = df[TARGETS].values

# 70 % train / 15 % validation / 15 % test, fixed seed
X_tmp, X_te, Y_tmp, Y_te = train_test_split(X, Y, test_size=0.15, random_state=42)
X_tr, X_va, Y_tr, Y_va = train_test_split(X_tmp, Y_tmp, test_size=0.1765, random_state=42)

sx, sy = StandardScaler().fit(X_tr), StandardScaler().fit(Y_tr)
model = MLPRegressor(hidden_layer_sizes=(32, 32), activation='relu', solver='adam', learning_rate_init=0.003,
                     max_iter=800, early_stopping=False, tol=1e-6, n_iter_no_change=40, random_state=42)
model.fit(sx.transform(X_tr), sy.transform(Y_tr))

def predict(Xr):
    return sy.inverse_transform(model.predict(sx.transform(Xr)))

P_te, P_va = predict(X_te), predict(X_va)
metrics = {}
for i, t in enumerate(TARGETS):
    metrics[t] = {
        'r2_test': round(float(r2_score(Y_te[:, i], P_te[:, i])), 5),
        'mae_test': round(float(mean_absolute_error(Y_te[:, i], P_te[:, i])), 4),
        'mape_test_pct': round(float(np.mean(np.abs(P_te[:, i] - Y_te[:, i]) / np.abs(Y_te[:, i])) * 100), 4),
        'r2_val': round(float(r2_score(Y_va[:, i], P_va[:, i])), 5),
        'min_test': round(float(Y_te[:, i].min()), 3),
        'max_test': round(float(Y_te[:, i].max()), 3),
    }

# Permutation importance (test split): drop in mean standardized R2 when one feature is shuffled
rng = np.random.default_rng(0)

# Extrapolation check: train a second network ONLY on ambient <= 41 C and storm <= 110 mm, then test it on the
# hotter / wetter rows it never saw. Tells the user how far outside its training range the surrogate can be trusted.
amb, stm = df['ambientC'].values, df['stormMm'].values
inside = (amb <= 41) & (stm <= 110)
Xi, Yi = X[inside], Y[inside]
Xo, Yo = X[~inside], Y[~inside]
sx2, sy2 = StandardScaler().fit(Xi), StandardScaler().fit(Yi)
m2 = MLPRegressor(hidden_layer_sizes=(32, 32), activation='relu', solver='adam', learning_rate_init=0.003,
                  max_iter=800, tol=1e-6, n_iter_no_change=40, random_state=42).fit(sx2.transform(Xi), sy2.transform(Yi))
Po = sy2.inverse_transform(m2.predict(sx2.transform(Xo)))
extrap = {TARGETS[i]: {'r2': round(float(r2_score(Yo[:, i], Po[:, i])), 4), 'mape_pct': round(float(np.mean(np.abs(Po[:, i] - Yo[:, i]) / np.abs(Yo[:, i])) * 100), 3)} for i in range(len(TARGETS))}
extrap['rows_unseen'] = int((~inside).sum())
Ysc = sy.transform(Y_te)
def mean_r2(Xr):
    P = model.predict(sx.transform(Xr))
    return float(np.mean([r2_score(Ysc[:, j], P[:, j]) for j in range(Ysc.shape[1])]))
base_r2 = mean_r2(X_te)
importance = {}
for j, f in enumerate(FEATURES):
    drops = []
    for _ in range(5):
        Xp = X_te.copy(); Xp[:, j] = rng.permutation(Xp[:, j])
        drops.append(base_r2 - mean_r2(Xp))
    importance[f] = round(float(np.mean(drops)), 5)
tot = sum(max(v, 0) for v in importance.values()) or 1
importance_share = {k: round(max(v, 0) / tot, 4) for k, v in importance.items()}

def rnd(a, d=6): return np.round(np.asarray(a, dtype=float), d).tolist()
out = {
    'type': 'MLPRegressor (scikit-learn), ReLU, hidden layers (32, 32)',
    'trainedOn': 'Outputs of the ClimateTwin physics-based simulation engine run over varied plans AND varied climate (air temperature 30-45 C, design storm 30-150 mm). Not field measurements.',
    'trainedDate': datetime.date.today().isoformat(),
    'stateKey': meta['stateKey'],
    'baseline': meta['baseline'],
    'features': FEATURES,
    'targets': TARGETS,
    'nSamples': int(len(df)),
    'split': {'train': int(len(X_tr)), 'validation': int(len(X_va)), 'test': int(len(X_te)), 'seed': 42},
    'metrics': metrics,
    'importance': importance_share,
    'extrapolation': extrap,
    'climateRange': {'ambientC': [float(amb.min()), float(amb.max())], 'stormMm': [float(stm.min()), float(stm.max())]},
    'xMean': rnd(sx.mean_), 'xScale': rnd(sx.scale_),
    'yMean': rnd(sy.mean_), 'yScale': rnd(sy.scale_),
    'layers': [{'W': rnd(w, 5), 'b': rnd(b, 5)} for w, b in zip(model.coefs_, model.intercepts_)],
    'iterations': int(model.n_iter_),
}
json.dump(out, open(os.path.join(DATA, 'surrogate_model.json'), 'w'), separators=(',', ':'))

# Reference predictions so the JavaScript implementation can be checked against sklearn
idx = rng.choice(len(X_te), 200, replace=False)
json.dump({'X': rnd(X_te[idx], 4), 'P': rnd(P_te[idx], 4)}, open(os.path.join(DATA, 'surrogate_parity.json'), 'w'))

print('samples', len(df), 'iterations', model.n_iter_)
for t, m in metrics.items():
    print(f"{t:9s} R2(test)={m['r2_test']:.4f}  MAE={m['mae_test']}  MAPE={m['mape_test_pct']}%  range=[{m['min_test']}, {m['max_test']}]")
print('importance share', importance_share)
print('extrapolation (unseen hot/wet rows)', extrap)
print('model json bytes', os.path.getsize(os.path.join(DATA, 'surrogate_model.json')))
