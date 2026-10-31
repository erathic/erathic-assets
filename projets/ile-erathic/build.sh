set -e
npx esbuild main.js --bundle --minify --format=iife --loader:.json=json --outfile=bundle.js --log-level=warning
python3 -I - <<'P'
js=open('bundle.js').read().replace('</script','<\\/script')
html='''<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Île Erathic - test 3D</title>
<style>
html,body{margin:0;height:100%;background:#1E1F22;overflow:hidden}
#app{position:fixed;inset:0}
canvas{display:block;width:100%;height:100%;touch-action:none;cursor:grab}
canvas:active{cursor:grabbing}
#hint{position:fixed;left:24px;bottom:20px;font:600 13px/1.3 Montserrat,system-ui,sans-serif;color:#D9D9D9;letter-spacing:.04em;opacity:0;transition:opacity .8s;pointer-events:none}
#hint b{color:#DBFF00;font-weight:700}
</style></head><body>
<div id="app"></div>
<div id="hint"><b>Glisser</b> pour tourner · <b>molette</b> pour zoomer</div>
<script>'''+js+'''</script></body></html>'''
open('index.html','w').write(html); print(len(html)//1024,'Ko')
P
