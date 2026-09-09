import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
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

export function createStaticHandler({ development = false } = {}) {
  // Index only regular public files. Request paths never become filesystem paths.
  const files = new Map();
  function index(directory, prefix = '') {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      const path = join(directory, entry.name);
      const url = `${prefix}/${entry.name}`;
      if (entry.isDirectory()) index(path, url);
      else if (entry.isFile() && types[extname(entry.name)]) {
        const content = readFileSync(path);
        files.set(url, {
          content,
          type: types[extname(entry.name)],
          etag: `"${createHash('sha256').update(content).digest('base64url')}"`,
          html: extname(entry.name) === '.html',
        });
      }
    }
  }
  index(fileURLToPath(new URL('../public/', import.meta.url)));
  files.set('/', files.get('/index.html'));
  return async (req, res, pathname) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return false;
    const file = files.get(pathname);
    if (!file) return false;
    if (req.headers['if-none-match'] === file.etag) {
      res.writeHead(304, { ETag: file.etag });
      res.end();
      return true;
    }
    res.writeHead(200, {
      'Content-Type': file.type,
      'Content-Length': file.content.length,
      'Cache-Control': development || file.html ? 'no-cache' : 'public, max-age=3600',
      'ETag': file.etag,
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(req.method === 'HEAD' ? undefined : file.content);
    return true;
  };
}
