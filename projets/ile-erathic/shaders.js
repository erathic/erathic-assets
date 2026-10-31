// Bibliothèque de matériaux Erathic : facettes conservées (flatShading), shaders greffés sur Lambert.
import * as THREE from 'three';

// hauteur de l'île (flottement) partagée par tous les matériaux : le dégradé vertical reste stable
export const SHARED = { uIslandY: { value: 0 } };

// Dégradé diagonal PAR PARTIE : on isole chaque pièce connexe du maillage (une feuille, une touffe...),
// puis on normalise la position le long de la diagonale à l'échelle de cette pièce (0 -> 1).
export function partGradient(mesh, islandInv, dir = [1, -0.6]) {
  const g = mesh.geometry = mesh.geometry.clone();
  const pos = g.attributes.position, n = pos.count;
  const d = new THREE.Vector2(dir[0], dir[1]).normalize();
  const m = new THREE.Matrix4().multiplyMatrices(islandInv, mesh.matrixWorld);
  const idx = g.index ? g.index.array : null, tri = idx ? idx.length : n;
  const parent = new Int32Array(n).fill(0).map((_, i) => i);
  const find = (a) => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; };
  // soudure des sommets confondus (facettes à sommets dupliqués)
  const key = new Map(), q = (v) => Math.round(v * 1e4);
  for (let i = 0; i < n; i++) {
    const k = q(pos.getX(i)) + ',' + q(pos.getY(i)) + ',' + q(pos.getZ(i));
    if (key.has(k)) parent[find(i)] = find(key.get(k)); else key.set(k, i);
  }
  for (let i = 0; i < tri; i += 3) {
    const a = idx ? idx[i] : i, b = idx ? idx[i + 1] : i + 1, c = idx ? idx[i + 2] : i + 2;
    parent[find(b)] = find(a); parent[find(c)] = find(a);
  }
  const v = new THREE.Vector3(), proj = new Float32Array(n);
  const lo = new Map(), hi = new Map();
  for (let i = 0; i < n; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(m);
    const p = v.x * d.x + v.z * d.y, r = find(i); proj[i] = p;
    if (!(lo.has(r) && lo.get(r) <= p)) lo.set(r, p);
    if (!(hi.has(r) && hi.get(r) >= p)) hi.set(r, p);
  }
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) { const r = find(i); out[i] = (proj[i] - lo.get(r)) / Math.max(hi.get(r) - lo.get(r), 1e-4); }
  g.setAttribute('aDiag', new THREE.BufferAttribute(out, 1));
  return new Set(Array.from({ length: n }, (_, i) => find(i))).size;
}

// Fresnel (bords éclaircis) + dégradé vertical par objet (bas plus foncé, haut plus clair), cumulés.
export function fresnelMaterial(base, rim, { power = 1.6, strength = 1.0, low = 1, high = 1, diagA = 1, diagB = 1, glow = 0 } = {}) {
  const m = new THREE.MeshLambertMaterial({ color: new THREE.Color(base), flatShading: true });
  const U = { uYMin: { value: 0 }, uYMax: { value: 1 } };   // bornes de l'objet, réglées après le placement
  m.userData.U = U;
  m.userData.glow = glow;
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uRim = { value: new THREE.Color(rim) };
    sh.uniforms.uPower = { value: power };
    sh.uniforms.uStrength = { value: strength };
    sh.uniforms.uLow = { value: low };
    sh.uniforms.uHigh = { value: high };
    sh.uniforms.uDiagA = { value: diagA }; sh.uniforms.uDiagB = { value: diagB };
    sh.uniforms.uYMin = U.uYMin; sh.uniforms.uYMax = U.uYMax;
    sh.uniforms.uIslandY = SHARED.uIslandY;
    sh.vertexShader = sh.vertexShader
      .replace('void main() {', 'attribute float aDiag; varying float vWY; varying float vDT; uniform float uIslandY;\nvoid main() {')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n vWY = ( modelMatrix * vec4( position, 1.0 ) ).y - uIslandY;\n vDT = aDiag;');
    sh.fragmentShader = sh.fragmentShader
      .replace('void main() {', 'uniform mat4 projectionMatrix; uniform vec3 uRim; uniform float uPower, uStrength, uLow, uHigh, uYMin, uYMax, uDiagA, uDiagB; varying float vWY; varying float vDT;\nvoid main() {')
      .replace('#include <color_fragment>', `#include <color_fragment>
        float vt = clamp( ( vWY - uYMin ) / max( uYMax - uYMin, 0.001 ), 0.0, 1.0 );
        diffuseColor.rgb *= mix( uLow, uHigh, vt );
        float dtg = smoothstep( 0.0, 1.0, vDT );
        diffuseColor.rgb *= mix( uDiagA, uDiagB, dtg );`)
      .replace('#include <opaque_fragment>', `
        vec3 V = ( projectionMatrix[ 3 ][ 3 ] == 1.0 ) ? vec3( 0.0, 0.0, 1.0 ) : normalize( vViewPosition );
        float fres = pow( 1.0 - clamp( dot( normal, V ), 0.0, 1.0 ), uPower );
        // bord éclairci, légèrement modulé par la hauteur pour garder le dégradé vertical
        outgoingLight = mix( outgoingLight, uRim * ( 0.82 + 0.18 * vt ), clamp( fres * uStrength, 0.0, 1.0 ) );
        #include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => 'erathic-fresnel-vgrad';
  return m;
}

// Dégradé en diagonale (espace objet) entre deux couleurs.
export function gradientMaterial(c0, c1, radius, { dir = [1, -0.6], gain = 1.25 } = {}) {
  const m = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uC0 = { value: new THREE.Color(c0) };
    sh.uniforms.uC1 = { value: new THREE.Color(c1) };
    sh.uniforms.uR = { value: radius };
    sh.uniforms.uDir = { value: new THREE.Vector2(dir[0], dir[1]).normalize() };
    sh.uniforms.uGain = { value: gain };
    sh.vertexShader = sh.vertexShader
      .replace('void main() {', 'varying vec3 vGP;\nvoid main() {')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n vGP = position;');
    sh.fragmentShader = sh.fragmentShader
      .replace('void main() {', 'uniform vec3 uC0, uC1; uniform float uR, uGain; uniform vec2 uDir; varying vec3 vGP;\nvoid main() {')
      .replace('#include <color_fragment>', `#include <color_fragment>
        float g = smoothstep( 0.0, 1.0, clamp( 0.5 + uGain * dot( vGP.xz, uDir ) / ( 2.0 * uR ), 0.0, 1.0 ) );
        diffuseColor.rgb = mix( uC0, uC1, g );`);
  };
  m.customProgramCacheKey = () => 'erathic-gradient-diag';
  return m;
}

// Lueur interne en espace écran (pas une lumière), calculée PAR OBJET : chaque objet (userData.gid) a sa propre
// silhouette, rendue seule, donc les objets qui se superposent ne s'influencent pas.
// Matériaux : userData.glow = 1 (groupe jaune) ou 2 (groupe gris).
export function createGlowPass(renderer, scene, camera, { lime, grey, depth = 0.4 }) {
  const rt = (o) => new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, ...o });
  const rtScene = rt({ samples: 4 }), rtObj = rt({ samples: 4 }), rtId = rt({}), rtGlow = rt({});
  rtGlow.scissorTest = false; rtObj.scissorTest = false;
  const sMat = (frag, uni = {}) => new THREE.ShaderMaterial({ uniforms: uni,
    vertexShader: 'void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }', fragmentShader: frag });
  // masque propre à l'objet : r = jaune, g = gris, b = profondeur
  const mk = (r, g) => sMat('uniform vec2 uC; void main(){ gl_FragColor = vec4( uC, gl_FragCoord.z, 1.0 ); }', { uC: { value: new THREE.Vector2(r, g) } });
  const maskMat = [mk(0, 0), mk(1, 0), mk(0, 1)];
  // carte d'identifiants visibles (profondeur testée avec toute la scène) : 0 fond, 100 occulteurs, sinon gid
  const idMats = new Map();
  const idMat = (v) => { if (!idMats.has(v)) idMats.set(v, sMat('uniform float uV; void main(){ gl_FragColor = vec4( uV, 0.0, 0.0, 1.0 ); }', { uV: { value: v } })); return idMats.get(v); };
  const G = (g) => ({ pct: g.pct, pw: g.power, st: g.strength, col: new THREE.Color(g.color) });
  const gl = G(lime), gg = G(grey);
  const fsVert = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
  const glowMat = new THREE.ShaderMaterial({
    uniforms: { tMask: { value: rtObj.texture }, tId: { value: rtId.texture }, uId: { value: 0 }, uStep: { value: new THREE.Vector2() },
                uRL: { value: 10 }, uRG: { value: 10 }, uPL: { value: gl.pw }, uPG: { value: gg.pw },
                uDz: { value: depth / (camera.far - camera.near) }, uSL: { value: gl.st }, uSG: { value: gg.st }, uCL: { value: gl.col }, uCG: { value: gg.col } },
    vertexShader: fsVert,
    fragmentShader: `
      uniform sampler2D tMask, tId; uniform float uId; uniform vec2 uStep; uniform float uRL, uRG, uPL, uPG, uSL, uSG, uDz; uniform vec3 uCL, uCG; varying vec2 vUv;
      float edgeGlow( vec2 sel, float R, float P, float z0 ) {
        float dmin = R + 1.0;
        for ( int i = 0; i < 12; i++ ) {
          float a = float( i ) * 0.5235988; vec2 dir = vec2( cos( a ), sin( a ) );
          float stp = max( 1.0, R / 12.0 );
          for ( int k = 1; k <= 12; k++ ) {
            float r = float( k ) * stp;
            if ( r > R + 0.001 ) break;
            vec4 s = texture2D( tMask, vUv + dir * r * uStep );
            float dz = s.b - z0;
            bool same = dot( s.rg, sel ) > 0.5;
            if ( ( !same && dz > -uDz ) || ( same && dz > uDz ) ) { dmin = min( dmin, r - stp ); break; }
            if ( !same ) break;
          }
        }
        return pow( 1.0 - clamp( dmin / R, 0.0, 1.0 ), P );
      }
      void main() {
        vec4 mk = texture2D( tMask, vUv );
        float idv = texture2D( tId, vUv ).r;
        if ( ! ( abs( idv - uId ) < 0.5 || idv < 0.5 ) ) discard;   // pixel masqué par un autre objet : pas de lueur
        float g = 0.0; vec3 col = uCL;
        if ( mk.r > 0.01 ) { g = edgeGlow( vec2( 1.0, 0.0 ), uRL, uPL, mk.b ) * uSL * mk.r; col = uCL; }
        else if ( mk.g > 0.01 ) { g = edgeGlow( vec2( 0.0, 1.0 ), uRG, uPG, mk.b ) * uSG * mk.g; col = uCG; }
        if ( g <= 0.0 ) discard;
        g = clamp( g, 0.0, 1.0 ); gl_FragColor = vec4( col * g, g );   // prémultiplié
      }`,
    transparent: true, premultipliedAlpha: true, depthTest: false, depthWrite: false,
  });
  const blitMat = new THREE.ShaderMaterial({
    uniforms: { tColor: { value: rtScene.texture }, tGlow: { value: rtGlow.texture } }, vertexShader: fsVert, depthTest: false, depthWrite: false,
    fragmentShader: `uniform sampler2D tColor, tGlow; varying vec2 vUv; void main(){ vec4 c = texture2D( tColor, vUv ); vec4 g = texture2D( tGlow, vUv ); gl_FragColor = vec4( g.rgb + c.rgb * ( 1.0 - g.a ), 1.0 );
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }` });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), glowMat); quad.frustumCulled = false;
  const qScene = new THREE.Scene(); qScene.add(quad);
  const qCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const sz = new THREE.Vector2(), clr = new THREE.Color(), box = new THREE.Box3(), tmp = new THREE.Box3(), v = new THREE.Vector3();
  let pr = 1;
  return {
    enabled: false,
    setSize() {
      renderer.getDrawingBufferSize(sz); pr = renderer.getPixelRatio();
      [rtScene, rtObj, rtId, rtGlow].forEach(r => r.setSize(sz.x, sz.y));
      glowMat.uniforms.uStep.value.set(1 / sz.x, 1 / sz.y);
    },
    render() {
      if (!this.enabled) { renderer.setRenderTarget(null); renderer.render(scene, camera); return; }
      const aut = renderer.autoClear; renderer.getClearColor(clr); const ca = renderer.getClearAlpha();
      const meshes = []; scene.traverse(o => { if (o.isMesh) meshes.push(o); });
      // 1) scène normale (une seule résolution MSAA)
      renderer.autoClear = true; renderer.setRenderTarget(rtScene); renderer.render(scene, camera);
      // 2) identifiants visibles
      const orig = meshes.map(m => m.material);
      meshes.forEach(m => { const mt = idMat(m.userData.gid || 100); m.material = Array.isArray(m.material) ? m.material.map(() => mt) : mt; });
      const dv = meshes.map(m => m.visible); meshes.forEach(m => { if (m.userData.decal) m.visible = false; });
      renderer.setClearColor(0x000000, 1); renderer.setRenderTarget(rtId); renderer.render(scene, camera);
      meshes.forEach((m, i) => { m.material = orig[i]; m.visible = dv[i]; });
      // 3) étendue écran de chaque objet -> rayons -> rectangle
      const byId = new Map(); meshes.forEach(m => { const g = m.userData.gid; if (g) { if (!byId.has(g)) byId.set(g, []); byId.get(g).push(m); } });
      const ext = (bx) => { let a0 = 1e9, b0 = 1e9, a1 = -1e9, b1 = -1e9; if (bx.isEmpty()) return null;
        for (let c = 0; c < 8; c++) { v.set(c & 1 ? bx.max.x : bx.min.x, c & 2 ? bx.max.y : bx.min.y, c & 4 ? bx.max.z : bx.min.z).project(camera);
          const px = (v.x * 0.5 + 0.5) * sz.x, py = (v.y * 0.5 + 0.5) * sz.y; a0 = Math.min(a0, px); a1 = Math.max(a1, px); b0 = Math.min(b0, py); b1 = Math.max(b1, py); }
        return [a0, b0, a1, b1]; };
      const rad = (e, pct) => e ? Math.max(2 * pr, pct * Math.max(e[2] - e[0], e[3] - e[1])) : 2 * pr;
      const objs = [];
      byId.forEach((list, gid) => {
        const boxes = [new THREE.Box3(), new THREE.Box3(), new THREE.Box3()];
        list.forEach(m => { m.updateWorldMatrix(true, false); if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
          const mt = Array.isArray(m.material) ? m.material[0] : m.material; const gk = (mt.userData && mt.userData.glow) || 0;
          tmp.copy(m.geometry.boundingBox).applyMatrix4(m.matrixWorld); boxes[gk].union(tmp); });
        const eL = ext(boxes[1]), eG = ext(boxes[2]); const rL = rad(eL, gl.pct), rG = rad(eG, gg.pct), pad = Math.max(rL, rG) + 3;
        let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
        [eL, eG].forEach(e => { if (e) { x0 = Math.min(x0, e[0]); y0 = Math.min(y0, e[1]); x1 = Math.max(x1, e[2]); y1 = Math.max(y1, e[3]); } });
        if (x0 > x1) return;
        x0 = Math.max(0, Math.floor(x0 - pad)); y0 = Math.max(0, Math.floor(y0 - pad)); x1 = Math.min(sz.x, Math.ceil(x1 + pad)); y1 = Math.min(sz.y, Math.ceil(y1 + pad));
        if (x1 > x0 && y1 > y0) objs.push({ gid, list, rL, rG, r: [x0, y0, x1, y1] });
      });
      // 4) regroupement : les objets dont les rectangles ne se touchent pas partagent une même passe de masque
      const batches = [];
      objs.forEach(o => { const b = batches.find(bt => bt.every(p => o.r[0] >= p.r[2] || o.r[2] <= p.r[0] || o.r[1] >= p.r[3] || o.r[3] <= p.r[1])); if (b) b.push(o); else batches.push([o]); });
      renderer.autoClear = false; renderer.setClearColor(0x000000, 0); renderer.setRenderTarget(rtGlow); renderer.clear();
      const vis = meshes.map(m => m.visible);
      batches.forEach(batch => {
        meshes.forEach(m => { m.visible = false; });
        const lo = [];
        batch.forEach(o => o.list.forEach(m => { m.visible = true; lo.push([m, m.material]);
          const f = mt => maskMat[(mt.userData && mt.userData.glow) || 0]; m.material = Array.isArray(m.material) ? m.material.map(f) : f(m.material); }));
        renderer.setClearColor(0x0000ff, 1); renderer.setRenderTarget(rtObj); renderer.clear(); renderer.render(scene, camera);
        lo.forEach(([m, mt]) => { m.material = mt; });
        meshes.forEach((m, i) => { m.visible = vis[i]; });
        quad.material = glowMat; renderer.setRenderTarget(rtGlow); rtGlow.scissorTest = true;
        batch.forEach(o => { rtGlow.scissor.set(o.r[0], o.r[1], o.r[2] - o.r[0], o.r[3] - o.r[1]);
          glowMat.uniforms.uId.value = o.gid; glowMat.uniforms.uRL.value = o.rL; glowMat.uniforms.uRG.value = o.rG; renderer.render(qScene, qCam); });
        rtGlow.scissorTest = false;
      });
      // 5) affichage : scène + lueurs
      quad.material = blitMat; renderer.setRenderTarget(null); renderer.autoClear = true; renderer.render(qScene, qCam);
      renderer.autoClear = aut; renderer.setClearColor(clr, ca);
    },
  };
}
