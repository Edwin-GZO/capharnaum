# Export vers la feuille V10ans

Le modèle `assets/fiche-personnage-v10ans.pdf` est une copie du fichier `Fiche-de-personnage-V10ans.pdf` fourni par l'utilisateur. L'original n'est pas modifié. Il comporte deux pages A4, sans formulaire interactif : `pdf-lib` ajoute du texte aux positions définies dans `src/pdf.js`.

Les coordonnées sont exprimées sur un rendu de référence de 990 × 1400, puis adaptées aux dimensions PDF en points. L'ordonnée représente la ligne de base du texte depuis le haut. Les polices Helvetica et Helvetica Bold sont intégrées. Les textes longs sont réduits pour rester dans leur zone.

| Zone du modèle | Valeur |
| --- | --- |
| Nom | Nom saisi, ou « Personnage sans nom » |
| Sang | Sang et origine |
| Caractéristiques | Les cinq scores finaux |
| Vertus et cercle Héroïsme | Les trois vertus et l'héroïsme calculé |
| Compétences | Les 32 scores, chacun dans la ligne correspondante |
| Titres des figures | Bonus de rang positifs (+3, +2 ou +1) près de chaque titre ; les +0 sont masqués |
| Combat | Initiative maximale, Trempe et PV |
| Parole / Technique | Nom de la Parole ; ses effets de niveaux restent vierges |
| Légende personnelle, page 2 | Repères de création : ordre des figures, bonus de rang et défense passive du personnage |

Les dés des dragons, P.A., statut, occupation, caractéristiques physiques, résistances, armes, compagnon, contacts, équipement et richesse ne sont pas renseignés : aucune valeur correspondante n'est calculée par le projet. Les valeurs de combat du personnage ne sont pas placées dans les cases du compagnon.

L'API reçoit les choix et allocations, pas des scores finaux arbitraires. Elle les valide avec `calculerPersonnage`, puis produit les deux pages du modèle. Les modifications manuelles invalides doivent être corrigées avant l'export. Les caractères hors de l'encodage de la police sont refusés avec une erreur explicite plutôt que remplacés silencieusement.

Exemple :

```sh
curl -X POST http://127.0.0.1:3000/api/personnages/pdf \
  -H 'Content-Type: application/json' \
  --data-binary @examples/personnage.json \
  --output personnage.pdf
```

Un exemple rempli est disponible dans `examples/feuille-personnage.pdf`.
