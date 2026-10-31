const {chromium}=require('playwright');
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
 const p=await b.newPage({viewport:{width:900,height:520},hasTouch:true,deviceScaleFactor:2});
 const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{if(['error','warning'].includes(m.type()))errs.push(m.text())});
 await p.goto('file://'+process.cwd()+'/index.html'); await p.waitForFunction('window.__game&&window.__game.ready()',{timeout:60000});
 const shot=async n=>{await p.screenshot({path:`/tmp/g_${n}.png`})};
 await p.waitForTimeout(900); await p.evaluate(()=>window.__game.step(20)); await shot('idle');
 await p.evaluate(()=>{window.__game.stick.x=0.9;window.__game.stick.y=-0.3;window.__game.step(30)}); await shot('run');
 await p.evaluate(()=>{window.__game.stick.x=0;window.__game.stick.y=0;window.__game.step(15);window.__game.jump();window.__game.step(10)}); await shot('jump');
 console.log('pos jump',await p.evaluate(()=>window.__game.pos()), await p.evaluate(()=>window.__game.S.state));
 await p.evaluate(()=>window.__game.step(30));
 await p.evaluate(()=>{window.__game.atk();window.__game.step(9)}); await shot('atk');
 console.log('state atk',await p.evaluate(()=>window.__game.S.state));
 await p.evaluate(()=>window.__game.step(30)); console.log('state after',await p.evaluate(()=>window.__game.S.state), await p.evaluate(()=>window.__game.S.cur));
 console.log(errs.slice(0,6).join('\n')||'no errors'); await b.close();
})();
