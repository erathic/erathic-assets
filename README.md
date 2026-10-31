# erathic-assets

Dépôt privé des assets, outils et projets d'Erathic Studio. Il sert de **mémoire durable** entre les sessions de travail : tout ce qui est converti, normalisé ou produit doit y être rangé.

Le catalogue (fiches, licences, statuts, liens entre originaux et dérivés) est dans Notion, page « AI - Knowledge - Assets - Procédure d'ingestion et catalogue ». Ce dépôt en porte les fichiers.

## Structure

| Dossier | Contenu |
|---|---|
| `animations/` | bibliothèques d'animations, un dossier par pack et par version (`ual1_v1`, `ual2_v1`) |
| `personnages/` | personnages riggés (`bot_v1`, `zombie_quaternius_v1`) |
| `modeles/` | décors et objets (`kenney_nature_kit_v1`) |
| `logos/` | logos Erathic (PDF, SVG, couches du pictogramme) |
| `interface/`, `sons/` | à venir |
| `derives/` | conversions, variantes et leurs recettes (`bot_clips_v1`) |
| `outils/` | outils réutilisables (`retarget`) |
| `projets/` | sources des projets (`robot-sword-game`, `ile-erathic`, `erathic-motion`) |

Chaque dossier d'asset contient une `fiche.json` : identifiant (`type.pack.nom`), source, auteur, licence, redistribuable, famille de squelette, fichiers avec empreinte SHA-256 abrégée, lien vers la fiche Notion.

## Charger les assets dans une session

```bash
git clone --depth 1 https://github.com/erathic/erathic-assets
cd erathic-assets && npm install
```

## Règles

1. Un asset d'origine n'est jamais modifié ; une modification devient un dossier dans `derives/` avec sa recette et sa version.
2. Nommage : `type.pack.nom` pour l'identifiant, `pack_vN` pour les dossiers, noms de fichiers en ASCII.
3. Toute fiche indique la licence. Si elle est inconnue, `redistribuable` vaut « à vérifier » et le dépôt reste privé.
4. Les originaux lourds ou non redistribuables (archives complètes, FBX de Frank, versions `_RM`) restent chez Eric (Mac, Drive) : le dépôt garde les versions utiles.
5. Après chaque ajout : mettre à jour la fiche dans Notion (champ « Emplacement des fichiers ») et `CATALOGUE.md`.
