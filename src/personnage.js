import { catalogue, regles } from './catalogue.js';

export class ValidationError extends Error {}
const fail = message => { throw new ValidationError(message); };
const own = (object, key) => Object.hasOwn(object, key);

function object(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${label} doit être un objet.`);
}

function allocation(value, ids, label, max, total) {
  object(value, label);
  for (const [key, points] of Object.entries(value)) {
    if (!ids.includes(key)) fail(`${label} : identifiant inconnu « ${key} ».`);
    if (!Number.isInteger(points) || points < 0 || points > max) fail(`${label}.${key} doit être un entier entre 0 et ${max}.`);
  }
  if (Object.values(value).reduce((a, b) => a + b, 0) !== total) fail(`${label} : répartir exactement ${total} points.`);
}

export function calculerPersonnage(input) {
  object(input, 'personnage');
  const allowed = ['nom', 'sang_id', 'origine_id', 'parole_id', 'choix_bonus', 'vertus', 'points_caracteristiques', 'ordre_figures', 'points_competences'];
  for (const key of Object.keys(input)) if (!allowed.includes(key)) fail(`Champ inconnu : ${key}.`);
  if (typeof input.nom !== 'string' || !input.nom.trim() || input.nom.length > 100) fail('nom doit contenir entre 1 et 100 caractères.');
  const sang = catalogue.sangs.find(s => s.id === input.sang_id);
  const origine = catalogue.origines.find(o => o.id === input.origine_id);
  const parole = catalogue.paroles.find(p => p.id === input.parole_id);
  if (!sang) fail('Sang inconnu.');
  if (!origine || origine.sang_id !== sang.id) fail('Origine inconnue ou incompatible avec le Sang.');
  if (!parole) fail('Parole inconnue.');

  const caracIds = catalogue.caracteristiques.map(c => c.id);
  const compIds = catalogue.competences.map(c => c.id);
  const vertuIds = catalogue.vertus.map(v => v.id);
  allocation(input.vertus, vertuIds, 'vertus', regles.vertus.maximum, regles.vertus.points);
  for (const id of vertuIds) if (!own(input.vertus, id) || input.vertus[id] < regles.vertus.minimum) fail(`La vertu ${id} doit être au moins à ${regles.vertus.minimum}.`);
  allocation(input.points_caracteristiques, caracIds, 'points_caracteristiques', regles.caracteristiques.points_libres, regles.caracteristiques.points_libres);
  const figures = input.ordre_figures;
  if (!Array.isArray(figures) || figures.length !== catalogue.figures.length || new Set(figures).size !== figures.length || figures.some(id => !catalogue.figures.some(f => f.id === id))) fail('ordre_figures doit contenir les 8 figures, chacune une seule fois.');

  const caracteristiques = Object.fromEntries(caracIds.map(id => [id, regles.caracteristiques.base]));
  const competences = Object.fromEntries(compIds.map(id => [id, regles.competences.bases[id] ?? 0]));
  const choix = input.choix_bonus ?? {};
  object(choix, 'choix_bonus');
  const usedChoices = new Set();
  for (const [type, entity] of [['origine', origine], ['parole', parole]]) {
    for (const [i, bonus] of entity.bonus.entries()) {
      let target = bonus.cibles[0];
      if (bonus.type === 'choix') {
        const key = `${type}:${entity.id}:${i}`;
        usedChoices.add(key);
        if (!own(choix, key) || !bonus.cibles.includes(choix[key])) fail(`Choix requis pour ${key} : ${bonus.cibles.join(', ')}.`);
        target = choix[key];
      }
      const values = own(caracteristiques, target) ? caracteristiques : competences;
      values[target] += bonus.valeur;
    }
  }
  for (const key of Object.keys(choix)) if (!usedChoices.has(key)) fail(`Choix de bonus inattendu : ${key}.`);
  for (const [id, points] of Object.entries(input.points_caracteristiques)) caracteristiques[id] += points;
  for (const [id, value] of Object.entries(caracteristiques)) if (value > regles.caracteristiques.maximum_creation) fail(`${id} dépasse le maximum de ${regles.caracteristiques.maximum_creation} à la création.`);

  figures.forEach((id, rank) => {
    for (const skill of catalogue.figures.find(f => f.id === id).competence_ids) competences[skill] += regles.competences.bonus_par_rang_figure[rank];
  });
  let excedent = 0;
  for (const id of compIds) {
    excedent += Math.max(0, competences[id] - regles.competences.maximum_creation);
    competences[id] = Math.min(competences[id], regles.competences.maximum_creation);
  }
  const budget = regles.competences.points_libres + excedent;
  allocation(input.points_competences, compIds, 'points_competences', regles.competences.maximum_ajout_par_competence, budget);
  for (const [id, points] of Object.entries(input.points_competences)) {
    competences[id] += points;
    if (competences[id] > regles.competences.maximum_creation) fail(`${id} dépasse le maximum de ${regles.competences.maximum_creation} à la création.`);
  }
  const heroisme = Math.floor(vertuIds.reduce((sum, id) => sum + input.vertus[id], 0) / 3);
  const { souffle, coordination, sagesse } = caracteristiques;
  return {
    nom: input.nom.trim(), sang: { id: sang.id, nom: sang.nom },
    origine: { id: origine.id, nom: origine.nom }, parole: { id: parole.id, nom: parole.nom },
    vertus: { ...input.vertus }, caracteristiques, competences, ordre_figures: [...figures],
    statistiques: { heroisme, pv: 10 * souffle, initiative_max: 1 + Math.floor((coordination + souffle + sagesse) / 3), trempe: souffle + heroisme, defense_passive: coordination + competences.epreuve + 6 },
    repartition: { points_competences: budget, excedent_competences: excedent },
    statut: 'creation_hors_finitions',
    finitions_manquantes: regles.finitions_manquantes.map(f => f.id),
  };
}
