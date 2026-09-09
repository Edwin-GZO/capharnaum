# Capharnaüm : données et API de personnages

Données et interface récupérées depuis [la fiche interactive de tut-tuuut](https://tut-tuuut.github.io/capharnaum-character-creator/), accompagnées d'une API JavaScript Node.js. Le remplissage PDF utilise `pdf-lib`.

Le frontend et le catalogue de l'API utilisent le JavaScript de la branche `master`, figé au commit `7add31f37fa9715876f44ffba6e2c3d5a9d51c6e`, avec la correction de 2018 pour « Le soupçon des traîtres » : Sagesse, Assassinat, Discrétion et Élégance à +1 chacune.

Le catalogue contient **4 Sangs, 18 origines, 19 Paroles, 8 figures, 32 compétences, 5 caractéristiques et 3 vertus**. Les noms et identifiants du site sont conservés, notamment `aventurer`, `periple` et `npplf`.

## Démarrage

Node.js 22 ou supérieur. Installer les dépendances au premier démarrage, puis lancer le mode développement :

```sh
npm ci
npm run dev
```

Ouvrir **http://127.0.0.1:3000/** dans le navigateur pour utiliser l'interface originale : sélection du Sang, de l'origine et de la Parole, répartition des points, classement des figures par glisser-déposer et calcul des statistiques.

`npm run dev` surveille automatiquement `src/`, `data/`, `assets/` et `public/`. Le serveur redémarre après chaque modification et la page ouverte dans le navigateur se recharge dès qu'il est de nouveau disponible.

L'API est disponible sur le même serveur. Variables facultatives : `PORT` et `HOST`. Cette première version calcule les personnages sans les stocker.

Si le port 3000 est occupé, `npm run dev` essaie automatiquement les ports suivants, jusqu'à 3010, et affiche l'adresse à ouvrir. Pour imposer un port : `PORT=3100 npm run dev`. Un port explicitement choisi est respecté ; s'il est occupé, le serveur affiche une erreur claire.

Le bouton **Générer aléatoirement** remplit la fiche avec un personnage validé par l'API : Sang, origine, Parole rattachée à cette origine, bonus au choix, vertus, caractéristiques et figures. Tous les points libres sont répartis, y compris les excédents de compétences. Chaque clic remplace la fiche ; les champs restent modifiables. Les finitions absentes des sources restent à compléter.

Les points libres de compétence sont investis d'abord dans la figure à +3, puis dans les suivantes selon leur classement. Le choix reste aléatoire entre les compétences disponibles d'une même figure, avec au maximum 2 points ajoutés par compétence et un score final de 5. Cette priorité est une préférence de génération du projet ; elle n'est pas présentée comme une obligation des règles officielles.

Pour remplir le modèle PDF fourni, saisir le nom du personnage, générer ou compléter la fiche, puis cliquer sur **Télécharger la feuille PDF**. L'export reprend les choix et allocations actuels, y compris les modifications manuelles, et les valide côté serveur. Une allocation incomplète ou dépassant les limites affiche une erreur. Le nom peut contenir des lettres latines accentuées ; les caractères non pris en charge (comme les emojis) sont signalés.

Sur grand écran, la création occupe la colonne de gauche et l’aperçu PDF reste visible dans la colonne de droite. Sur mobile et tablette, les deux parties sont empilées. L’aperçu est mis à jour automatiquement après les changements apportés à la fiche ; un délai de 900 ms évite de lancer plusieurs générations pendant une même saisie.

## Mise en production

Le démarrage de production est sans surveillance de fichiers et écoute par défaut sur toutes les interfaces réseau :

```sh
npm ci --omit=dev
NODE_ENV=production npm start
```

La plateforme peut fournir `PORT` et `HOST`. La route `/health` sert aux contrôles de disponibilité. Un `Dockerfile` avec utilisateur non privilégié et contrôle de santé est également fourni :

```sh
docker build -t capharnaum .
docker run --rm -p 3000:3000 capharnaum
```

Chaque envoi sur `main` et chaque pull request déclenche les tests Node.js, les tests d’extraction et la construction de l’image Docker dans GitHub Actions.

En production, les fichiers statiques utilisent ETag et un cache navigateur, et le catalogue immuable peut être conservé cinq minutes par les caches HTTP. L’API accepte les appels CORS sans authentification, et les réponses reçoivent des en-têtes de sécurité. Les PDF identiques sont conservés dans un cache mémoire borné à 32 entrées. Leur génération est limitée à 30 requêtes par minute et par adresse IP.

Variables de réglage : `PDF_CACHE_SIZE` (0 à 256), `PDF_RATE_LIMIT` (0 désactive la limite), `PDF_RATE_WINDOW_MS` (1 000 à 3 600 000 ms). Définir `TRUST_PROXY=1` uniquement derrière un reverse proxy fiable qui renseigne lui-même `X-Forwarded-For` ; la limitation utilisera alors l’adresse transmise.

### Déploiement o2switch sous `/capharnaum`

Le serveur accepte le préfixe configuré par `BASE_PATH`. Pour publier le projet sur `https://fantome-dev.fr/capharnaum/`, créer une application dans **Setup Node.js App** avec les réglages suivants :

- **Node.js version** : 22 ;
- **Application mode** : Production ;
- **Application root** : un dossier dédié placé hors du dossier public du domaine ;
- **Application URL** : `fantome-dev.fr`, avec l’URI `/capharnaum` ;
- **Application startup file** : `src/server.js` ;
- variable d’environnement **BASE_PATH** : `/capharnaum` ;
- variable d’environnement **TRUST_PROXY** : `1`.

Cloner ou transférer le dépôt dans l’Application root, puis utiliser l’action cPanel d’installation NPM ou lancer `npm ci --omit=dev` dans l’environnement Node.js indiqué par cPanel. Passenger fournit lui-même le point d’écoute : il ne faut pas lancer `npm start` manuellement sur o2switch. Après l’installation, redémarrer l’application depuis **Setup Node.js App**.

L'interface dans `public/` conserve les calculs du navigateur pour les modifications manuelles et les limites de validation du site. La génération aléatoire utilise l'API et ses contrôles plus stricts. Les styles Foundation, jQuery, jQuery UI et les images sont inclus localement. Voir `docs/frontend.md` pour la provenance.

```sh
curl http://127.0.0.1:3000/api/catalogue
curl 'http://127.0.0.1:3000/api/paroles?origine_id=salonim'
curl -X POST http://127.0.0.1:3000/api/personnages/calculer \
  -H 'Content-Type: application/json' \
  --data-binary @examples/personnage.json
```

## Routes

| Méthode | Route | Contenu / filtres facultatifs |
| --- | --- | --- |
| GET | `/` | Interface web originale |
| GET | `/health` | État du serveur |
| GET | `/api/catalogue` | Catalogue complet |
| GET | `/api/sangs` | Sangs |
| GET | `/api/origines` | Origines ; `sang_id` |
| GET | `/api/paroles` | Paroles ; `sang_id`, `origine_id` |
| GET | `/api/figures` | Figures et compétences associées |
| GET | `/api/competences` | Compétences ; `figure_id` |
| GET | `/api/caracteristiques` | Caractéristiques |
| GET | `/api/vertus` | Vertus |
| GET | `/api/regles` | Règles, formules et limites de la source |
| POST | `/api/personnages/calculer` | Validation et calcul ; exemple dans `examples/personnage.json` |
| POST | `/api/personnages/aleatoire` | Sans corps ; renvoie `creation` (choix et allocations) et `personnage` (scores calculés) |
| POST | `/api/personnages/pdf` | Même JSON que `/calculer` ; renvoie le modèle rempli en `application/pdf` |

Les erreurs de validation renvoient HTTP 422 avec `{ "erreur": "…" }`. JSON malformé : 400 ; format autre que JSON : 415 ; corps supérieur à 64 Kio : 413.

## Données et règles

- `data/capharnaum.json` : catalogue normalisé, directement exploitable indépendamment de l'API.
- `data/regles.json` : transcription manuelle des règles et formules observées ; les écarts entre texte et code y sont explicités.
- `data/provenance.json` : URLs et empreintes SHA-256 des fichiers sources sauvegardés.
- `data/source/` : sources utilisées ; `caph.js` vient de `master`, l'ancienne version publiée est archivée dans `caph-gh-pages.js` et n'est pas utilisée.
- `scripts/extract_data.py` : extraction reproductible des données littérales et libellés HTML ; n'exécute pas le JavaScript distant.
- `docs/modele.md` : structure des bonus, allocations et préparation du PDF.

Pour reconstruire le catalogue **hors ligne** à partir de l'instantané (Python 3.8+) :

```sh
npm run extract
```

Cette commande régénère le catalogue et sa provenance ; elle ne télécharge pas de nouvelles sources et ne réécrit pas les règles transcrites manuellement. Lors d'une actualisation des sources, réexaminer également les formules et les règles.

## Ce qui reste à compléter

Le site mentionne les tables de Sang, de figure principale, des figures, d'héritage des dragons, l'équipement et la richesse, mais ne fournit pas leurs données dans les fichiers examinés. La réponse utilise donc `statut: "creation_hors_finitions"` et énumère les éléments restants. Aucune table n'a été inventée.

L'export utilise le modèle fourni `assets/fiche-personnage-v10ans.pdf` et conserve ses deux pages. Il remplit l'identité, les caractéristiques, vertus, compétences, statistiques de combat et la Parole. L'ordre des figures et la défense passive du personnage sont ajoutés comme repères dans « Légende personnelle » en page 2. Les autres informations restent vierges. Voir `docs/pdf.md` pour le placement et les limites.

## Vérification

```sh
npm test
python3 -m unittest discover -s tests -p 'test_*.py'
```

Les tests couvrent l'extraction, les références entre données, les bonus au choix, les budgets, les excédents, les statistiques finales et les routes HTTP.
