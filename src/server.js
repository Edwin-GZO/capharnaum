import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { catalogue, regles } from './catalogue.js';
import { calculerPersonnage, ValidationError } from './personnage.js';
import { createStaticHandler } from './static.js';
import { genererPersonnage } from './aleatoire.js';
import { genererPdf } from './pdf.js';

const versionServeur = `${Date.now()}-${process.pid}`;

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

export function createApp() {
  const serveStatic = createStaticHandler();
  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      if (req.method === 'GET' && url.pathname === '/health') return json(res, 200, { status: 'ok' });
      if (req.method === 'GET' && url.pathname === '/__dev/version') {
        res.setHeader('Cache-Control', 'no-store');
        return json(res, 200, { version: versionServeur });
      }
      if (req.method === 'GET' && url.pathname === '/api/regles') return json(res, 200, regles);
      if (req.method === 'GET' && url.pathname === '/api/catalogue') return json(res, 200, catalogue);
      if (req.method === 'POST' && url.pathname === '/api/personnages/aleatoire') return json(res, 200, genererPersonnage());
      const resource = url.pathname.match(/^\/api\/(sangs|origines|paroles|figures|competences|caracteristiques|vertus)$/)?.[1];
      if (req.method === 'GET' && resource) {
        let values = catalogue[resource];
        const filters = { origines: ['sang_id'], paroles: ['sang_id', 'origine_id'], competences: ['figure_id'] }[resource] ?? [];
        for (const key of url.searchParams.keys()) if (!filters.includes(key)) return json(res, 400, { erreur: `Filtre inconnu : ${key}.` });
        for (const key of filters) if (url.searchParams.has(key)) values = values.filter(item => item[key] === url.searchParams.get(key));
        return json(res, 200, values);
      }
      if (req.method === 'POST' && ['/api/personnages/calculer', '/api/personnages/pdf'].includes(url.pathname)) {
        if (req.headers['content-type']?.split(';')[0].trim().toLowerCase() !== 'application/json') return json(res, 415, { erreur: 'Utiliser Content-Type: application/json.' });
        const chunks = [];
        let size = 0;
        for await (const chunk of req) {
          size += chunk.length;
          if (size > 65536) {
            json(res, 413, { erreur: 'Corps limité à 64 Kio.' });
            return;
          }
          chunks.push(chunk);
        }
        let input;
        try { input = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
        catch { return json(res, 400, { erreur: 'JSON invalide.' }); }
        if (url.pathname === '/api/personnages/pdf') {
          const pdf = await genererPdf(input);
          res.writeHead(200, {
            'Content-Type': 'application/pdf',
            'Content-Disposition': 'attachment; filename="personnage-capharnaum.pdf"',
            'Content-Length': pdf.length,
            'Cache-Control': 'no-store',
          });
          return res.end(Buffer.from(pdf));
        }
        return json(res, 200, calculerPersonnage(input));
      }
      if (await serveStatic(req, res, url.pathname)) return;
      return json(res, 404, { erreur: 'Route inconnue.' });
    } catch (error) {
      if (error instanceof ValidationError) return json(res, 422, { erreur: error.message });
      console.error(error);
      if (!res.headersSent) json(res, 500, { erreur: 'Erreur interne.' });
      else res.end();
    }
  });
}

export async function startApp({ port = 3000, host = '127.0.0.1', fallback = false } = {}) {
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error('PORT doit être un entier entre 0 et 65535.');
  }
  const app = createApp();
  const lastPort = Math.min(65535, port + (fallback ? 10 : 0));
  for (let candidate = port; candidate <= lastPort; candidate++) {
    try {
      await new Promise((resolve, reject) => {
        const onError = error => { app.off('listening', onListening); reject(error); };
        const onListening = () => { app.off('error', onError); resolve(); };
        app.once('error', onError);
        app.once('listening', onListening);
        app.listen(candidate, host);
      });
      return app;
    } catch (error) {
      if (error.code !== 'EADDRINUSE' || candidate === lastPort) throw error;
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT ?? 3000);
  const host = process.env.HOST ?? '127.0.0.1';
  try {
    const app = await startApp({ port, host, fallback: process.env.PORT === undefined });
    const actualPort = app.address().port;
    if (port !== 0 && actualPort !== port) console.log(`Port ${port} occupé ; démarrage sur le port ${actualPort}.`);
    console.log(`Capharnaüm — interface et API : http://${host.includes(':') ? `[${host}]` : host}:${actualPort}`);
  } catch (error) {
    console.error(error.code === 'EADDRINUSE'
      ? 'Port occupé. Choisis un autre port, par exemple : PORT=3100 npm start'
      : `Impossible de démarrer Capharnaüm : ${error.message}`);
    process.exitCode = 1;
  }
}
