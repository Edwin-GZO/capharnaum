jQuery(function ($) {
  const button = document.getElementById('telecharger-pdf');
  const randomButton = document.getElementById('generer-aleatoirement');
  const status = document.getElementById('pdf-statut');

  // Read current allocations and resolved choices, including edits made after generation.
  function lireCreation(catalogue) {
    const perso = window.perso;
    const origine = catalogue.origines.find(o => o.id === $('#tribu').val());
    const paroleValue = $('#parole').val();
    const parole = paroleValue === '' ? undefined : catalogue.paroles[Number(paroleValue)];
    if (!origine || !parole || !$('#sang').val()) throw new Error('Génère un personnage ou complète son Sang, son origine et sa Parole avant de télécharger la feuille.');
    const choix = {};
    for (const [type, entity, values] of [['origine', origine, perso.bonus_sang], ['parole', parole, perso.bonus_parole]]) {
      entity.bonus.forEach((bonus, i) => {
        if (bonus.type !== 'choix') return;
        const cible = bonus.cibles.find(id => Object.hasOwn(values, id));
        if (!cible) throw new Error('Termine les choix de bonus avant de télécharger la feuille.');
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

  button.addEventListener('click', async () => {
    if (button.disabled || randomButton.disabled) return;
    button.disabled = true;
    randomButton.disabled = true;
    button.textContent = 'Préparation du PDF…';
    status.classList.remove('erreur');
    status.textContent = '';
    try {
      const catalogueResponse = await fetch('/api/catalogue');
      if (!catalogueResponse.ok) throw new Error('Impossible de préparer la feuille. Vérifie que le serveur est démarré.');
      const creation = lireCreation(await catalogueResponse.json());
      const response = await fetch('/api/personnages/pdf', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(creation),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.erreur || 'Impossible de générer le PDF.');
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = 'personnage-capharnaum.pdf';
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
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
