import { readdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
};

export function createStaticHandler() {
  // Index only regular public files. Request paths never become filesystem paths.
  const files = new Map();
  function index(directory, prefix = '') {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      const path = join(directory, entry.name);
      const url = `${prefix}/${entry.name}`;
      if (entry.isDirectory()) index(path, url);
      else if (entry.isFile() && types[extname(entry.name)]) files.set(url, path);
    }
  }
  index(fileURLToPath(new URL('../public/', import.meta.url)));
  files.set('/', files.get('/index.html'));
  return async (req, res, pathname) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return false;
    const path = files.get(pathname);
    if (!path) return false;
    const content = await readFile(path);
    res.writeHead(200, {
      'Content-Type': types[extname(path)],
      'Content-Length': content.length,
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(req.method === 'HEAD' ? undefined : content);
    return true;
  };
}
