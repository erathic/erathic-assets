# Jeu Robot à l'épée (projet de référence)

Source du jeu publié en artefact. Les fichiers lourds (modèles en base64, clips JSON) ne sont pas dans ce dossier : ils sont générés depuis les assets du dépôt.

```bash
npm install                                   # à la racine du dépôt
bash projets/robot-sword-game/prepare.sh      # produit projets/robot-sword-game/index.html
```

Tests automatisés (Playwright, dossier `tests/`, à lancer depuis ce dossier après le build) : `node tests/trace.js` (non-régression déterministe : aléatoire figé, scénario scripté, trace de l'état ; comparer deux builds avec `diff`), `node tests/zt2.js` (parcours jusqu'à la victoire), `node tests/zt3.js` (défaite et rejouer), `node tests/ui.js` (joystick, boutons, clavier), `node tests/ct3.js` (durée des 4 coups du combo), `node tests/transitions.js` (table de transitions : fondus, synchronisation walk/run, vitesses rétablies), `node tests/lost.js` (perte et restauration du contexte WebGL), `node tests/bench.js index.html 4,25,50,100` (banc d'essai de performance, voir plus bas).

## Modules (`src/`)

| Fichier | Rôle |
| --- | --- |
| `config.js` | constantes, table du combo, listes d'animations, table des transitions, réglages des zombies, couleur du sang (données seules) |
| `transitions.js` | résolution d'une transition (fondu, synchronisation de phase) depuis `TRANSITIONS` |
| `state.js` | état de la partie et remise à zéro |
| `perf.js` | chronomètres par système (inactifs hors banc d'essai) |
| `shadows.js` | ombres douces instanciées (un seul appel de rendu) |
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

## Transitions d'animation

Les durées de fondu ne sont plus dans le code : `TRANSITIONS` (`config.js`) donne une valeur par défaut, une durée par clip d'arrivée (`to`) et des exceptions par paire (`pairs`, par exemple `'walk>run'` avec `sync:true` pour caler la phase des pas). Pour mesurer les écarts de pose entre clips de packs différents et vérifier que les fondus conviennent : `node --no-warnings outils/transitions/pose_gap.mjs` (depuis la racine du dépôt).

## Performance

Banc d'essai : `node tests/bench.js index.html 4,25,50,100` relève, pour N zombies, les millisecondes par image de chaque système (joueur, zombies, mixers, séparation, sang, rendu), les appels de rendu, les triangles et le volume alloué par image (profileur d'allocations du navigateur). `bash build.sh dev` produit `index.dev.html` non minifié pour lire les noms de fonctions du profil. Le rendu se fait en logiciel dans l'environnement de test : le temps de rendu n'est pas représentatif d'un vrai GPU ; les temps de logique donnent un ordre de grandeur (variation d'un passage à l'autre : environ 30 %, parfois du simple au double sur les petites valeurs), les décomptes (appels de rendu, triangles) sont exacts.

Tests déterministes : le jeu a son propre générateur aléatoire (`util.js`, `seed(n)`), indépendant de `Math.random` que three.js consomme pour ses identifiants. `tests/trace.js` compare l'état du jeu image par image entre deux builds.

Optimisations faites (mesures du 2026-10-31, 100 zombies) : un seul maillage par zombie vivant (pièces au moment de la mort), ombres instanciées, animations de foule échelonnées (`ZOMBIE.lod`), plus d'allocation dans la séparation, l'IA et les entrées, décor statique à matrices figées, gestion de la perte de contexte WebGL. Appels de rendu 722 à 123 ; logique des zombies 6,8 à 1,9 ms ; volume alloué 356 à 177 Ko par image.
