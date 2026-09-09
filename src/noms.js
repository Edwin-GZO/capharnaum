import { randomInt } from 'node:crypto';

// Sélection indépendante de prénoms courants. Elle ne provient pas de
// FantasyNameGenerators.com. Les noms complets sont composés localement.
const prenoms = Object.freeze({
  homme: Object.freeze([
    'Adam', 'Adil', 'Ahmad', 'Ali', 'Amir', 'Anas', 'Bilal', 'Farid', 'Hakim',
    'Hamza', 'Haroun', 'Hassan', 'Ibrahim', 'Idris', 'Ismaïl', 'Jalil', 'Karim',
    'Khaled', 'Malik', 'Mehdi', 'Moussa', 'Nadir', 'Nassim', 'Omar', 'Rachid',
    'Samir', 'Tarek', 'Yacine', 'Youssef', 'Zayd',
  ]),
  femme: Object.freeze([
    'Aïcha', 'Amina', 'Amira', 'Asma', 'Aya', 'Dalia', 'Farah', 'Fatima',
    'Hana', 'Inès', 'Jamila', 'Kenza', 'Khadija', 'Laila', 'Lina', 'Mariam',
    'Meryem', 'Nadia', 'Naïma', 'Nour', 'Rania', 'Salma', 'Samira', 'Soraya',
    'Yasmine', 'Zahra', 'Zaynab',
  ]),
});

export const genresNoms = Object.freeze(['homme', 'femme', 'aleatoire']);

function choisir(values, tirer) {
  return values[tirer(values.length)];
}

export function genererNom(genre = 'aleatoire', tirer = randomInt) {
  if (!genresNoms.includes(genre)) throw new RangeError(`Genre inconnu : ${genre}.`);
  const genreChoisi = genre === 'aleatoire' ? choisir(['homme', 'femme'], tirer) : genre;
  const premier = choisir(prenoms[genreChoisi], tirer);
  const parent = choisir(prenoms.homme.filter(nom => nom !== premier), tirer);
  const filiation = genreChoisi === 'homme' ? 'ibn' : 'bint';
  return { nom: `${premier} ${filiation} ${parent}`, genre: genreChoisi };
}

export function genererNoms({ genre = 'aleatoire', nombre = 10 } = {}, tirer = randomInt) {
  if (!genresNoms.includes(genre)) throw new RangeError(`Genre inconnu : ${genre}.`);
  if (!Number.isInteger(nombre) || nombre < 1 || nombre > 20) {
    throw new RangeError('nombre doit être un entier entre 1 et 20.');
  }
  const genres = genre === 'aleatoire' ? ['homme', 'femme'] : [genre];
  const candidats = genres.flatMap(genreChoisi => prenoms[genreChoisi].flatMap(premier =>
    prenoms.homme
      .filter(parent => parent !== premier)
      .map(parent => ({
        nom: `${premier} ${genreChoisi === 'homme' ? 'ibn' : 'bint'} ${parent}`,
        genre: genreChoisi,
      }))));
  const noms = [];
  while (noms.length < nombre) {
    noms.push(candidats.splice(tirer(candidats.length), 1)[0]);
  }
  return { genre, nombre, noms };
}
