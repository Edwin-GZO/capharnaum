import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { catalogue, regles } from './catalogue.js';
import { calculerPersonnage, ValidationError } from './personnage.js';
import { createStaticHandler } from './static.js';
import { genererPersonnage } from './aleatoire.js';
import { genererPdf } from './pdf.js';

const versionServeur = `${Date.now()}-${process.pid}`;
const modeDeveloppement = process.env.NODE_ENV === 'development';

function securiser(res) {
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-src 'self' blob:; object-src 'none'; base-uri 'none'; form-action 'self'");
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
}

function json(res, status, body) {
  if (!res.hasHeader('Cache-Control')) res.setHeader('Cache-Control', 'no-store');
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function creerCachePdf(limit) {
  const entries = new Map();
  return async (key, factory) => {
    if (limit <= 0) return { pdf: await factory(), cache: 'BYPASS' };
    if (entries.has(key)) {
      const pending = entries.get(key);
      entries.delete(key);
      entries.set(key, pending);
      return { pdf: await pending, cache: 'HIT' };
    }
    const pending = Promise.resolve().then(factory);
    entries.set(key, pending);
    while (entries.size > limit) entries.delete(entries.keys().next().value);
    try {
      return { pdf: await pending, cache: 'MISS' };
    } catch (error) {
      if (entries.get(key) === pending) entries.delete(key);
      throw error;
    }
  };
}

function creerLimiteur(limit, fenetreMs) {
  const clients = new Map();
  return key => {
    if (limit <= 0) return 0;
    const now = Date.now();
    let entry = clients.get(key);
    if (!entry || entry.reset <= now) entry = { count: 0, reset: now + fenetreMs };
    entry.count++;
    clients.delete(key);
    clients.set(key, entry);
    while (clients.size > 10000) clients.delete(clients.keys().next().value);
    return entry.count > limit ? Math.max(1, Math.ceil((entry.reset - now) / 1000)) : 0;
  };
}

function adresseClient(req, trustProxy) {
  if (trustProxy) {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.trim()) return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress ?? 'inconnue';
}

function entierEnvironnement(name, fallback, min, max) {
  if (process.env[name] === undefined) return fallback;
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value >= min && value <= max ? value : fallback;
}

function normaliserBasePath(value = '') {
  const path = value.trim().replace(/\/$/, '');
  if (!path || path === '/') return '';
  if (!/^\/[A-Za-z0-9._~-]+(?:\/[A-Za-z0-9._~-]+)*$/.test(path)) {
    throw new Error('BASE_PATH doit être vide ou être un chemin comme /capharnaum.');
  }
  return path;
}

export function createApp(options = {}) {
  const development = options.development ?? modeDeveloppement;
  const pdfCacheSize = options.pdfCacheSize ?? entierEnvironnement('PDF_CACHE_SIZE', 32, 0, 256);
  const pdfRateLimit = options.pdfRateLimit ?? entierEnvironnement('PDF_RATE_LIMIT', development ? 0 : 30, 0, 1000);
  const rateWindowMs = options.rateWindowMs ?? entierEnvironnement('PDF_RATE_WINDOW_MS', 60000, 1000, 3600000);
  const trustProxy = options.trustProxy ?? process.env.TRUST_PROXY === '1';
  const basePath = normaliserBasePath(options.basePath ?? process.env.BASE_PATH);
  const serveStatic = createStaticHandler({ development });
  const obtenirPdf = creerCachePdf(pdfCacheSize);
  const limiterPdf = creerLimiteur(pdfRateLimit, rateWindowMs);
  const catalogueJson = (res, body) => {
    if (!development) res.setHeader('Cache-Control', 'public, max-age=300');
    return json(res, 200, body);
  };
  const app = createServer(async (req, res) => {
    try {
      securiser(res);
      const url = new URL(req.url, 'http://localhost');
      if (basePath && url.pathname === basePath) {
        res.writeHead(308, { Location: `${basePath}/${url.search}` });
        return res.end();
      }
      const pathname = basePath && url.pathname.startsWith(`${basePath}/`)
        ? url.pathname.slice(basePath.length)
        : url.pathname;
      if (pathname.startsWith('/api/')) {
        res.setHeader('Access-Control-Allow-Origin', '*');
        if (req.method === 'OPTIONS') {
          res.writeHead(204, {
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Max-Age': '86400',
          });
          return res.end();
        }
      }
      if (req.method === 'GET' && pathname === '/health') return json(res, 200, { status: 'ok' });
      if (development && req.method === 'GET' && pathname === '/__dev/version') {
        res.setHeader('Cache-Control', 'no-store');
        return json(res, 200, { version: versionServeur });
      }
      if (req.method === 'GET' && pathname === '/api/regles') return catalogueJson(res, regles);
      if (req.method === 'GET' && pathname === '/api/catalogue') return catalogueJson(res, catalogue);
      if (req.method === 'POST' && pathname === '/api/personnages/aleatoire') return json(res, 200, genererPersonnage());
      const resource = pathname.match(/^\/api\/(sangs|origines|paroles|figures|competences|caracteristiques|vertus)$/)?.[1];
      if (req.method === 'GET' && resource) {
        let values = catalogue[resource];
        const filters = { origines: ['sang_id'], paroles: ['sang_id', 'origine_id'], competences: ['figure_id'] }[resource] ?? [];
        for (const key of url.searchParams.keys()) if (!filters.includes(key)) return json(res, 400, { erreur: `Filtre inconnu : ${key}.` });
        for (const key of filters) if (url.searchParams.has(key)) values = values.filter(item => item[key] === url.searchParams.get(key));
        return catalogueJson(res, values);
      }
      if (req.method === 'POST' && ['/api/personnages/calculer', '/api/personnages/pdf'].includes(pathname)) {
        if (pathname === '/api/personnages/pdf') {
          const retryAfter = limiterPdf(adresseClient(req, trustProxy));
          if (retryAfter) {
            res.setHeader('Retry-After', retryAfter);
            return json(res, 429, { erreur: 'Trop de générations PDF. Réessaie dans quelques instants.' });
          }
        }
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
        const body = Buffer.concat(chunks);
        let input;
        try { input = JSON.parse(body.toString('utf8')); }
        catch { return json(res, 400, { erreur: 'JSON invalide.' }); }
        if (pathname === '/api/personnages/pdf') {
          const key = createHash('sha256').update(body).digest('base64url');
          const { pdf, cache } = await obtenirPdf(key, () => genererPdf(input));
          res.writeHead(200, {
            'Content-Type': 'application/pdf',
            'Content-Disposition': 'attachment; filename="personnage-capharnaum.pdf"',
            'Content-Length': pdf.length,
            'Cache-Control': 'no-store',
            'X-PDF-Cache': cache,
          });
          return res.end(Buffer.from(pdf));
        }
        return json(res, 200, calculerPersonnage(input));
      }
      if (await serveStatic(req, res, pathname)) return;
      return json(res, 404, { erreur: 'Route inconnue.' });
    } catch (error) {
      if (error instanceof ValidationError) return json(res, 422, { erreur: error.message });
      console.error(error);
      if (!res.headersSent) json(res, 500, { erreur: 'Erreur interne.' });
      else res.end();
    }
  });
  app.requestTimeout = 15000;
  app.headersTimeout = 10000;
  app.keepAliveTimeout = 5000;
  app.maxHeadersCount = 100;
  app.maxRequestsPerSocket = 1000;
  return app;
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

async function startPassengerApp(passenger) {
  passenger.configure({ autoInstall: false });
  const app = createApp();
  await new Promise((resolve, reject) => {
    app.once('error', reject);
    app.listen('passenger', resolve);
  });
  return app;
}

function configurerArret(app) {
  let stopping = false;
  const stop = signal => {
    if (stopping) return;
    stopping = true;
    console.log(`${signal} reçu, arrêt du serveur…`);
    app.close(() => process.exit(0));
    setTimeout(() => app.closeAllConnections(), 10000).unref();
  };
  process.once('SIGTERM', () => stop('SIGTERM'));
  process.once('SIGINT', () => stop('SIGINT'));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT ?? 3000);
  const host = process.env.HOST ?? (modeDeveloppement ? '127.0.0.1' : '0.0.0.0');
  try {
    const passenger = globalThis.PhusionPassenger;
    const app = passenger
      ? await startPassengerApp(passenger)
      : await startApp({ port, host, fallback: modeDeveloppement && process.env.PORT === undefined });
    if (passenger) {
      console.log(`Capharnaüm — application Passenger prête${process.env.BASE_PATH ? ` sur ${process.env.BASE_PATH}` : ''}.`);
    } else {
      const actualPort = app.address().port;
      if (port !== 0 && actualPort !== port) console.log(`Port ${port} occupé ; démarrage sur le port ${actualPort}.`);
      const displayedHost = host === '0.0.0.0' ? '127.0.0.1' : host;
      console.log(`Capharnaüm — interface et API : http://${displayedHost.includes(':') ? `[${displayedHost}]` : displayedHost}:${actualPort}${process.env.BASE_PATH ?? ''}/ (${modeDeveloppement ? 'développement' : 'production'})`);
    }
    configurerArret(app);
  } catch (error) {
    console.error(error.code === 'EADDRINUSE'
      ? 'Port occupé. Choisis un autre port, par exemple : PORT=3100 npm start'
      : `Impossible de démarrer Capharnaüm : ${error.message}`);
    process.exitCode = 1;
  }
}
