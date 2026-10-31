const {chromium}=require('playwright');
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
 const p=await b.newPage({viewport:{width:900,height:520}});
 const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+process.cwd()+'/index.html'); await p.waitForFunction('window.__game&&window.__game.ready()',{timeout:90000}); await p.waitForTimeout(800);
 await p.evaluate(()=>{window.__game.S.hp=1; window.__game.hud(); window.__game.step(400);});
 console.log('perdu',await p.evaluate(()=>window.__game.S.state+' | '+document.getElementById('end').style.display+' '+document.getElementById('endT').textContent));
 await p.screenshot({path:'/tmp/z_lose.png'});
 await p.click('#bRe'); await p.waitForTimeout(300);
 console.log('rejouer',await p.evaluate(()=>JSON.stringify({hp:window.__game.S.hp,alive:window.__game.alive(),end:document.getElementById('end').style.display,st:window.__game.S.state,kills:window.__game.S.kills})));
 await p.evaluate(()=>window.__game.step(40)); console.log('après',await p.evaluate(()=>window.__game.zombies.map(z=>z.state).join(',')));
 errs.length&&console.log(errs.join('\n')); await b.close();
})();
