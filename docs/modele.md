# Modèle de données

## Relations

Une origine appartient à un Sang (`sang_id`). Chaque Parole possède un rattachement à un Sang et une origine (`origine_id`). Le site permet toutefois de sélectionner toutes les Paroles : l'API conserve ce comportement et n'interprète pas ce rattachement comme une interdiction. Chaque compétence appartient à une figure (`figure_id`), qui expose ses quatre `competence_ids`.

## Bonus

```json
{
  "type": "choix",
  "cibles": ["coordination", "puissance"],
  "valeur": 1,
  "source": "coordination|puissance+1"
}
```

Un bonus `fixe` possède une seule cible. Un bonus `choix` accorde sa valeur à **une seule** des cibles. Le texte original est conservé dans `source`.

La requête de calcul précise chaque choix dans `choix_bonus`, avec la clé `origine:<id>:<index>` ou `parole:<id>:<index>`, où l'index est la position du bonus dans le tableau, à partir de zéro. Exemple : `"origine:malik:0": "coordination"`. Les choix manquants, invalides et superflus sont rejetés.

## Requête de calcul

Voir `examples/personnage.json` pour un exemple complet.

| Champ | Signification |
| --- | --- |
| `nom` | Nom de 1 à 100 caractères |
| `sang_id`, `origine_id`, `parole_id` | Identifiants du catalogue |
| `choix_bonus` | Cibles des bonus au choix ; objet vide ou omis si aucun choix |
| `vertus` | Scores finaux des trois vertus, chacune de 1 à 6, somme 10 |
| `points_caracteristiques` | Points libres **ajoutés** aux bases et bonus ; somme 6 |
| `ordre_figures` | Les huit identifiants, une seule fois chacun, du premier au dernier rang |
| `points_competences` | Points libres **ajoutés** après les bonus, 2 au maximum par compétence ; somme 5 + excédents |

Les clés absentes des deux allocations libres valent zéro. Les valeurs doivent être des entiers positifs ou nuls. Les scores finaux des caractéristiques et compétences sont limités respectivement à 4 et 5, suivant les consignes affichées sur le site. Les huit figures accordent respectivement 3, 2, 1, 1, 1, 0, 0 et 0 points à chacune de leurs quatre compétences.

Les bonus de compétence dépassant 5 avant l'allocation libre sont transférés au budget libre. Exemple : Salonim + cœur sacré de Shirad + Sage au premier rang donnent 2 + 3 + 3 en Science ; Science est ramenée à 5 et le budget libre passe de 5 à 8.

## Résultat et PDF

La réponse expose l'identité, les libellés d'origine, les vertus, les caractéristiques, les compétences, les figures et les statistiques finales. Ces valeurs peuvent alimenter une feuille PDF sans recalcul côté interface. `repartition` explique le budget de compétences et son excédent. `finitions_manquantes` indique les données que le site ne permet pas de compléter.

`POST /api/personnages/pdf` accepte cette même requête de création et remplit le modèle fourni. Les positions de `nom`, `sang.nom`, `origine.nom`, `parole.nom`, `vertus.<id>`, `caracteristiques.<id>`, `competences.<id>` et `statistiques.<id>` sont définies dans `src/pdf.js`. Voir `docs/pdf.md`.
