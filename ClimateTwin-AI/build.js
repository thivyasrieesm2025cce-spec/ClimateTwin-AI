// Inlines everything into ONE self-contained file: dist/index.html  (usage: node build.js)
const fs = require('fs'), path = require('path');
const r = f => fs.readFileSync(path.join(__dirname, f), 'utf8');
const model = JSON.stringify(JSON.parse(r('data/surrogate_model.json')));
const js = ['src/engine.js', 'src/surrogate.js'].map(r).join('\n') +
  '\nwindow.__CT_MODEL__=' + model + ';\n' +
  ['src/a1_core.js', 'src/a2_views.js', 'src/a3_pages.js', 'src/a5_landing.js', 'src/a6_trust.js', 'src/a4_main.js'].filter(f => fs.existsSync(path.join(__dirname, f))).map(r).join('\n');
const head = r('src/head.html');
const html = head.replace('/*__CSS__*/', () => r('src/style.css')).replace('/*__JS__*/', () => js.replace(/<\/script/gi, '<\\/script'));
fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'dist/index.html'), html);
console.log('built dist/index.html', (html.length / 1024).toFixed(0) + ' KB');
