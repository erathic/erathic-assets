import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import ASSETS from './src_assets.json';
import LOGO from './logo_items.json';
import { createExtrudedLogo } from './logo3d.js';
import { fresnelMaterial, gradientMaterial, SHARED, partGradient, createGlowPass } from './shaders.js';

// --- Charte Erathic v1.0 ---
const C = { noir:'#1E1F22', lime:'#DBFF00', blanc:'#FFFFFF', gris:'#F1F1F3', filet:'#D9D9D9', anthracite:'#2F2F33' };
// bords éclaircis (quasi blanc pour les gris, jaune-vert très clair) + dégradé vertical [bas, haut]
const RIM = { [C.gris]:'#FFFFFF', [C.filet]:'#FCFCFD', [C.lime]:'#EEFF72' };
const VG  = { [C.gris]:[0.28,1.20], [C.filet]:[0.30,1.20], [C.lime]:[0.34,1.10] };
// jaune-vert : dégradé diagonal (clair à gauche, plus foncé à droite) et Fresnel plus large
const EXTRA = { [C.lime]:{ diagA:1.18, diagB:0.5, power:1.05, glow:1 } };
const GLOWG = { [C.gris]:2, [C.filet]:2 };
const mat = (hex, vertical=false)=> RIM[hex]
  ? fresnelMaterial(hex, RIM[hex], { glow:GLOWG[hex]||0, ...(vertical ? { low:VG[hex][0], high:VG[hex][1], ...(EXTRA[hex]||{}) } : {}) })
  : new THREE.MeshLambertMaterial({ color:new THREE.Color(hex), flatShading:true });

const host = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias:true, alpha:false, preserveDrawingBuffer:true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, 2));
renderer.setClearColor(C.noir, 1);
host.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const VIEW = 5.4;
const cam = new THREE.OrthographicCamera(-VIEW, VIEW, VIEW, -VIEW, 4, 40);
cam.position.set(9, 8.2, 9); cam.lookAt(0, -0.4, 0);

scene.add(new THREE.AmbientLight(0xffffff, 0.5));
const sun = new THREE.DirectionalLight(0xffffff, 2.6); sun.position.set(7, 9, 3); scene.add(sun);
const rim = new THREE.DirectionalLight(0xffffff, 1.0); rim.position.set(-7, 2, -4); scene.add(rim);

const island = new THREE.Group(); scene.add(island);
const SEG = 7;
let GID=0;
const cyl = (rt, rb, h, hex, y, rot=0)=>{ const m=new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,SEG,1), mat(hex)); m.userData.gid=++GID; m.position.y=y; m.rotation.y=rot; island.add(m); return m; };

// dalle claire (tranche) + dessus gris-noir + liseré jaune-vert
cyl(3.5,3.5,0.4,C.gris,-0.2);
const top = new THREE.Mesh(new THREE.CylinderGeometry(3.3,3.3,0.06,SEG,1), [mat(C.anthracite), gradientMaterial('#62636C', '#17181B', 3.3, { gain:1.35 }), mat(C.anthracite)]); top.position.y=0.03; island.add(top);
const hex = r => { const pts=[]; for(let i=0;i<SEG;i++){ const th=i/SEG*Math.PI*2; pts.push(new THREE.Vector2(r*Math.sin(th), -r*Math.cos(th))); } return pts; };
const shp = new THREE.Shape(hex(3.28)); shp.holes.push(new THREE.Path(hex(2.98)));
const ringG = new THREE.ExtrudeGeometry(shp,{depth:0.03,bevelEnabled:false}); ringG.rotateX(-Math.PI/2);
const ring = new THREE.Mesh(ringG, new THREE.MeshBasicMaterial({color:C.lime})); ring.position.y=0.06; island.add(ring);
// sous-structure en strates décalées
cyl(3.1,2.6,0.5,C.filet,-0.65,0.2);
cyl(2.5,1.7,0.6,C.gris,-1.2,0.5);
cyl(1.6,0.9,0.7,C.filet,-1.85,0.9);
cyl(0.8,0.15,0.8,C.gris,-2.6,0.3);

// --- Modèles Kenney (CC0) recolorés aux couleurs de la charte ---
const loader = new GLTFLoader();
const MAP = { leafsGreen:C.lime, grass:C.lime, woodBark:C.gris, dirt:C.filet, stone:C.filet, wood:C.gris };
const toBuf = b64 => { const s=atob(b64), a=new Uint8Array(s.length); for(let i=0;i<s.length;i++)a[i]=s.charCodeAt(i); return a.buffer; };
const palms = [];
// --- ombres douces (fausse illumination globale) : taches radiales sous chaque objet, sans shadow map ---
const blobTex = (()=>{ const c=document.createElement('canvas'); c.width=c.height=128; const g=c.getContext('2d');
  const gr=g.createRadialGradient(64,64,0,64,64,64); gr.addColorStop(0,'rgba(255,255,255,1)'); gr.addColorStop(0.35,'rgba(255,255,255,0.55)'); gr.addColorStop(0.7,'rgba(255,255,255,0.14)'); gr.addColorStop(1,'rgba(255,255,255,0)');
  g.fillStyle=gr; g.fillRect(0,0,128,128); const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; return t; })();
const blobGeo = new THREE.PlaneGeometry(1,1).rotateX(-Math.PI/2);
const SUN_DIR = new THREE.Vector2(-7,-3).normalize();           // l'ombre s'étire à l'opposé du soleil
// [rayon contact, opacité contact, rayon ambiant, opacité ambiante, décalage] en multiples de l'échelle de l'objet
const SH = { tree:[0.30,0.55,0.80,0.30,0.30], rock:[0.55,0.50,1.00,0.30,0.20], plant:[0.40,0.45,0.70,0.25,0.15], log:[0.55,0.50,0.95,0.28,0.15] };
function blob(x, z, r, a, color=0x000000){ const m=new THREE.Mesh(blobGeo, new THREE.MeshBasicMaterial({ map:blobTex, color, transparent:true, opacity:a, depthWrite:false }));
  m.scale.set(r*2,1,r*2); m.position.set(x,0.064,z); m.renderOrder=1; m.userData.decal=true; island.add(m); return m; }
function shadowsFor(name,x,z,s){ const k=name.split('_')[0]; const p=SH[k]; if(!p) return;
  blob(x,z,p[0]*s,p[1]); blob(x+SUN_DIR.x*p[4]*s, z+SUN_DIR.y*p[4]*s, p[2]*s, p[3]); }
function place(name, x, z, s, ry, sway=false){
  shadowsFor(name,x,z,s);
  loader.parse(toBuf(ASSETS[name]), '', gltf=>{
    const o = gltf.scene; const gid=++GID; o.traverse(n=>{ if(n.isMesh) n.userData.gid=gid; });
    o.traverse(n=>{ if(n.isMesh){ const k=n.material.name; n.material = mat(MAP[k] || C.filet, true); } });
    o.scale.setScalar(s); o.position.set(x, 0.06, z); o.rotation.y = ry;
    island.add(o); island.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(island.matrixWorld).invert();
    o.traverse(n=>{ if(n.isMesh){ const c = partGradient(n, inv); console.log('parts', name, c); } });
    const bb = new THREE.Box3().setFromObject(o);
    o.traverse(n=>{ if(n.isMesh && n.material.userData.U){ n.material.userData.U.uYMin.value = bb.min.y - island.position.y; n.material.userData.U.uYMax.value = bb.max.y - island.position.y; } });
    if(sway) palms.push({o, ph:Math.random()*6.28, base:ry});
  });
}
// --- Logo Erathic extrudé (module logo3d.js, SVG exact), recto-verso, planté au centre, jaune hors du sol ---
const LOGO_H = 3.5, LOGO_SINK = 0.08;                                  // hauteur monde (2,5 x 1,4), cadre enterré de 0,08
const darkMat = ()=> fresnelMaterial(C.anthracite, '#7C7D87', { power:2.0, strength:0.7, low:0.85, high:1.15 });
const logoGid = ++GID;
const logo = createExtrudedLogo(LOGO, { height:LOGO_H, gid:logoGid,
  materialFor: role => role==='dark' ? darkMat() : role==='lime' ? mat(C.lime, true) : mat(C.gris) });   // shader jaune complet sur le jaune
logo.position.set(0, 0.06 + logo.userData.eyeToBottom - LOGO_SINK, 0); logo.rotation.y = Math.PI/4;   // face à la caméra de départ
island.add(logo); island.updateMatrixWorld(true);
{ const inv = new THREE.Matrix4().copy(island.matrixWorld).invert();
  logo.traverse(n=>{ if(n.isMesh && n.userData.role==='lime') partGradient(n, inv); });      // dégradé diagonal par pièce, comme les feuilles
  const bb = new THREE.Box3().setFromObject(logo);
  logo.traverse(n=>{ if(n.isMesh && n.material.userData.U){ n.material.userData.U.uYMin.value = bb.min.y - island.position.y; n.material.userData.U.uYMax.value = bb.max.y - island.position.y; } }); }
{ const m = new THREE.Mesh(blobGeo, new THREE.MeshBasicMaterial({ map:blobTex, color:0x000000, transparent:true, opacity:0.5, depthWrite:false }));   // ombre allongée au pied du logo
  m.scale.set(4.6,1,1.4); m.rotation.y = Math.PI/4; m.position.set(0,0.064,0); m.renderOrder=1; m.userData.decal=true; island.add(m); }

// --- cocotiers (taille divisée par 2) en couronne autour du logo ; rochers, buissons et tronc dans les intervalles ---
const POL = (r, deg)=>[r*Math.cos(deg*Math.PI/180), r*Math.sin(deg*Math.PI/180)];
[ ['tree_palmTall',20,2.4,0.95], ['tree_palmBend',65,2.2,0.95], ['tree_palmShort',110,2.5,0.9], ['tree_palmDetailedTall',155,2.3,0.85],
  ['tree_palmTall',200,2.6,0.8], ['tree_palmBend',245,2.3,0.9], ['tree_palmShort',290,2.4,0.85], ['tree_palmDetailedTall',335,2.5,0.9]
].forEach(([n,deg,r,s],i)=>{ const [x,z]=POL(r,deg); place(n,x,z,s,i*0.8+0.4,true); });
[ ['rock_largeA',42,2.4,1.1,0.8], ['plant_bush',87,2.2,1.2,0.3], ['log',132,2.3,1.1,1.2], ['rock_smallC',177,2.3,1.1,2.0],
  ['plant_bush',222,2.2,1.1,1.5], ['plant_bush',312,2.1,1.0,0.7], ['rock_smallC',357,2.4,1.0,0.4]
].forEach(([n,deg,r,s,ry])=>{ const [x,z]=POL(r,deg); place(n,x,z,s,ry); });

// --- particules angulaires (cubes) ---
const parts = [];
const pg = new THREE.BoxGeometry(1,1,1);
for(let i=0;i<26;i++){
  const hex = i%4===0 ? C.lime : C.gris;
  const m = new THREE.Mesh(pg, new THREE.MeshBasicMaterial({color:hex}));
  const s = 0.05 + (i*37%10)/10*0.08; m.scale.setScalar(s);
  const a = i*2.399, r = 3.6 + (i*53%10)/10*2.6;
  parts.push({m, a, r, y:-2.5 + (i*29%100)/100*6, sp:0.18+(i%5)*0.05, ph:i});
  scene.add(m);
}

// --- contrôles ---
const controls = new OrbitControls(cam, renderer.domElement);
controls.enablePan=false; controls.enableDamping=true; controls.dampingFactor=0.08;
controls.target.set(0,-0.4,0); controls.minZoom=0.6; controls.maxZoom=2.2;
controls.maxPolarAngle = Math.PI*0.48; controls.minPolarAngle = Math.PI*0.2;
let last=0, idle=0;
controls.addEventListener('start',()=>{ idle=-3; });

const glow = createGlowPass(renderer, scene, cam, { lime:{ pct:0.025, color:'#FBFFE0', strength:0.375, power:1.8 }, grey:{ pct:0.035, color:'#FFFFFF', strength:0.375, power:2.2 } });
function resize(){
  const w=host.clientWidth, h=host.clientHeight, a=w/h;
  renderer.setSize(w,h,false);
  cam.left=-VIEW*a; cam.right=VIEW*a; cam.top=VIEW; cam.bottom=-VIEW;
  if(a<1){ cam.left=-VIEW; cam.right=VIEW; cam.top=VIEW/a; cam.bottom=-VIEW/a; }
  cam.updateProjectionMatrix(); glow.setSize();
}
window.addEventListener('resize', resize); resize();

function update(t, dt){
  idle += dt;
  if(idle>0) island.rotation.y += dt*0.28;
  island.position.y = Math.sin(t*0.9)*0.12; SHARED.uIslandY.value = island.position.y;

  palms.forEach(p=>{ p.o.rotation.z = Math.sin(t*1.1+p.ph)*0.035; });
  parts.forEach(p=>{
    const a=p.a+t*p.sp*0.4, y=((p.y + t*p.sp*0.6 + 2.5) % 6) - 2.5;
    p.m.position.set(Math.cos(a)*p.r, y, Math.sin(a)*p.r);
    p.m.rotation.set(t*0.6+p.ph, t*0.8, 0);
  });
  controls.update();
  glow.render();
}
let T = 0, frozen = false, prev = performance.now();
// compteur de fps (touche F pour afficher/masquer)
const fpsEl = document.createElement('div');
fpsEl.style.cssText = 'position:fixed;left:10px;top:10px;padding:4px 8px;background:#1E1F22;color:#DBFF00;font:12px/1.2 ui-monospace,Menlo,monospace;border:1px solid #DBFF00;z-index:9;pointer-events:none';
fpsEl.textContent = '-- fps'; document.body.appendChild(fpsEl);
window.addEventListener('keydown', e=>{ if(e.key==='g'||e.key==='G') glow.enabled = !glow.enabled; if(e.key==='f'||e.key==='F') fpsEl.style.display = fpsEl.style.display==='none' ? '' : 'none'; });
let fN=0, fT=performance.now(), fMax=0, fLast=performance.now();
function fpsTick(){ const n=performance.now(); fMax=Math.max(fMax,n-fLast); fLast=n; fN++;
  if(n-fT>=500){ fpsEl.textContent = Math.round(fN*1000/(n-fT))+' fps · pire image '+Math.round(fMax)+' ms · lueur '+(glow.enabled?'ON':'OFF')+' (G)'; fN=0; fT=n; fMax=0; } }
renderer.setAnimationLoop(()=>{ fpsTick(); const n=performance.now(), dt=Math.min((n-prev)/1000,0.1); prev=n; if(!frozen){ T+=dt; update(T, dt); } });
// pour un export vidéo image par image
window.__setTime = t => { frozen=true; update(t, 1/30); };

// export boucle : tout est fonction de u in [0,1[ (fréquences entières, image 0 = image N)
const TAU = Math.PI*2;
window.__setLoop = u => {
  frozen = true; idle = -1e9;
  island.rotation.y = TAU*u;
  island.position.y = Math.sin(TAU*u*2)*0.12; SHARED.uIslandY.value = island.position.y;
  palms.forEach(p=>{ p.o.rotation.z = Math.sin(TAU*u*2 + p.ph)*0.035; });
  parts.forEach((p,i)=>{
    const j = i%5, k = [-1,0,1,0,-1][j], c = 1 + (j%2);
    const a = p.a + TAU*u*k, y = (((p.y + 2.5 + 6*u*c) % 6) + 6) % 6 - 2.5;
    p.m.position.set(Math.cos(a)*p.r, y, Math.sin(a)*p.r);
    p.m.rotation.set(TAU*u + p.ph, TAU*u*(1+j%2), 0);
  });
  glow.render();
};
window.__setBg = hex => renderer.setClearColor(hex, 1);
document.getElementById('hint').style.opacity = 1;
setTimeout(()=>{ document.getElementById('hint').style.opacity = 0; }, 6000);
