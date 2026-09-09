import { readFile } from 'node:fs/promises';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { catalogue, regles } from './catalogue.js';
import { calculerPersonnage, ValidationError } from './personnage.js';

// Coordinates measured on a 990 × 1400 rendering of the user's two-page A4 template.
// x and y are the text centre (or left edge) and baseline, measured from the top.
export async function genererPdf(creation) {
  const perso = calculerPersonnage(creation);
  const template = await readFile(new URL('../assets/fiche-personnage-v10ans.pdf', import.meta.url));
  const pdf = await PDFDocument.load(template);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pages = pdf.getPages();
  function texte(pageIndex, text, x, y, { size = 10, width, centre = false, gras = false } = {}) {
    const page = pages[pageIndex];
    const police = gras ? bold : font;
    const scaleX = page.getWidth() / 990;
    const scaleY = page.getHeight() / 1400;
    const value = String(text).normalize('NFC').replace(/[\u0000-\u001f\u007f]/g, ' ');
    let length;
    try { length = police.widthOfTextAtSize(value, size); }
    catch { throw new ValidationError('Le nom contient des caractères non pris en charge par la police du PDF. Utilise des lettres latines, éventuellement accentuées.'); }
    if (width && length > width * scaleX) {
      size *= width * scaleX / length;
      length = width * scaleX;
    }
    page.drawText(value, { x: x * scaleX - (centre ? length / 2 : 0), y: page.getHeight() - y * scaleY,
      font: police, size, color: rgb(0.12, 0.10, 0.07) });
  }
  const score = (value, x, y) => texte(0, value, x, y, { centre: true, gras: true, size: 11 });
  texte(0, perso.nom, 100, 205, { width: 325, gras: true });
  texte(0, `${perso.sang.nom} — ${perso.origine.nom}`, 97, 244, { width: 330, size: 9 });
  for (const [id, x] of Object.entries({ coordination: 523, souffle: 623, sagesse: 722, puissance: 824, charme: 923 })) {
    score(perso.caracteristiques[id], x, 211);
  }
  score(perso.vertus.foi, 719, 261);
  score(perso.vertus.fidelite, 648, 328);
  score(perso.vertus.bravoure, 785, 328);
  score(perso.statistiques.heroisme, 718, 313);
  const positions = {
    aventurer: [244, 470], sage: [444, 470], prince: [669, 470], sorcier: [916, 470],
    guerrier: [244, 664], poete: [444, 664], malandrin: [669, 664], travailleur: [916, 664],
  };
  const positionsBonus = {
    aventurer: 230, sage: 430, prince: 655, sorcier: 902,
    guerrier: 230, poete: 430, malandrin: 700, travailleur: 930,
  };
  for (const figure of catalogue.figures) {
    const [x, y] = positions[figure.id];
    const rank = perso.ordre_figures.indexOf(figure.id);
    const bonusFigure = regles.competences.bonus_par_rang_figure[rank];
    if (bonusFigure > 0) texte(0, `+${bonusFigure}`, positionsBonus[figure.id], y - 38, { gras: true, size: 12 });
    figure.competence_ids.forEach((id, i) => score(perso.competences[id], x, y + i * 33));
  }
  score(perso.statistiques.initiative_max, 135, 872);
  score(perso.statistiques.trempe, 264, 872);
  score(perso.statistiques.pv, 191, 1348);
  texte(0, perso.parole.nom, 330, 897, { width: 354, size: 9 });

  // The template has no dedicated field for figure order or the hero's passive defence.
  // Keep these generated values together as clearly labelled notes, away from companion fields.
  texte(1, 'Repères de création', 325, 438, { gras: true });
  const bonuses = regles.competences.bonus_par_rang_figure;
  perso.ordre_figures.forEach((id, i) => {
    const figure = catalogue.figures.find(f => f.id === id);
    const bonus = bonuses[i] > 0 ? ` (+${bonuses[i]})` : '';
    texte(1, `${i + 1}. ${figure.nom}${bonus}`, 325, 462 + i * 18, { size: 9 });
  });
  texte(1, `Défense passive : ${perso.statistiques.defense_passive}`, 325, 614, { size: 9, gras: true });
  texte(1, 'À compléter : tirages de finition, équipement et richesse.', 325, 636, { size: 8, width: 600 });
  pdf.setTitle(`Capharnaüm — ${perso.nom}`);
  pdf.setSubject('Personnage créé hors tirages de finition, équipement et richesse');
  pdf.setCreator('Capharnaüm — adaptation du créateur de tut-tuuut');
  return pdf.save();
}
