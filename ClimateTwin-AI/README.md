# ClimateTwin AI

Single-file website: `dist/index.html` (no server, no build needed to run it).

## Deploy to Netlify (your existing site)
1. Open https://app.netlify.com -> your site `climate-twin-ai` -> Deploys.
2. Drag the `dist` folder onto the deploy box. Done.

## Rebuild after editing source
    node build.js          # writes dist/index.html
    node test_engine.js    # engine tests
    node test_surrogate.js # AI surrogate vs engine checks (fresh plans AND fresh climate)
    node test_realism.js   # hand-calculated checks: trees, permeable paving, cool roof, solar, carbon

## Retrain the AI surrogate
    node ml/generate_dataset.js
    python3 ml/train_surrogate.py

## Honest status (say this to judges)
- Zone areas and baseline cooling electricity are ILLUSTRATIVE placeholders for PCCOE. Replace them in the app (Digital Twin -> Edit zone) with surveyed values.
- Engine = SCS curve-number runoff + area-weighted surface heat + energy/solar/carbon/irrigation formulas.
- Headline numbers = CALCULATED ESTIMATES from documented formulas (not ML).
- ML = neural network trained on engine outputs over varied plans AND climate (air temp 30-45 C, storm 30-150 mm). Used to screen 20,000 plans in the optimizer and shown beside the formulas on Impact Comparison. Held-out and extrapolation accuracy are shown in the app. It imitates the engine; it is not validated against field data.
- Real external data in the app: Pune climate normals only. NASA POWER / ERA5 / Landsat are listed as next steps.
