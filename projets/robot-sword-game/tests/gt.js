const {chromium}=require('playwright');
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
 const p=await b.newPage({viewport:{width:900,height:520}});
 const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{if(['error','warning'].includes(m.type()))errs.push(m.text().slice(0,200))});
 await p.goto('file://'+process.cwd()+'/index.html'); await p.waitForFunction('window.__game&&window.__game.ready()',{timeout:90000}); await p.waitForTimeout(800);
 await p.evaluate(()=>window.__game.step(95));
 await p.evaluate(()=>{const g=window.__game,S=g.S,pp=g.player.position; const live=g.zombies.filter(z=>!z.dead&&z.state!=='spawn').sort((a,b)=>a.g.position.distanceTo(pp)-b.g.position.distanceTo(pp)); const z=live[0]; S.yaw=Math.atan2(z.g.position.x-pp.x,z.g.position.z-pp.z); g.atk(); g.step(8);});
 let i=0; for(const n of [3,6,12,40]){ await p.evaluate(n=>window.__game.step(n),n); await p.screenshot({path:`/tmp/gore_${i++}.png`}); console.log('pieces',await p.evaluate(()=>window.__game.gore.pieces()),'kills',await p.evaluate(()=>window.__game.S.kills)); }
 errs.length&&console.log(errs.slice(0,5).join('\n')); await b.close();
})();
