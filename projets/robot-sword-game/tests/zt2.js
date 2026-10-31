const {chromium}=require('playwright');
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
 const p=await b.newPage({viewport:{width:900,height:520}});
 const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
 await p.goto('file://'+process.cwd()+'/index.html'); await p.waitForFunction('window.__game&&window.__game.ready()',{timeout:90000}); await p.waitForTimeout(800);
 await p.evaluate(()=>window.__game.step(70));
 for(let i=0;i<16;i++){
  const r=await p.evaluate(()=>{const g=window.__game,S=g.S; if(S.over) return {over:true,hp:S.hp,kills:S.kills};
    const pp=g.player.position; const live=g.zombies.filter(z=>!z.dead&&z.state!=='spawn').sort((a,b)=>a.g.position.distanceTo(pp)-b.g.position.distanceTo(pp));
    if(live.length){const z=live[0]; S.yaw=Math.atan2(z.g.position.x-pp.x,z.g.position.z-pp.z);} g.atk(); g.step(28);
    return {hp:S.hp,kills:S.kills,alive:g.alive(),total:g.zombies.length,st:S.state}; });
  console.log(i,JSON.stringify(r)); if(r.over) break; if(i==1) await p.screenshot({path:'/tmp/z_c.png'});
 }
 await p.evaluate(()=>window.__game.step(60)); await p.waitForTimeout(1200);
 console.log('overlay',await p.evaluate(()=>document.getElementById('end').style.display+' '+document.getElementById('endT').textContent+' | '+document.getElementById('endS').textContent));
 await p.screenshot({path:'/tmp/z_end.png'});
 errs.length&&console.log(errs.slice(0,5).join('\n')); await b.close();
})();
