(function () {
  'use strict';

  var suffixe = '/javascripts/config.js';
  var cheminScript = new URL(document.currentScript.src, window.location.href).pathname;
  var base = cheminScript.endsWith(suffixe) ? cheminScript.slice(0, -suffixe.length) : '';

  window.urlCapharnaum = function (chemin) {
    return base + (chemin.charAt(0) === '/' ? chemin : '/' + chemin);
  };
}());
