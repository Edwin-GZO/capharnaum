jQuery(function ($) {
  const button = document.getElementById('telecharger-pdf');
  const randomButton = document.getElementById('generer-aleatoirement');
  const status = document.getElementById('pdf-statut');
  const previewFrame = document.getElementById('apercu-pdf-frame');
  const previewStatus = document.getElementById('apercu-pdf-statut');
  let cataloguePromise;
  let previewUrl;
  let previewTimer;
  let previewRevision = 0;
  let previewController;

  function lireCatalogue() {
    if (!cataloguePromise) {
      cataloguePromise = fetch(window.urlCapharnaum('/api/catalogue')).then(response => {
        if (!response.ok) throw new Error('Impossible de charger le catalogue.');
        return response.json();
      }).catch(error => {
        cataloguePromise = undefined;
        throw error;
      });
    }
    return cataloguePromise;
  }

  // Read current allocations and resolved choices, including edits made after generation.
  function lireCreation(catalogue) {
    const perso = window.perso;
    const origine = catalogue.origines.find(o => o.id === $('#tribu').val());
    const paroleValue = $('#parole').val();
    const parole = paroleValue === '' ? undefined : catalogue.paroles[Number(paroleValue)];
    if (!origine || !parole || !$('#sang').val()) throw new Error('Complète le Sang, l’origine et la Parole.');
    const choix = {};
    for (const [type, entity, values] of [['origine', origine, perso.bonus_sang], ['parole', parole, perso.bonus_parole]]) {
      entity.bonus.forEach((bonus, i) => {
        if (bonus.type !== 'choix') return;
        const cible = bonus.cibles.find(id => Object.hasOwn(values, id));
        if (!cible) throw new Error('Termine les choix de bonus.');
        choix[`${type}:${entity.id}:${i}`] = cible;
      });
    }
    return {
      nom: $('#nom-personnage').val().trim() || 'Personnage sans nom',
      sang_id: $('#sang').val(), origine_id: origine.id, parole_id: parole.id,
      choix_bonus: choix,
      vertus: Object.fromEntries(catalogue.vertus.map(v => [v.id, Number($(`#${v.id}`).val())])),
      ordre_figures: $('#figures').sortable('toArray').map(id => catalogue.figures[Number(id.slice(4))].id),
      points_caracteristiques: { ...perso.bonus_etape_3 },
      points_competences: { ...perso.bonus_etape_5 },
    };
  }

  async function demanderPdf(creation, signal) {
    const response = await fetch(window.urlCapharnaum('/api/personnages/pdf'), {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(creation), signal,
    });
    if (!response.ok) {
      let message = 'Impossible de générer le PDF.';
      try { message = (await response.json()).erreur || message; } catch {}
      throw new Error(message);
    }
    return response.blob();
  }

  function masquerApercu() {
    previewFrame.hidden = true;
    previewFrame.removeAttribute('src');
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = undefined;
  }

  async function actualiserApercu(revision) {
    previewController?.abort();
    previewController = new AbortController();
    try {
      const catalogue = await lireCatalogue();
      const creation = lireCreation(catalogue);
      const blob = await demanderPdf(creation, previewController.signal);
      if (revision !== previewRevision) return;
      const nouvelleUrl = URL.createObjectURL(blob);
      const ancienneUrl = previewUrl;
      previewUrl = nouvelleUrl;
      previewFrame.src = nouvelleUrl;
      previewFrame.hidden = false;
      if (ancienneUrl) URL.revokeObjectURL(ancienneUrl);
      previewStatus.className = 'ok';
      previewStatus.textContent = 'Aperçu à jour.';
    } catch (error) {
      if (error.name === 'AbortError' || revision !== previewRevision) return;
      masquerApercu();
      previewStatus.className = 'erreur';
      previewStatus.textContent = error.message === 'Failed to fetch'
        ? 'Aperçu indisponible : impossible de joindre le serveur.'
        : `Aperçu en attente : ${error.message}`;
    }
  }

  function programmerApercu() {
    const revision = ++previewRevision;
    clearTimeout(previewTimer);
    previewController?.abort();
    previewStatus.className = '';
    previewStatus.textContent = 'Mise à jour de l’aperçu…';
    previewTimer = setTimeout(() => actualiserApercu(revision), 900);
  }

  async function telechargerCreation(creation) {
    const url = URL.createObjectURL(await demanderPdf(creation));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'personnage-capharnaum.pdf';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  window.lireCreationCapharnaum = async () => lireCreation(await lireCatalogue());
  window.telechargerCreationCapharnaum = telechargerCreation;

  const champsSuivis = '#nom-personnage, #sang, #tribu, #parole, #vertus_heroiques input[type=number], #caracteristiques input[type=number], #competences input[type=number]';
  $(document).on('change', champsSuivis, programmerApercu);
  $(document).on('input', '#nom-personnage', programmerApercu);
  $(document).on('click', '#lapopin button', programmerApercu);
  $('#figures').on('sortupdate', programmerApercu);
  window.addEventListener('beforeunload', () => {
    clearTimeout(previewTimer);
    previewController?.abort();
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  });
  programmerApercu();

  button.addEventListener('click', async () => {
    if (button.disabled || randomButton.disabled) return;
    button.disabled = true;
    randomButton.disabled = true;
    button.textContent = 'Préparation du PDF…';
    status.classList.remove('erreur');
    status.textContent = '';
    try {
      const creation = lireCreation(await lireCatalogue());
      await telechargerCreation(creation);
      status.textContent = 'Feuille PDF prête. Les tirages de finition, l’équipement et la richesse restent à compléter.';
    } catch (error) {
      status.classList.add('erreur');
      status.textContent = error.message === 'Failed to fetch' ? 'Impossible de joindre le serveur. Réessaie après l’avoir démarré.' : error.message;
    } finally {
      button.disabled = false;
      randomButton.disabled = false;
      button.textContent = 'Télécharger la feuille PDF';
    }
  });
});
