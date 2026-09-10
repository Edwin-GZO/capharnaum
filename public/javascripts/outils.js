jQuery(function ($) {
  const storageKey = 'capharnaum.personnages.v1';
  const status = document.getElementById('outils-statut');
  const gallery = document.getElementById('galerie-personnages');
  const npcList = document.getElementById('liste-pnj');
  const titleButton = document.getElementById('proposer-titres');
  const titleContainer = document.getElementById('propositions-titres');

  async function json(url, options) {
    const response = await fetch(window.urlCapharnaum(url), options);
    if (!response.ok) {
      let message = 'La requête a échoué.';
      try { message = (await response.json()).erreur || message; } catch {}
      throw new Error(message);
    }
    return response.json();
  }

  function afficherStatut(message, erreur = false) {
    status.classList.toggle('erreur', erreur);
    status.textContent = message;
  }

  function lireGalerie() {
    try {
      const values = JSON.parse(localStorage.getItem(storageKey) || '[]');
      return Array.isArray(values) ? values.filter(item => item && item.creation && item.id) : [];
    } catch {
      return [];
    }
  }

  function ecrireGalerie(values) {
    localStorage.setItem(storageKey, JSON.stringify(values.slice(0, 50)));
  }

  function bouton(libelle, action, classe = 'button secondary') {
    const element = document.createElement('button');
    element.type = 'button';
    element.className = classe;
    element.textContent = libelle;
    element.addEventListener('click', action);
    return element;
  }

  async function charger(creation) {
    await window.chargerCreationCapharnaum(creation);
    afficherStatut(`${creation.nom} est chargé dans la fiche.`);
    document.getElementById('nom-personnage').focus();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function carte(creation, description, actions) {
    const element = document.createElement('article');
    element.className = 'carte-personnage';
    const nom = document.createElement('strong');
    nom.textContent = creation.nom;
    const details = document.createElement('p');
    details.textContent = description;
    const controls = document.createElement('div');
    controls.className = 'carte-actions';
    actions.forEach(action => controls.appendChild(action));
    element.append(nom, details, controls);
    return element;
  }

  function afficherGalerie() {
    const values = lireGalerie();
    gallery.replaceChildren();
    if (!values.length) {
      const vide = document.createElement('p');
      vide.textContent = 'Aucun personnage sauvegardé.';
      gallery.appendChild(vide);
      return;
    }
    values.forEach(item => {
      const supprimer = bouton('Supprimer', () => {
        ecrireGalerie(lireGalerie().filter(value => value.id !== item.id));
        afficherGalerie();
        afficherStatut(`${item.creation.nom} a été supprimé de la galerie.`);
      });
      const dupliquer = bouton('Dupliquer', () => {
        const copie = structuredClone(item.creation);
        copie.nom = `${copie.nom.slice(0, 92)} (copie)`;
        ecrireGalerie([{ id: `${Date.now()}-${Math.random()}`, creation: copie }, ...lireGalerie()]);
        afficherGalerie();
        afficherStatut(`${copie.nom} a été ajouté à la galerie.`);
      });
      const description = `${item.creation.sang_id} · ${item.creation.origine_id}`;
      gallery.appendChild(carte(item.creation, description, [
        bouton('Charger', () => charger(item.creation).catch(error => afficherStatut(error.message, true)), 'button'),
        bouton('PDF', () => window.telechargerCreationCapharnaum(item.creation).catch(error => afficherStatut(error.message, true))),
        dupliquer,
        supprimer,
      ]));
    });
  }

  document.getElementById('sauvegarder-personnage').addEventListener('click', async () => {
    try {
      const creation = await window.lireCreationCapharnaum();
      await json('/api/personnages/calculer', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(creation),
      });
      ecrireGalerie([{ id: `${Date.now()}-${Math.random()}`, creation }, ...lireGalerie()]);
      afficherGalerie();
      afficherStatut(`${creation.nom} est sauvegardé dans ce navigateur.`);
    } catch (error) {
      afficherStatut(error.message, true);
    }
  });

  document.getElementById('generer-pnj').addEventListener('click', async event => {
    const button = event.currentTarget;
    button.disabled = true;
    button.textContent = 'Génération des PNJ…';
    try {
      const genre = document.getElementById('genre-nom').value;
      const result = await json(`/api/pnj/aleatoires?genre=${encodeURIComponent(genre)}&nombre=5&avec_titre=1`);
      npcList.replaceChildren(...result.pnj.map(pnj => carte(
        pnj.creation,
        `${pnj.sang.nom} · ${pnj.origine.nom} · ${pnj.parole.nom}`,
        [
          bouton('Charger dans la fiche', () => charger(pnj.creation).catch(error => afficherStatut(error.message, true)), 'button'),
          bouton('Sauvegarder', () => {
            ecrireGalerie([{ id: `${Date.now()}-${Math.random()}`, creation: pnj.creation }, ...lireGalerie()]);
            afficherGalerie();
            afficherStatut(`${pnj.nom} est sauvegardé.`);
          }),
        ],
      )));
      npcList.hidden = false;
      afficherStatut('Cinq PNJ ont été générés. Tu peux en charger ou en sauvegarder un.');
    } catch (error) {
      afficherStatut(error.message, true);
    } finally {
      button.disabled = false;
      button.textContent = 'Générer 5 PNJ';
    }
  });

  titleButton.addEventListener('click', async () => {
    const figureElement = document.querySelector('#figures > [id^="fig_"]');
    const figureIndex = Number(figureElement?.id.slice(4));
    if (!Number.isInteger(figureIndex)) return afficherStatut('Classe d’abord les figures.', true);
    titleButton.disabled = true;
    try {
      const catalogue = await json('/api/catalogue');
      const figure = catalogue.figures[figureIndex];
      const result = await json(`/api/titres?figure_id=${encodeURIComponent(figure.id)}&nombre=4`);
      titleContainer.replaceChildren(...result.titres.map(titre => bouton(titre, () => {
        const input = document.getElementById('nom-personnage');
        const nom = input.value.trim().split(',')[0];
        if (!nom) return afficherStatut('Choisis ou saisis d’abord un nom.', true);
        input.value = `${nom}, ${titre}`;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        afficherStatut(`Titre choisi : ${titre}.`);
      }, '')));
      titleContainer.hidden = false;
      afficherStatut(`Titres proposés pour la figure « ${result.figure.nom} ».`);
    } catch (error) {
      afficherStatut(error.message, true);
    } finally {
      titleButton.disabled = false;
    }
  });

  afficherGalerie();
});
