# Instructions pour Claude (dépôt erathic-assets)

- Ce dépôt est la mémoire durable des assets d'Erathic Studio. Réponds à Eric en français, de façon concise.
- Avant d'utiliser un asset, lis sa `fiche.json` (licence, famille de squelette, fichiers).
- Quand Eric partage un nouvel asset : suis la procédure d'ingestion décrite dans Notion (page « AI - Knowledge - Assets - Procédure d'ingestion et catalogue ») : trier, licence, inspecter, normaliser, tester, fiche, rangement.
- Ne modifie jamais un asset d'origine ; crée un dérivé dans `derives/` avec une recette et un numéro de version.
- Après chaque ajout : commit clair, mise à jour de `CATALOGUE.md` et de la fiche Notion (champ « Emplacement des fichiers »).
- Ne rends jamais ce dépôt public : plusieurs assets ont une licence inconnue.
