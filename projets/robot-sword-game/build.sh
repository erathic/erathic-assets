set -e
# usage : bash build.sh        -> index.html (minifié)
#         bash build.sh dev    -> index.dev.html (non minifié, noms de fonctions lisibles pour le profilage)
MIN=--minify; OUT=index.html; if [ "$1" = dev ]; then MIN=; OUT=index.dev.html; fi
npx esbuild src/main.js --bundle $MIN --format=iife --loader:.json=json --loader:.txt=text --outfile=bundle.js --log-level=warning
OUT=$OUT python3 -I - <<'Q'
import os
js=open('bundle.js').read().replace('</script','<\\/script')
h=open('index.src.html').read().replace('/*BUNDLE*/',js)
out=os.environ['OUT']; open(out,'w').write(h); print(out, len(h)//1024,'Ko')
Q
