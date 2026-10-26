/* ClimateTwin AI - surrogate model inference (the trained network is loaded from JSON). Works in browser and Node. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CTSurrogate = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  function predict(model, x) {
    var n = model.features.length, i, j, k;
    var a = new Array(n);
    for (i = 0; i < n; i++) a[i] = (x[i] - model.xMean[i]) / model.xScale[i];
    for (var l = 0; l < model.layers.length; l++) {
      var W = model.layers[l].W, b = model.layers[l].b, out = new Array(b.length);
      for (j = 0; j < b.length; j++) {
        var s = b[j];
        for (k = 0; k < a.length; k++) s += a[k] * W[k][j];
        out[j] = l < model.layers.length - 1 ? (s > 0 ? s : 0) : s;
      }
      a = out;
    }
    var res = {};
    for (j = 0; j < model.targets.length; j++) res[model.targets[j]] = a[j] * model.yScale[j] + model.yMean[j];
    return res;
  }
  return { predict: predict };
});
