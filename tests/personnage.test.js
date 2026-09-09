import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { calculerPersonnage, ValidationError } from '../src/personnage.js';
import { catalogue } from '../src/catalogue.js';
import { createApp, startApp } from '../src/server.js';
import { genererPersonnage } from '../src/aleatoire.js';
import { genererPdf } from '../src/pdf.js';
import { PDFDocument } from 'pdf-lib';

const example = () => JSON.parse(readFileSync(new URL('../examples/personnage.json', import.meta.url), 'utf8'));

test('remplit le modèle PDF de deux pages avec un nom accentué sans altérer le modèle', async () => {
  const templatePath = new URL('../assets/fiche-personnage-v10ans.pdf', import.meta.url);
  const before = readFileSync(templatePath);
  const creation = { ...example(), nom: 'Éléonore — cœur de Shirad' };
  const bytes = await genererPdf(creation);
  const pdf = await PDFDocument.load(bytes);
  const original = await PDFDocument.load(before);
  assert.equal(pdf.getPageCount(), 2);
  assert.equal(pdf.getTitle(), `Capharnaüm — ${creation.nom}`);
  assert.deepEqual(pdf.getPages().map(p => p.getSize()), original.getPages().map(p => p.getSize()));
  assert.deepEqual(readFileSync(templatePath), before);
  await assert.rejects(genererPdf({ ...creation, nom: 'Personnage 🐉' }), ValidationError);
  await assert.rejects(genererPdf({ ...creation, points_competences: {} }), ValidationError);
});

test('génère des personnages valides pour toutes les origines, avec choix et excédents', () => {
  let seed = 12345;
  const tirer = max => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return Math.floor((seed / 4294967296) * max);
  };
  const origines = new Set();
  const paroles = new Set();
  let avecChoix = false;
  let avecExcedent = false;
  let avecReportFigure = false;
  for (let i = 0; i < 1000; i++) {
    const { creation, personnage } = genererPersonnage(tirer);
    assert.deepEqual(calculerPersonnage(creation), personnage);
    assert.equal(catalogue.paroles.find(p => p.id === creation.parole_id).origine_id, creation.origine_id);
    assert.ok(Object.values(personnage.caracteristiques).every(v => v >= 1 && v <= 4));
    assert.ok(Object.values(personnage.competences).every(v => v >= 0 && v <= 5));
    assert.ok(Object.values(creation.points_competences).every(v => v <= 2));
    const groupes = creation.ordre_figures.map(id => catalogue.figures.find(f => f.id === id).competence_ids);
    groupes.forEach((skills, rank) => {
      if (!skills.some(id => creation.points_competences[id] > 0)) return;
      if (rank > 0) avecReportFigure = true;
      // A lower-ranked figure may receive points only after all earlier figures
      // have reached a skill score of 5 or the limit of 2 added points per skill.
      for (const id of groupes.slice(0, rank).flat()) {
        assert.ok(personnage.competences[id] === 5 || creation.points_competences[id] === 2,
          `Priorité non respectée pour ${id}`);
      }
    });
    origines.add(creation.origine_id);
    paroles.add(creation.parole_id);
    avecChoix ||= Object.keys(creation.choix_bonus).length > 0;
    avecExcedent ||= personnage.repartition.excedent_competences > 0;
  }
  assert.equal(origines.size, catalogue.origines.length);
  assert.equal(paroles.size, catalogue.paroles.length);
  assert.ok(avecChoix);
  assert.ok(avecExcedent);
  assert.ok(avecReportFigure);
});

test('démarre sur un autre port en cas de conflit et respecte un port imposé', async t => {
  const blocker = await startApp({ port: 0 });
  t.after(() => new Promise(resolve => blocker.close(resolve)));
  const port = blocker.address().port;
  await assert.rejects(startApp({ port }), { code: 'EADDRINUSE' });
  const app = await startApp({ port, fallback: true });
  t.after(() => new Promise(resolve => { app.closeAllConnections(); app.close(resolve); }));
  assert.ok(app.address().port > port);
  assert.ok(app.address().port <= port + 10);
  const response = await fetch(`http://127.0.0.1:${app.address().port}/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ok' });
});

test('calcule un personnage et les statistiques dépendant des valeurs finales', () => {
  const result = calculerPersonnage(example());
  assert.deepEqual(result.caracteristiques, { coordination: 4, charme: 2, puissance: 3, souffle: 2, sagesse: 2 });
  assert.deepEqual(result.statistiques, { heroisme: 3, pv: 20, initiative_max: 3, trempe: 5, defense_passive: 13 });
  assert.equal(result.competences.arme, 5);
  assert.equal(result.competences.percevoir, 3);
  assert.equal(result.competences.negoce, 2);
  assert.equal(result.competences.discretion, 2);
  assert.equal(result.statut, 'creation_hors_finitions');
  assert.equal(result.finitions_manquantes.length, 6);
});

test('exige les choix et rejette les choix non applicables', () => {
  const p = example();
  p.choix_bonus = {};
  assert.throws(() => calculerPersonnage(p), /Choix requis/);
  p.choix_bonus = { 'origine:malik:0': 'sagesse' };
  assert.throws(() => calculerPersonnage(p), /Choix requis/);
  p.choix_bonus = { ...example().choix_bonus, surprise: 'arme' };
  assert.throws(() => calculerPersonnage(p), /inattendu/);
});

test('contrôle budgets, bornes, types et identifiants', () => {
  for (const mutate of [
    p => { p.vertus.foi = 2; },
    p => { p.vertus = { bravoure: 6, foi: 4, fidelite: 0 }; },
    p => { p.points_caracteristiques.coordination = 2; p.points_caracteristiques.charme = 0; },
    p => { p.points_competences = { percevoir: 3, discretion: 2 }; },
    p => { p.points_competences = { arme: 1, percevoir: 2, discretion: 2 }; },
    p => { p.points_competences.contes = '1'; },
    p => { p.points_competences = { voler: 2, percevoir: 2, contes: 1 }; },
    p => { p.sang_id = 'escarte'; },
    p => { p.ordre_figures[1] = 'guerrier'; },
    p => { p.inconnu = true; },
  ]) {
    const p = example();
    mutate(p);
    assert.throws(() => calculerPersonnage(p), ValidationError);
  }
});

test('reporte les excédents de science dans le budget libre', () => {
  const p = example();
  Object.assign(p, { sang_id: 'shiradi', origine_id: 'salonim', parole_id: 'coeur_sacre_shirad', choix_bonus: {},
    points_caracteristiques: { coordination: 2, charme: 1, puissance: 1, souffle: 2 },
    ordre_figures: ['sage', 'aventurer', 'guerrier', 'prince', 'sorcier', 'poete', 'malandrin', 'travailleur'],
    points_competences: { discretion: 2, contes: 2, poesie: 2, musique: 2 } });
  const result = calculerPersonnage(p);
  assert.equal(result.competences.science, 5);
  assert.deepEqual(result.repartition, { points_competences: 8, excedent_competences: 3 });
  p.points_competences = example().points_competences;
  assert.throws(() => calculerPersonnage(p), /exactement 8/);
});

test('gère séparément plusieurs choix d’origine et de Parole', () => {
  const p = example();
  Object.assign(p, { origine_id: 'mimoun', parole_id: 'vierges_papier',
    choix_bonus: { 'origine:mimoun:1': 'verbe_sacre', 'parole:vierges_papier:3': 'musique' },
    points_caracteristiques: { coordination: 2, charme: 0, puissance: 2, souffle: 1, sagesse: 1 } });
  const result = calculerPersonnage(p);
  assert.equal(result.competences.musique, 1);
  assert.equal(result.competences.verbe_sacre, 2);
});

test('conserve la liberté de Parole du site', () => {
  const p = example();
  p.parole_id = 'lions_rouges';
  assert.equal(calculerPersonnage(p).parole.id, 'lions_rouges');
});

test('applique la correction 2018 du Soupçon des traîtres aux scores finaux', () => {
  const p = example();
  p.origine_id = 'rachid';
  p.parole_id = 'soupcon_traitres';
  p.choix_bonus = {};
  const result = calculerPersonnage(p);
  assert.equal(result.caracteristiques.sagesse, 3);
  assert.equal(result.competences.assassinat, 2);
  assert.equal(result.competences.discretion, 3);
  assert.equal(result.competences.elegance, 2);
  assert.equal(result.competences.arme, 4);
  assert.equal(result.competences.epreuve, 2);
  assert.equal(result.competences.verbe_sacre, 1);
  assert.equal(result.statistiques.defense_passive, 10);
});

test('chaque bonus et relation référence une donnée existante', () => {
  const ids = new Set([...catalogue.caracteristiques, ...catalogue.competences].map(x => x.id));
  for (const entity of [...catalogue.origines, ...catalogue.paroles]) {
    assert.ok(catalogue.sangs.some(s => s.id === entity.sang_id));
    for (const b of entity.bonus) for (const id of b.cibles) assert.ok(ids.has(id));
  }
  for (const p of catalogue.paroles) assert.ok(catalogue.origines.some(o => o.id === p.origine_id && o.sang_id === p.sang_id));
});

test('API HTTP : catalogue, filtrage, calcul et erreurs client', async t => {
  const app = createApp();
  await new Promise((resolve, reject) => { app.once('error', reject); app.listen(0, '127.0.0.1', resolve); });
  t.after(() => new Promise(resolve => { app.closeAllConnections(); app.close(resolve); }));
  const base = `http://127.0.0.1:${app.address().port}`;
  const get = path => fetch(base + path);
  const post = body => fetch(base + '/api/personnages/calculer', { method: 'POST', headers: { 'content-type': 'application/json' }, body });
  const front = await get('/');
  assert.equal(front.status, 200);
  assert.match(front.headers.get('content-type'), /text\/html/);
  const frontHtml = await front.text();
  assert.match(frontHtml, /fiche de perso web interactive/);
  assert.match(frontHtml, /class="page-layout"/);
  assert.match(frontHtml, /class="creation-panel"/);
  assert.match(frontHtml, /id="apercu-pdf-frame"/);
  assert.match(frontHtml, /javascripts\/rechargement\.js/);
  assert.equal(front.headers.get('cache-control'), 'no-cache');
  const version = await get('/__dev/version');
  assert.equal(version.status, 200);
  assert.equal(version.headers.get('cache-control'), 'no-store');
  assert.match((await version.json()).version, /^\d+-\d+$/);
  for (const [path, type] of [
    ['/javascripts/caph.js', 'text/javascript'],
    ['/javascripts/foundation.min.js', 'text/javascript'],
    ['/javascripts/rechargement.js', 'text/javascript'],
    ['/stylesheets/app.css', 'text/css'],
    ['/images/bonus_figures.png', 'image/png'],
  ]) {
    const asset = await get(path);
    assert.equal(asset.status, 200);
    assert.ok(asset.headers.get('content-type').startsWith(type));
    assert.ok((await asset.arrayBuffer()).byteLength > 0);
  }
  const head = await fetch(base + '/', { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
  for (const path of ['/src/server.js', '/data/source/caph.js', '/package.json', '/%2e%2e%2fsrc/server.js']) {
    assert.equal((await get(path)).status, 404);
  }
  assert.equal((await (await get('/api/sangs')).json()).length, 4);
  const randomResponse = await fetch(base + '/api/personnages/aleatoire', { method: 'POST' });
  assert.equal(randomResponse.status, 200);
  const generated = await randomResponse.json();
  assert.deepEqual(calculerPersonnage(generated.creation), generated.personnage);
  const pdfResponse = await fetch(base + '/api/personnages/pdf', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(generated.creation),
  });
  assert.equal(pdfResponse.status, 200);
  assert.equal(pdfResponse.headers.get('content-type'), 'application/pdf');
  assert.match(pdfResponse.headers.get('content-disposition'), /attachment/);
  const pdf = await PDFDocument.load(await pdfResponse.arrayBuffer());
  assert.equal(pdf.getPageCount(), 2);
  const invalidPdf = await fetch(base + '/api/personnages/pdf', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
  });
  assert.equal(invalidPdf.status, 422);
  assert.equal((await (await get('/api/origines?sang_id=saabi')).json()).length, 9);
  assert.equal((await (await get('/api/paroles?origine_id=salonim')).json()).length, 2);
  assert.equal((await get('/api/origines?typo=saabi')).status, 400);
  const response = await post(JSON.stringify(example()));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).statistiques.pv, 20);
  assert.equal((await post('{')).status, 400);
  assert.equal((await post('{}')).status, 422);
  assert.equal((await post(' '.repeat(65537))).status, 413);
  assert.equal((await fetch(base + '/api/personnages/calculer', { method: 'POST', body: '{}' })).status, 415);
  assert.equal((await get('/inconnue')).status, 404);
});
