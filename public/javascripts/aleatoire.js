jQuery(function ($) {
  const button = document.getElementById('generer-aleatoirement');
  const namesButton = document.getElementById('proposer-noms');
  const namesContainer = document.getElementById('propositions-noms');
  const status = document.getElementById('generation-statut');
  let namesRequest = 0;

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
    $('#nom-personnage').val(creation.nom).trigger('input');
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

  function appliquerNom(nom) {
    $('#nom-personnage').val(nom).trigger('input');
    status.classList.remove('erreur');
    status.textContent = `Nom choisi : ${nom}.`;
  }

  async function proposerNoms() {
    const request = ++namesRequest;
    namesButton.disabled = true;
    namesButton.textContent = 'Recherche des noms…';
    status.classList.remove('erreur');
    try {
      const genre = document.getElementById('genre-nom').value;
      const sang = document.getElementById('sang').value || 'saabi';
      const origine = document.getElementById('tribu').value;
      const params = new URLSearchParams({ genre, nombre: '5', sang_id: sang });
      if (origine) params.set('origine_id', origine);
      const result = await lire(`/api/noms?${params}`);
      if (request !== namesRequest) return;
      namesContainer.replaceChildren(...result.noms.map(({ nom }) => {
        const suggestion = document.createElement('button');
        suggestion.type = 'button';
        suggestion.textContent = nom;
        suggestion.addEventListener('click', () => appliquerNom(nom));
        return suggestion;
      }));
      namesContainer.hidden = false;
      status.textContent = 'Choisis un nom parmi les propositions.';
    } catch (error) {
      if (request !== namesRequest) return;
      namesContainer.hidden = true;
      status.classList.add('erreur');
      status.textContent = 'Impossible de proposer des noms pour le moment.';
      console.error(error);
    } finally {
      if (request === namesRequest) {
        namesButton.disabled = false;
        namesButton.textContent = 'Proposer 5 noms';
      }
    }
  }

  namesButton.addEventListener('click', proposerNoms);
  document.getElementById('genre-nom').addEventListener('change', () => {
    if (!namesContainer.hidden) proposerNoms();
  });
  $('#sang, #tribu').on('change', () => {
    if (!namesContainer.hidden) proposerNoms();
  });

  window.chargerCreationCapharnaum = async creation => {
    const [personnage, catalogue, regles] = await Promise.all([
      lire('/api/personnages/calculer', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(creation),
      }),
      lire('/api/catalogue'),
      lire('/api/regles'),
    ]);
    remplir({ creation, personnage }, catalogue, regles);
  };

  button.addEventListener('click', async () => {
    if (button.disabled) return;
    button.disabled = true;
    button.textContent = 'Génération en cours…';
    status.classList.remove('erreur');
    status.textContent = '';
    try {
      const genre = document.getElementById('genre-nom').value;
      const avecTitre = document.getElementById('avec-titre').checked ? '1' : '0';
      const [result, catalogue, regles] = await Promise.all([
        lire(`/api/personnages/aleatoire?genre=${encodeURIComponent(genre)}&avec_titre=${avecTitre}`, { method: 'POST' }),
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
