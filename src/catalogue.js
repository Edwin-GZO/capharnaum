import { readFileSync } from 'node:fs';

export const catalogue = JSON.parse(readFileSync(new URL('../data/capharnaum.json', import.meta.url), 'utf8'));
export const regles = JSON.parse(readFileSync(new URL('../data/regles.json', import.meta.url), 'utf8'));
