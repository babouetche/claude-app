'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname,'..');
let html = fs.readFileSync(path.join(root,'docs/index.html'),'utf8');
html = html.replace('<head>','<head>\n    <base href="./docs/" />');
fs.writeFileSync(path.join(root,'CALCULATEUR.html'),html);
console.log('CALCULATEUR.html ready: double-click to open the local calculator.');
