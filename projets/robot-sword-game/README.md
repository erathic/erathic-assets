# Jeu Robot à l'épée (projet de référence)

Source du jeu publié en artefact. Les fichiers lourds (modèles en base64, clips JSON) ne sont pas dans ce dossier : ils sont générés depuis les assets du dépôt.

```bash
npm install                                   # à la racine du dépôt
bash projets/robot-sword-game/prepare.sh      # produit projets/robot-sword-game/index.html
```

Tests automatisés (Playwright, dossier `tests/`) : `node tests/zt2.js` (parcours jusqu'à la victoire), `node tests/zt3.js` (défaite et rejouer), `node tests/ui.js` (joystick, boutons, clavier).
Architecture, réglages et plan de découpage en modules : voir la page Notion « Jeu de référence Robot à l'épée ».
