# Atelier local (outils en ligne de commande et serveur MCP)

Inspecte et allège des modèles GLB sans jamais toucher à l'original : chaque modification produit un **dérivé numéroté** dans `derives/<nom>_vN/` (GLB, `recette.json`, `rapport.json`, `fiche.json`). Une seule base de code (`src/core.js`), deux usages : la ligne de commande (`src/cli.js`) et un serveur MCP (`src/mcp.js`) que Claude utilise comme outils quand l'ordinateur est lié.

## Installation sur le Mac

1. Node 20 ou plus : `brew install node` (vérifier avec `node -v`).
2. Le dépôt privé : `git clone https://github.com/erathic/erathic-assets` (ou `git pull` s'il est déjà là).
3. Les dépendances : `cd erathic-assets/outils/atelier-mcp && npm install`.
4. Vérifier : `node --no-warnings src/cli.js inspect personnages/bot_v1/Character-bot.glb`. Les tests : `npm test`.

### Brancher le serveur MCP dans l'app Claude desktop

Éditer `~/Library/Application Support/Claude/claude_desktop_config.json` (le créer s'il n'existe pas ; chemin et format donnés de mémoire, à confirmer pour la version installée de l'app) :

```json
{
  "mcpServers": {
    "atelier-erathic": {
      "command": "/opt/homebrew/bin/node",
      "args": ["/Users/TOI/chemin/erathic-assets/outils/atelier-mcp/src/mcp.js"],
      "env": { "ATELIER_ROOTS": "/Users/TOI/chemin/erathic-assets" }
    }
  }
}
```

- Remplacer `/opt/homebrew/bin/node` par le résultat de `which node`, et `/Users/TOI/chemin` par le vrai chemin.
- `ATELIER_ROOTS` liste les dossiers autorisés, séparés par `:` (sur Windows `;`). On peut y ajouter le dossier des originaux lourds.
- Quitter puis relancer l'app. Les quatre outils `atelier_lister`, `atelier_inspecter`, `atelier_deriver` et `atelier_rapport` apparaissent dans les sessions liées à l'ordinateur.
- Avec Claude Code en ligne de commande : `claude mcp add atelier-erathic -e ATELIER_ROOTS=... -- node /chemin/src/mcp.js` (voir `claude mcp add --help` pour la syntaxe de votre version).

## Ligne de commande

```bash
node --no-warnings src/cli.js list
node --no-warnings src/cli.js inspect personnages/bot_v1/Character-bot.glb --arbre
node --no-warnings src/cli.js derive personnages/bot_v1/Character-bot.glb --nom bot_leger --a-blanc --supprimer Sword --simplifier 0.6 --compresser meshopt
```

Les options de `derive` s'appliquent dans l'ordre écrit : `--supprimer`, `--extraire`, `--simplifier`, `--compresser quantifier|meshopt|draco`, `--textures 1024:webp`, `--garder-clips`, `--supprimer-clips`, `--reechantillonner`, `--nettoyer`, ou `--recette fichier.json`. `--a-blanc` calcule le rapport sans rien écrire : à faire d'abord.

## Opérations

| Opération | Effet | Remarques |
| --- | --- | --- |
| `supprimer` | retire des nœuds et leurs enfants (par nom avec joker `*`, motif ou maillage) | refuse les os de squelette ; les nœuds vides (points d'attache comme `Weapon`) sont conservés |
| `extraire` | ne garde que la sélection, avec ses ancêtres et, pour un maillage skinné, son squelette | animations retirées sauf `garder_animations` |
| `simplifier` | réduit les triangles (`ratio` = part conservée) | à contrôler à l'œil sur les modèles skinnés |
| `compresser` | `quantifier` (KHR_mesh_quantization, sans décodeur), `meshopt` ou `draco` | meshopt et draco demandent un décodeur dans le chargeur (l'atelier a celui de Meshopt ; le jeu pas encore) |
| `textures` | limite la taille, convertit (webp, jpeg, png) | WebP : extension EXT_texture_webp ; KTX2 non pris en charge (outil `toktx` requis) |
| `animations` | garde ou supprime des clips, rééchantillonne | le rééchantillonnage retire les images clés redondantes (tolérance 1e-4) |
| `nettoyer` | fusionne les doublons, retire l'inutilisé | |

## Garde-fous

- Les chemins doivent être dans `ATELIER_ROOTS` (liens symboliques résolus) ; seuls `.glb` et `.gltf` sont lus.
- Aucune écriture hors de `<racine>/derives/` ; un dossier de dérivé n'est jamais écrasé (le numéro de version augmente).
- Jamais de suppression de fichier ; l'original n'est jamais modifié (testé par empreinte).
- La licence se transmet au dérivé (fiche héritée de la base) ; elle reste « inconnue » si la base l'est.
- Le rapport inclut une validation glTF (Khronos) : le dérivé ne doit introduire aucun type d'erreur absent de la base. Le GLB du robot contient déjà des erreurs d'export (indices d'os en double, poids non normalisés) : elles sont signalées, pas aggravées.

## Limites

- Le FBX n'est pas lu (le zombie est en FBX) : conversion préalable nécessaire.
- Le rendu n'est pas jugé par l'outil : ouvrir le dérivé dans l'atelier avant de le retenir.
- Un dérivé retenu demande une ligne dans `CATALOGUE.md` et une fiche Notion (procédure d'ingestion).
