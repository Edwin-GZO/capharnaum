import { randomInt } from 'node:crypto';
import { catalogue, regles } from './catalogue.js';
import { calculerPersonnage } from './personnage.js';
import { genererNom } from './noms.js';

export function genererPersonnage(tirer = randomInt, { genre = 'aleatoire' } = {}) {
  const choisir = values => {
    if (!values.length) throw new Error('Aucun choix disponible pour la génération.');
    return values[tirer(values.length)];
  };
  const sang = choisir(catalogue.sangs);
  const origine = choisir(catalogue.origines.filter(o => o.sang_id === sang.id));
  const parole = choisir(catalogue.paroles.filter(p => p.origine_id === origine.id));
  const caracs = Object.fromEntries(catalogue.caracteristiques.map(c => [c.id, regles.caracteristiques.base]));
  const comps = Object.fromEntries(catalogue.competences.map(c => [c.id, regles.competences.bases[c.id] ?? 0]));
  const choix = {};
  for (const [type, entity] of [['origine', origine], ['parole', parole]]) {
    entity.bonus.forEach((bonus, i) => {
      const cible = choisir(bonus.cibles);
      if (bonus.type === 'choix') choix[`${type}:${entity.id}:${i}`] = cible;
      (Object.hasOwn(caracs, cible) ? caracs : comps)[cible] += bonus.valeur;
    });
  }
  const figures = catalogue.figures.map(f => f.id);
  for (let i = figures.length - 1; i > 0; i--) {
    const j = tirer(i + 1);
    [figures[i], figures[j]] = [figures[j], figures[i]];
  }
  figures.forEach((id, rank) => {
    for (const skill of catalogue.figures.find(f => f.id === id).competence_ids) comps[skill] += regles.competences.bonus_par_rang_figure[rank];
  });
  let budget = regles.competences.points_libres;
  for (const id of Object.keys(comps)) {
    budget += Math.max(0, comps[id] - regles.competences.maximum_creation);
    comps[id] = Math.min(comps[id], regles.competences.maximum_creation);
  }
  function repartir(bases, points, maximum, maxAjout = maximum, priorites = [Object.keys(bases)]) {
    const ajouts = Object.fromEntries(Object.keys(bases).map(id => [id, 0]));
    for (let i = 0; i < points; i++) {
      // Spend in the highest-ranked figure that still has eligible skills.
      const disponibles = priorites.map(ids => ids.filter(id => bases[id] + ajouts[id] < maximum && ajouts[id] < maxAjout));
      const id = choisir(disponibles.find(ids => ids.length) ?? []);
      ajouts[id]++;
    }
    return ajouts;
  }
  const vertus = Object.fromEntries(catalogue.vertus.map(v => [v.id, regles.vertus.minimum]));
  const ajoutsVertus = repartir(vertus, regles.vertus.points - Object.values(vertus).reduce((a, b) => a + b, 0), regles.vertus.maximum);
  for (const id of Object.keys(vertus)) vertus[id] += ajoutsVertus[id];
  const creation = {
    nom: genererNom(genre, tirer, { sangId: sang.id, origineNom: origine.nom }).nom,
    sang_id: sang.id, origine_id: origine.id, parole_id: parole.id,
    choix_bonus: choix, vertus, ordre_figures: figures,
    points_caracteristiques: repartir(caracs, regles.caracteristiques.points_libres, regles.caracteristiques.maximum_creation),
    points_competences: repartir(comps, budget, regles.competences.maximum_creation, regles.competences.maximum_ajout_par_competence,
      figures.map(id => catalogue.figures.find(f => f.id === id).competence_ids)),
  };
  return { creation, personnage: calculerPersonnage(creation) };
}
