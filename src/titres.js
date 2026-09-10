import { randomInt } from 'node:crypto';
import { catalogue } from './catalogue.js';

const titresParFigure = Object.freeze({
  aventurer: Object.freeze(['le Marcheur des dunes', 'la Boussole des caravanes', 'l’Enfant des horizons', 'le Guide des pistes oubliées']),
  sage: Object.freeze(['la Mémoire des anciens', 'le Gardien des chroniques', 'l’Œil qui sait', 'la Voix des vérités']),
  prince: Object.freeze(['le Lion du palais', 'la Rose des cours', 'le Maître des serments', 'la Main généreuse']),
  sorcier: Object.freeze(['le Veilleur des étoiles', 'la Flamme voilée', 'le Lecteur des signes', 'l’Ombre des djinns']),
  guerrier: Object.freeze(['le Cimeterre ardent', 'la Lance invaincue', 'le Bouclier des faibles', 'la Fureur du levant']),
  poete: Object.freeze(['la Voix des nuits', 'le Chant du désert', 'la Plume de safran', 'le Tisseur de légendes']),
  malandrin: Object.freeze(['l’Ombre du souk', 'la Main invisible', 'le Renard des ruelles', 'la Lame silencieuse']),
  travailleur: Object.freeze(['la Main d’or', 'le Bâtisseur patient', 'la Force du peuple', 'le Cœur de l’ouvrage']),
});

export const figuresTitres = Object.freeze(Object.keys(titresParFigure));

export function genererTitres({ figureId, nombre = 1 } = {}, tirer = randomInt) {
  if (!figuresTitres.includes(figureId)) throw new RangeError(`Figure inconnue : ${figureId}.`);
  if (!Number.isInteger(nombre) || nombre < 1 || nombre > titresParFigure[figureId].length) {
    throw new RangeError(`nombre doit être un entier entre 1 et ${titresParFigure[figureId].length}.`);
  }
  const candidats = [...titresParFigure[figureId]];
  const titres = [];
  while (titres.length < nombre) titres.push(candidats.splice(tirer(candidats.length), 1)[0]);
  return {
    figure: catalogue.figures.find(figure => figure.id === figureId),
    nombre,
    titres,
  };
}

export function ajouterTitre(nom, figureId, tirer = randomInt) {
  return `${nom}, ${genererTitres({ figureId }, tirer).titres[0]}`;
}
