# Jeu Robot à l'épée (projet de référence)

Source du jeu publié en artefact. Les fichiers lourds (modèles en base64, clips JSON) ne sont pas dans ce dossier : ils sont générés depuis les assets du dépôt.

```bash
npm install                                   # à la racine du dépôt
bash projets/robot-sword-game/prepare.sh      # produit projets/robot-sword-game/index.html
```

Tests automatisés (Playwright, dossier `tests/`, à lancer depuis ce dossier après le build) : `node tests/trace.js` (non-régression déterministe : aléatoire figé, scénario scripté, trace de l'état ; comparer deux builds avec `diff`), `node tests/zt2.js` (parcours jusqu'à la victoire), `node tests/zt3.js` (défaite et rejouer), `node tests/ui.js` (joystick, boutons, clavier), `node tests/ct3.js` (durée des 4 coups du combo), `node tests/transitions.js` (table de transitions : fondus, synchronisation walk/run, vitesses rétablies), `node tests/lost.js` (perte et restauration du contexte WebGL), `node tests/bench.js index.html 4,25,50,100` (banc d'essai de performance, voir plus bas), `node tests/lab.js index.lab.html` (atelier, voir plus bas), `node tests/survie.js index.survie.html` (niveau de survie : 25 vérifications), `tests/measure_robot.js` (mesures sur le robot pour régler les armes : repère de l'épée, pose de visée, instants d'impact).

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

## Atelier (visionneuse d'assets)

Second point d'entrée, `src/lab/` + `lab.src.html`, construit par `bash build.sh lab` (produit `index.lab.html`) ; il réutilise les modules du jeu (matériaux Erathic, chargeur du robot, modèle du zombie, démembrement, table de transitions).

| Fichier | Rôle |
| --- | --- |
| `lab/viewer.js` | rendu, caméra orbitale, lumières du jeu, grille, plateau tournant, vues et planche de contrôle 4 vues |
| `lab/assets.js` | chargeurs : robot, épée du robot (maillage isolé), zombie, épée de démonstration, fichier GLB ou FBX déposé |
| `lab/anim.js` | lecture des clips, curseur de temps, écart de pose entre deux clips, test de transition |
| `lab/tools.js` | inventaire, modes de matériaux, filaire, squelette, boîte, tenue d'arme, démembrement |
| `lab/main.js` | assemblage et panneau |

Fonctions : choix de l'objet ou dépôt d'un fichier (glisser-déposer) ; inventaire (triangles, maillages, os, matériaux, taille) ; matériaux (shaders Erathic, d'origine, gris Erathic, normales) et filaire ; clips groupés par source avec lecture, boucle, vitesse et temps ; transition A vers B avec écart de pose mesuré, fondu proposé par la table du jeu et synchronisation ; tenue d'arme (accrocher un modèle à un os, régler position, rotation et échelle, exporter les réglages en JSON) ; démembrement du zombie ; captures (image de la vue, planche 4 vues). Dans un artefact, l'enregistrement de fichiers passe par la capacité `downloads` (confirmation du lecteur).

## Niveau de survie « Île Erathic »

Troisième point d'entrée (`src/survie/`, `survie.src.html`), construit par `bash build.sh survie` (produit `index.survie.html`). Il réutilise le socle du jeu (scène, robot, zombies, sang, ombres instanciées, entrées) et la scène de `projets/ile-erathic` (logo extrudé, cocotiers et rochers Kenney, shaders Erathic).

**Règles.** Le robot a 14 points de vie (une morsure en retire 1). Des vagues de zombies de plus en plus nombreuses (6, puis +3 par vague, 45 au plus, 26 vivants en même temps), un peu plus rapides et plus résistants au fil du temps. Tous les 10 zombies éliminés, un super zombie apparaît (shader jaune, 1,25 fois plus grand, 1,3 fois plus rapide, 8 points de vie pour le premier puis 3 de plus par super zombie déjà tué) ; en mourant il lâche l'arme suivante, dans l'ordre : épée, épée à deux mains, pistolet, mitrailleuse, canon laser, puis des soins (+4). On part les mains nues ; une arme ramassée remplace la précédente. But : survivre le plus longtemps (vague, éliminés, temps ; meilleur score gardé dans le navigateur).

| Module | Rôle |
| --- | --- |
| `config.js` | données : arène, vagues, super zombie, ordre des drops, animations, table `WEAPONS` |
| `level.js`, `colliders.js` | île heptagonale flottante, logo, cocotiers, rochers ; collisions en cercles et segments (logo, rochers, troncs, bord) |
| `weapons.js` | modèles d'armes accrochés à l'os `Weapon`, équipement |
| `controller.js`, `combat.js` | machine à états pilotée par l'arme (combos de mêlée, tir à l'auto-visée, faisceau laser traversant), dégâts, mort |
| `waves.js`, `pickups.js` | vagues, super zombies, objets à ramasser |
| `ui.js`, `fx.js`, `main.js` | interface (vie, vague, arme, bannières, fin, record), habillage, assemblage |

Armes (dégâts par coup) : mains nues 1 à 2, épée 2 puis 3, épée à deux mains 3, 3, 4 puis 6 (arc large), pistolet 2 (1 tir toutes les 0,38 s), mitrailleuse 1 (9 tirs par seconde, léger écart), canon laser 6 à chaque zombie sur la ligne (1 tir toutes les 1,1 s). Le logo est au fond de l'île (côté opposé à la caméra) pour ne pas masquer l'action. La caméra se règle en jeu : glisser pour la tourner et l'incliner, molette ou pincer pour le zoom, double-clic pour recentrer (le joystick suit l'angle de la caméra). Le tir à distance vise le zombie le plus proche ; tenir le bouton « COUP » (ou J) pour tirer en continu.

Mesures du 2026-10-31 (sans GPU) : vague 1, environ 2,5 ms de logique par image, 123 appels de rendu dont une centaine pour l'île elle-même (décor statique à fusionner si besoin sur téléphone).
