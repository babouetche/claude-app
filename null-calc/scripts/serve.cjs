const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../docs');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.gif': 'image/gif', '.svg': 'image/svg+xml' };
function createServer(readFile = (file, callback) => fs.readFile(file, callback)) {
    return http.createServer((req, res) => {
        let file;
        try {
            const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/\/$/, '/index.html');
            file = path.resolve(root, '.' + pathname);
            if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
        } catch { res.writeHead(400).end(); return; }
        readFile(file, (err, data) => {
            if (err) { res.writeHead(404).end(); return; }
            res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
            res.setHeader('Cache-Control', 'no-store');
            res.end(data);
        });
    });
}
module.exports = { createServer, root };
if (require.main === module) {
    const port = Number(process.env.PORT || 8080);
    createServer().listen(port, '127.0.0.1', () => console.log(`Pokémon Null : http://127.0.0.1:${port}`));
}
