# Interface récupérée

Les 40 fichiers dans `public/` proviennent du [dépôt public de tut-tuuut](https://github.com/tut-tuuut/capharnaum-character-creator), branche `master` : HTML, styles Foundation, scripts jQuery/jQuery UI et images. Les mentions d'origine présentes dans les fichiers sont conservées.

Le fichier `public/index.html` reprend le HTML du site publié sauvegardé dans `data/source/index.html`, avec un bouton de génération aléatoire et son message d'état. Le script `public/javascripts/aleatoire.js` et les styles du bouton sont des ajouts locaux.

`public/javascripts/caph.js` et `data/source/caph.js` utilisent désormais la même version de **master**, figée au [commit 7add31f](https://github.com/tut-tuuut/capharnaum-character-creator/commit/7add31f37fa9715876f44ffba6e2c3d5a9d51c6e). Elle intègre la correction du 15 octobre 2018 pour la Parole `soupcon_traitres` : Sagesse +1, Assassinat +1, Discrétion +1 et Élégance +1. Le catalogue de l'API est régénéré depuis cette source.

L'ancienne version du site publié est conservée dans `data/source/caph-gh-pages.js` uniquement pour comparaison. Elle accordait Arme, Épreuve et Verbe sacré à la place des trois compétences corrigées. Les URLs et empreintes des deux versions sont enregistrées dans `data/provenance.json`.

Le serveur Node sert les fichiers de `public/` et l'interface à `/`. Les sources de l'API et les autres fichiers du projet ne sont pas exposés comme fichiers statiques.

## Périmètre

La mise en page et les interactions originales sont conservées. Le bouton « Générer aléatoirement » appelle `POST /api/personnages/aleatoire`. L'API choisit un Sang, une origine et une Parole rattachée à cette origine, résout les bonus au choix, mélange les figures et répartit les points dans les limites de création, puis valide le résultat avec `calculerPersonnage`.

La présentation des figures reste celle du site original : l'image `bonus_figures.png` indique discrètement les rangs +3, +2, +1 et +0 à droite de la liste. Aucun badge supplémentaire n'est ajouté dans la page. Le classement initial est appliqué aux scores dès le chargement de la fiche.

Pour les compétences, la génération dépense les points libres et les excédents dans la première figure (+3) tant que ses compétences peuvent en recevoir. Elle passe ensuite aux figures suivantes dans l'ordre choisi. Au sein d'une figure, les compétences éligibles sont tirées aléatoirement. Les plafonds restent de 2 points libres par compétence et de 5 au score final. Cette préférence de génération demandée pour le projet ne modifie pas la validation des allocations manuelles et n'est pas une règle officielle attestée par les sources disponibles.

Le script remplace à la fois les champs et l'état de `window.perso` afin de permettre les modifications manuelles après génération. Pendant la requête, le bouton est désactivé ; un échec réseau affiche un message et permet de réessayer. Les modifications manuelles utilisent encore les calculs de `caph.js` ; leurs divergences de validation sont décrites dans `data/regles.json`.

Le champ de nom et le bouton « Télécharger la feuille PDF » utilisent `public/javascripts/pdf.js`. Ce script reconstruit une requête de création depuis les choix actuels et les allocations de `window.perso`, puis appelle `POST /api/personnages/pdf`. Le serveur valide et recalcule les scores avant de remplir le modèle. Les erreurs sont affichées dans la page et le PDF se télécharge sans quitter la fiche.

La même feuille est affichée dans un aperçu intégré en bas de la page. Il est régénéré automatiquement 400 ms après une modification du nom, des choix, des vertus, des caractéristiques, des compétences ou de l'ordre des figures. Une nouvelle modification annule la requête précédente. Si la fiche est incomplète ou invalide, l'ancien aperçu est masqué et le message indique ce qui doit être corrigé.

Les navigateurs modernes chargent les scripts, styles et images depuis le serveur local. Le HTML original contient également une référence conditionnelle historique à HTML5 Shiv, destinée uniquement à Internet Explorer antérieur à la version 9.
