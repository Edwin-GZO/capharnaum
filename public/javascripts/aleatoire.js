jQuery(function ($) {
  const button = document.getElementById('generer-aleatoirement');
  const status = document.getElementById('generation-statut');

  async function lire(url, options) {
    const response = await fetch(window.urlCapharnaum(url), options);
    if (!response.ok) throw new Error('La génération a échoué. Réessaie dans un instant.');
    return response.json();
  }

  function remplir({ creation }, catalogue, regles) {
    const origine = catalogue.origines.find(o => o.id === creation.origine_id);
    const parole = catalogue.paroles.find(p => p.id === creation.parole_id);
    const sang = catalogue.sangs.find(s => s.id === creation.sang_id);
    const perso = window.perso;

    // Replace the complete legacy state as well as the fields, so subsequent edits work.
    $('#lapopin').trigger('reveal:close');
    $('#sang').val(sang.id);
    $('#libelle_tribu').text(sang.type_origine);
    const tribuSelect = document.getElementById('tribu');
    tribuSelect.replaceChildren(new Option('– Sélectionner…', ''));
    catalogue.origines.filter(o => o.sang_id === sang.id).forEach(o => tribuSelect.add(new Option(o.nom, o.id)));
    $('#tribu').val(origine.id);
    const paroleIndex = catalogue.paroles.indexOf(parole);
    $('#parole').val(String(paroleIndex));
    perso.sang = sang.id;
    perso.tribu = origine.id;
    perso.parole = paroleIndex;
    for (const [type, entity, key] of [['origine', origine, 'bonus_sang'], ['parole', parole, 'bonus_parole']]) {
      perso[key] = {};
      entity.bonus.forEach((bonus, i) => {
        const cible = bonus.type === 'choix' ? creation.choix_bonus[`${type}:${entity.id}:${i}`] : bonus.cibles[0];
        perso[key][cible] = (perso[key][cible] || 0) + bonus.valeur;
      });
    }
    perso.bonus_figure = {};
    creation.ordre_figures.forEach((id, rank) => {
      const index = catalogue.figures.findIndex(f => f.id === id);
      document.getElementById('figures').appendChild(document.getElementById(`fig_${index}`));
      catalogue.figures[index].competence_ids.forEach(skill => {
        perso.bonus_figure[skill] = regles.competences.bonus_par_rang_figure[rank];
      });
    });
    $('#figures').sortable('refresh');
    perso.bonus_etape_3 = { ...creation.points_caracteristiques };
    perso.bonus_etape_5 = { ...creation.points_competences };
    Object.entries(creation.vertus).forEach(([id, value]) => $(`#${id}`).val(value));
    $('#foi').trigger('change');
    $('input[type=number]').removeClass('ok ko error');
    perso.calculeTotaux();
    perso.synchroWithView();
    status.textContent = 'Personnage généré. Tu peux modifier ses choix. Les tirages de finition, l’équipement et la richesse restent à compléter.';
  }

  button.addEventListener('click', async () => {
    if (button.disabled) return;
    button.disabled = true;
    button.textContent = 'Génération en cours…';
    status.classList.remove('erreur');
    status.textContent = '';
    try {
      const [result, catalogue, regles] = await Promise.all([
        lire('/api/personnages/aleatoire', { method: 'POST' }),
        lire('/api/catalogue'),
        lire('/api/regles'),
      ]);
      remplir(result, catalogue, regles);
    } catch (error) {
      status.classList.add('erreur');
      status.textContent = 'Impossible de générer le personnage. Vérifie que le serveur est démarré et réessaie.';
      console.error(error);
    } finally {
      button.disabled = false;
      button.textContent = 'Générer aléatoirement';
    }
  });
});
