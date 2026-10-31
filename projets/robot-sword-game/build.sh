set -e
npx esbuild src/main.js --bundle --minify --format=iife --loader:.json=json --loader:.txt=text --outfile=bundle.js --log-level=warning
python3 -I - <<'Q'
js=open('bundle.js').read().replace('</script','<\\/script')
h=open('index.src.html').read().replace('/*BUNDLE*/',js)
open('index.html','w').write(h); print(len(h)//1024,'Ko')
Q
