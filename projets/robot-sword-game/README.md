# Jeu Robot à l'épée (projet de référence)

Source du jeu publié en artefact. Les fichiers lourds (modèles en base64, clips JSON) ne sont pas dans ce dossier : ils sont générés depuis les assets du dépôt.

```bash
npm install                                   # à la racine du dépôt
bash projets/robot-sword-game/prepare.sh      # produit projets/robot-sword-game/index.html
```

Tests automatisés (Playwright, dossier `tests/`, à lancer depuis ce dossier après le build) : `node tests/trace.js` (non-régression déterministe : aléatoire figé, scénario scripté, trace de l'état ; comparer deux builds avec `diff`), `node tests/zt2.js` (parcours jusqu'à la victoire), `node tests/zt3.js` (défaite et rejouer), `node tests/ui.js` (joystick, boutons, clavier), `node tests/ct3.js` (durée des 4 coups du combo).

## Modules (`src/`)

| Fichier | Rôle |
| --- | --- |
| `config.js` | constantes, table du combo, listes d'animations, réglages des zombies, couleur du sang (données seules) |
| `state.js` | état de la partie et remise à zéro |
| `util.js` | interpolation d'angle, décodage base64 |
| `shaders.js`, `materials.js` | shaders Erathic et matériaux partagés |
| `stage.js` | rendu, scène, caméra isométrique et suivi |
| `world.js` | plateforme, ombre douce, arc du coup |
| `input.js` | clavier, joystick, boutons (actions par rappels) |
| `player.js` | chargement et restylage du robot, clips, lecture avec fondu |
| `controller.js` | machine à états du robot, déplacement, combo, pose |
| `zombies.js` | modèle source, apparition, IA, séparation |
| `combat.js` | coup d'épée, dégâts, mort d'un zombie |
| `gore.js` | démembrement, sang, taches, morceaux physiques |
| `ui.js` | points de vie, compteur, fin de partie, rejouer |
| `main.js` | assemblage, boucle de jeu, accès de test `window.__game` |

Les modules partagent un contexte `ctx` créé dans `main.js` ; les liens croisés (combat, zombies, interface) se résolvent à l'appel, sans import circulaire.
Architecture, réglages et historique et réglages : voir la page Notion « Jeu de référence Robot à l'épée ».
