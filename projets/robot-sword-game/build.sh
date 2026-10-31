set -e
# usage : bash build.sh        -> index.html (minifié)
#         bash build.sh dev    -> index.dev.html (non minifié, noms de fonctions lisibles pour le profilage)
#         bash build.sh survie -> index.survie.html (niveau de survie « Île Erathic »)
#         bash build.sh lab    -> index.lab.html (atelier : visionneuse d'assets) ; "lab dev" pour la version non minifiée
ENTRY=src/main.js; SRC=index.src.html; MIN=--minify; OUT=index.html
for a in "$@"; do case $a in dev) MIN=; OUT=${OUT%.html}.dev.html;; lab) ENTRY=src/lab/main.js; SRC=lab.src.html; OUT=index.lab.html;; survie) ENTRY=src/survie/main.js; SRC=survie.src.html; OUT=index.survie.html;; esac; done
npx esbuild $ENTRY --bundle $MIN --format=iife --loader:.json=json --loader:.txt=text --outfile=bundle.js --log-level=warning
OUT=$OUT SRC=$SRC python3 -I - <<'Q'
import os
js=open('bundle.js').read().replace('</script','<\\/script')
h=open(os.environ['SRC']).read().replace('/*BUNDLE*/',js)
out=os.environ['OUT']; open(out,'w').write(h); print(out, len(h)//1024,'Ko')
Q
