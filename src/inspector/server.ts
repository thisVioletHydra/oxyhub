import fsPromises from 'node:fs/promises';
import http from 'node:http';
import { stripTypeScriptTypes } from 'node:module';
import process from 'node:process';

import { catalog } from './catalog.ts';

const port = Number(process.env.OXYHUB_INSPECTOR_PORT ?? 4174);
const files = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/style.css', ['style.css', 'text/css; charset=utf-8']],
  ['/app.js', ['app.ts', 'text/javascript; charset=utf-8']],
]);

const server = http.createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    if (pathname === '/api/rules') {
      response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify(catalog()));
      return;
    }

    const file = files.get(pathname);
    if (file === undefined) {
      response.writeHead(404);
      response.end('Not found');
      return;
    }

    const [name, type] = file;
    const content = await fsPromises.readFile(new URL(name, import.meta.url), 'utf8');
    response.writeHead(200, { 'Content-Type': type });
    response.end(name === 'app.ts' ? stripTypeScriptTypes(content) : content);
  } catch (error) {
    console.error(error);
    response.writeHead(500);
    response.end('Inspector could not load its catalog. See terminal output.');
  }
});

server.on('error', (error) => {
  console.error(`Inspector: ${error.message}`);
  process.exitCode = 1;
});
server.listen(port, '127.0.0.1', () => {
  console.log(`Oxyhub inspector → http://127.0.0.1:${port}`);
  console.log('Ctrl+C stops the inspector. Restart after changing rule metadata.');
});
process.once('SIGINT', () => server.close());
process.once('SIGTERM', () => server.close());
