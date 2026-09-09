(function () {
  'use strict';

  var versionActuelle;

  function verifierVersion() {
    fetch('/__dev/version', { cache: 'no-store' })
      .then(function (response) {
        if (!response.ok) throw new Error('Serveur indisponible');
        return response.json();
      })
      .then(function (etat) {
        if (versionActuelle === undefined) {
          versionActuelle = etat.version;
        } else if (versionActuelle !== etat.version) {
          window.location.reload();
        }
      })
      .catch(function () {
        // Le serveur peut être brièvement indisponible pendant son redémarrage.
      });
  }

  verifierVersion();
  window.setInterval(verifierVersion, 1000);
}());
