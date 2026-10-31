# Instructions pour Claude (dépôt erathic-assets)

- Ce dépôt est la mémoire durable des assets d'Erathic Studio. Réponds à Eric en français, de façon concise.
- Avant d'utiliser un asset, lis sa `fiche.json` (licence, famille de squelette, fichiers).
- Quand Eric partage un nouvel asset : suis la procédure d'ingestion décrite dans Notion (page « AI - Knowledge - Assets - Procédure d'ingestion et catalogue ») : trier, licence, inspecter, normaliser, tester, fiche, rangement.
- Ne modifie jamais un asset d'origine ; crée un dérivé dans `derives/` avec une recette et un numéro de version.
- Après chaque ajout : commit clair, mise à jour de `CATALOGUE.md` et de la fiche Notion (champ « Emplacement des fichiers »).
- Ne rends jamais ce dépôt public : plusieurs assets ont une licence inconnue.

## Démarrage et méthode

- Début de session : lire `docs/DEMARRAGE.md`, puis `git status` et `git log` avant de construire quoi que ce soit (du travail non validé peut exister après une coupure de contexte) ; relire l'historique de la conversation si besoin.
- Les apprentissages et pièges sont dans Notion (« AI - Knowledge - Game dev - Apprentissages et pièges ») ; le hub est « AI - Knowledge - Game dev - Système universel ».
- Un refactor, une optimisation ou une généralisation d'un module partagé doit garder identique la trace de `tests/trace.js` du jeu de référence ; mesurer (`tests/bench.js`) avant d'optimiser.
- Aléatoire de jeu : `rand()` de `src/util.js`, jamais `Math.random`. Code modulaire, réglages dans les fichiers `config.js`.
- Un dérivé d'asset (allègement, extraction) passe par l'atelier local (`outils/atelier-mcp`) et va dans `derives/` avec recette, rapport et fiche ; ouvrir le résultat dans l'atelier de visualisation avant de le retenir.
- Valider souvent : commit et push à chaque étape qui marche. Relire le résultat réel avant d'annoncer « fait ».
