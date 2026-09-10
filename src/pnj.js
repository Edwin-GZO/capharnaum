import { randomInt } from 'node:crypto';
import { genererPersonnage } from './aleatoire.js';

export function genererPnj({ genre = 'aleatoire', nombre = 5, avecTitre = true } = {}, tirer = randomInt) {
  if (!Number.isInteger(nombre) || nombre < 1 || nombre > 20) {
    throw new RangeError('nombre doit être un entier entre 1 et 20.');
  }
  const personnages = Array.from({ length: nombre }, () => genererPersonnage(tirer, { genre, avecTitre }));
  return {
    genre,
    nombre,
    pnj: personnages.map(({ creation, personnage }) => ({
      nom: personnage.nom,
      sang: personnage.sang,
      origine: personnage.origine,
      parole: personnage.parole,
      figure_principale: personnage.ordre_figures[0],
      statistiques: personnage.statistiques,
      creation,
    })),
  };
}
