(function () {
  'use strict';

  var versionActuelle;

  function lireVersion() {
    return fetch('/__dev/version', { cache: 'no-store' }).then(function (response) {
      if (!response.ok) throw new Error('Mode développement désactivé');
      return response.json();
    });
  }

  function verifierVersion() {
    lireVersion()
      .then(function (etat) {
        if (versionActuelle !== etat.version) window.location.reload();
      })
      .catch(function () {
        // Le serveur peut être brièvement indisponible pendant son redémarrage.
      });
  }

  // L'endpoint n'existe qu'en développement : aucune interrogation périodique en production.
  lireVersion().then(function (etat) {
    versionActuelle = etat.version;
    window.setInterval(verifierVersion, 1000);
  }).catch(function () {});
}());
