const {chromium}=require('playwright');
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
 const p=await b.newPage({viewport:{width:900,height:520}});
 const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+process.cwd()+'/index.html'); await p.waitForFunction('window.__game&&window.__game.ready()',{timeout:90000}); await p.waitForTimeout(800);
 await p.evaluate(()=>{window.__game.clearZombies();});
 const seen={}; const hits={0:0.29,1:0.35,2:0.42,3:0.39}; const shot={};
 for(let f=0;f<130;f++){
  const r=await p.evaluate(()=>{const g=window.__game,S=g.S; if(S.state==='ground'&&S.cur!=='') {} g.atk(); g.step(1); return {s:S.state,step:S.step,t:S.atkT,cur:S.cur};});
  if(r.s==='attack'){ seen[r.step]=(seen[r.step]||0)+1; if(!shot[r.step] && r.t>=hits[r.step]){ shot[r.step]=1; await p.screenshot({path:`/tmp/f4_${r.step}.png`}); } }
 }
 console.log('frames par coup',JSON.stringify(seen)); console.log(errs.join('|')||'no errors'); await b.close();
})();
