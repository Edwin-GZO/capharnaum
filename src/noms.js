import { randomInt } from 'node:crypto';

// Sélections indépendantes, composées pour ce projet. Elles ne proviennent pas
// de FantasyNameGenerators.com et ne constituent pas une règle officielle.
const styles = Object.freeze({
  saabi: Object.freeze({
    homme: Object.freeze(['Adam', 'Adil', 'Ahmad', 'Ali', 'Amir', 'Anas', 'Bilal', 'Farid', 'Hakim', 'Hamza', 'Haroun', 'Hassan', 'Ibrahim', 'Idris', 'Ismaïl', 'Jalil', 'Karim', 'Khaled', 'Malik', 'Mehdi', 'Moussa', 'Nadir', 'Nassim', 'Omar', 'Rachid', 'Samir', 'Tarek', 'Yacine', 'Youssef', 'Zayd']),
    femme: Object.freeze(['Aïcha', 'Amina', 'Amira', 'Asma', 'Aya', 'Dalia', 'Farah', 'Fatima', 'Hana', 'Inès', 'Jamila', 'Kenza', 'Khadija', 'Laila', 'Lina', 'Mariam', 'Meryem', 'Nadia', 'Naïma', 'Nour', 'Rania', 'Salma', 'Samira', 'Soraya', 'Yasmine', 'Zahra', 'Zaynab']),
    composer: (premier, parent, genre) => `${premier} ${genre === 'homme' ? 'ibn' : 'bint'} ${parent}`,
  }),
  shiradi: Object.freeze({
    homme: Object.freeze(['Aaron', 'Asher', 'Boaz', 'David', 'Eli', 'Ezra', 'Gabriel', 'Isaac', 'Jacob', 'Jonas', 'Josué', 'Lévi', 'Mica', 'Nathan', 'Noam', 'Raphaël', 'Salomon', 'Samuel', 'Saül']),
    femme: Object.freeze(['Abigail', 'Adina', 'Déborah', 'Esther', 'Hannah', 'Judith', 'Léa', 'Myriam', 'Naomi', 'Rachel', 'Rebecca', 'Ruth', 'Sarah', 'Shira', 'Tamar', 'Yaël']),
    composer: (premier, parent, genre) => `${premier} ${genre === 'homme' ? 'ben' : 'bat'} ${parent}`,
  }),
  agalantheen: Object.freeze({
    homme: Object.freeze(['Adrastos', 'Alexandre', 'Cassian', 'Dorian', 'Évandre', 'Hector', 'Léandre', 'Lysandre', 'Marius', 'Nikandros', 'Orion', 'Persée', 'Silas', 'Théon']),
    femme: Object.freeze(['Ariane', 'Cassia', 'Daphné', 'Elara', 'Hélène', 'Irène', 'Ione', 'Lysandra', 'Maia', 'Phébé', 'Thalia']),
    composer: (premier, parent, genre, origine) => `${premier} ${origine ? `de ${origine}` : `${genre === 'homme' ? 'fils' : 'fille'} de ${parent}`}`,
  }),
  escarte: Object.freeze({
    homme: Object.freeze(['Alonso', 'Diego', 'Esteban', 'Fernando', 'Gabriel', 'Iñigo', 'Javier', 'Mateo', 'Rafael', 'Rodrigo', 'Salvador', 'Santiago']),
    femme: Object.freeze(['Alba', 'Beatriz', 'Carmen', 'Catalina', 'Elena', 'Inés', 'Isabel', 'Jimena', 'Leonor', 'Lucía', 'Marisol', 'Paloma']),
    composer: (premier, parent, genre, origine) => `${premier} ${origine ? `de ${origine}` : `${genre === 'homme' ? 'hijo' : 'hija'} de ${parent}`}`,
  }),
});

export const genresNoms = Object.freeze(['homme', 'femme', 'aleatoire']);
export const sangsNoms = Object.freeze(Object.keys(styles));

function choisir(values, tirer) {
  return values[tirer(values.length)];
}

function candidatsPour(genre, sangId, origineNom) {
  const style = styles[sangId];
  const genres = genre === 'aleatoire' ? ['homme', 'femme'] : [genre];
  const candidats = genres.flatMap(genreChoisi => style[genreChoisi].flatMap(premier =>
    style.homme
      .filter(parent => parent !== premier)
      .map(parent => ({
        nom: style.composer(premier, parent, genreChoisi, origineNom),
        genre: genreChoisi,
        sang_id: sangId,
      }))));
  return [...new Map(candidats.map(item => [`${item.genre}:${item.nom}`, item])).values()];
}

export function genererNom(genre = 'aleatoire', tirer = randomInt, { sangId = 'saabi', origineNom } = {}) {
  if (!genresNoms.includes(genre)) throw new RangeError(`Genre inconnu : ${genre}.`);
  if (!sangsNoms.includes(sangId)) throw new RangeError(`Sang inconnu : ${sangId}.`);
  return choisir(candidatsPour(genre, sangId, origineNom), tirer);
}

export function genererNoms({ genre = 'aleatoire', nombre = 10, sangId = 'saabi', origineNom } = {}, tirer = randomInt) {
  if (!genresNoms.includes(genre)) throw new RangeError(`Genre inconnu : ${genre}.`);
  if (!sangsNoms.includes(sangId)) throw new RangeError(`Sang inconnu : ${sangId}.`);
  if (!Number.isInteger(nombre) || nombre < 1 || nombre > 20) {
    throw new RangeError('nombre doit être un entier entre 1 et 20.');
  }
  const candidats = candidatsPour(genre, sangId, origineNom);
  const noms = [];
  while (noms.length < nombre) {
    noms.push(candidats.splice(tirer(candidats.length), 1)[0]);
  }
  return { genre, nombre, sang_id: sangId, noms };
}
