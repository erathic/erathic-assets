# Démarrage d'une session

Le dépôt est la seule mémoire durable : le dossier de travail du cloud disparaît à la fin de chaque session. Le détail des apprentissages est dans Notion, page « AI - Knowledge - Game dev - Apprentissages et pièges ».

## 1. Mettre en place

```bash
git clone https://github.com/erathic/erathic-assets && cd erathic-assets
npm install                                   # racine : three, cannon-es, esbuild
(cd outils/atelier-mcp && npm install)        # seulement pour l'atelier local
git status && git log --oneline | head        # AVANT de construire : voir si du travail non validé existe déjà
```

## 2. Construire (depuis `projets/robot-sword-game`)

```bash
bash prepare.sh            # génère les modèles en base64 et copie les clips depuis les assets du dépôt
bash build.sh              # jeu de référence      -> index.html
bash build.sh lab          # atelier de visualisation -> index.lab.html
bash build.sh survie       # niveau de survie      -> index.survie.html
bash build.sh dev          # version non minifiée (profilage) ; "lab dev" pour l'atelier
```

## 3. Tester

```bash
node tests/trace.js index.html      # compare à la référence : refactor et optimisation ne doivent rien changer
node tests/zt2.js ; node tests/zt3.js ; node tests/ui.js ; node tests/ct3.js ; node tests/transitions.js ; node tests/lost.js
node tests/lab.js index.lab.html
node tests/survie.js index.survie.html
node tests/bench.js index.html 4,25,50,100        # coût par image (rendu logiciel : le temps de rendu n'est pas celui d'un GPU)
(cd outils/atelier-mcp && npm test)
```

Les tests utilisent le Playwright et le navigateur du système (ne pas installer Playwright dans le projet). La référence de trace d'un jeu s'obtient avec `node tests/trace.js index.html > trace.txt` sur une version validée.

## 4. Règles qui ont coûté cher à découvrir

- Aléatoire de jeu : toujours `rand()` de `src/util.js` (`seed(n)` pour reproduire) ; jamais `Math.random`, que three.js consomme pour ses identifiants.
- Dans la boucle de jeu : aucune allocation (`hyp` au lieu de `Math.hypot`, tampons réutilisés), pas de `filter` ni de `new Vector3`.
- Un zombie vivant = un seul maillage ; les pièces ne se montrent qu'à la mort. Une ombre ou un matériau par entité est à proscrire (ombres instanciées).
- Modules partagés : toute modification doit garder la trace de `tests/trace.js` identique pour le jeu de référence.
- glTF : `prune` avec `keepLeaves` (le point d'attache `Weapon` est un nœud vide) ; sortie standard réservée au protocole dans un serveur MCP.
- Artefacts : téléchargements via la capacité `downloads` (déclarer avant de republier) ; pas de `fetch` ni de WebSocket externes ; `localStorage` toujours dans un `try`.
- Mesurer avant d'optimiser ; relire le résultat réel avant d'annoncer « fait » ; valider (commit, push) à chaque étape qui marche.

## 5. Où est quoi

| Sujet | Dossier ou fichier |
|---|---|
| Jeu de référence, modules partagés | `projets/robot-sword-game/src` |
| Niveau de survie (vagues, armes, super zombies) | `projets/robot-sword-game/src/survie` |
| Atelier de visualisation | `projets/robot-sword-game/src/lab` |
| Île Erathic de démonstration (logo extrudé, décor) | `projets/ile-erathic` |
| Retarget d'animations | `outils/retarget` |
| Mesure des transitions | `outils/transitions` |
| Atelier local (CLI et MCP) | `outils/atelier-mcp` |
| Assets, fiches, dérivés | `animations`, `personnages`, `modeles`, `logos`, `derives`, `CATALOGUE.md` |
