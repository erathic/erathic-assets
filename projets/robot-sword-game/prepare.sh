#!/bin/bash
# Prépare le jeu : génère les fichiers base64 et copie les données depuis le dépôt d'assets, puis lance le build.
# Usage (depuis la racine du dépôt) : bash projets/robot-sword-game/prepare.sh
set -e
cd "$(dirname "$0")"
A=../..
base64 -w0 $A/personnages/bot_v1/Character-bot.glb > bot.b64.txt
base64 -w0 $A/personnages/zombie_quaternius_v1/Zombie.fbx > zombie.b64.txt
cp $A/derives/bot_clips_v1/frank_clips.json $A/derives/bot_clips_v1/jumps.json .
ln -sfn $A/node_modules node_modules
bash build.sh
