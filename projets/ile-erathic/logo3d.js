// Logo extrudé réutilisable : transforme les calques d'un SVG (chemins) en volume recto-verso, sans faces superposées.
// Utilisation : const logo = createExtrudedLogo(items, { height, materialFor, gid }); scene.add(logo);
import * as THREE from 'three';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';

// Spécification du picto Erathic (unités du SVG d'origine, 2000 x 2000). À remplacer pour un autre logo.
export const ERATHIC_PICTO = {
  eye: [1008, 1179],          // point d'origine du logo (centre de l'œil) : devient (0, 0) dans la scène
  bottom: 1682,               // bas du cadre, pour savoir de combien remonter le logo
  height: 1364,               // hauteur totale du logo (haut 318 à bas 1682)
  roles: { '#FFFFFF': 'white', '#CEFF00': 'lime', '#2F2F33': 'dark' },   // couleur du SVG -> rôle de matériau
  // demi-épaisseur de chaque calque (par face), strictement croissante dans l'ordre de dessin : pas de faces coplanaires
  half: { 5: 50, 6: 62, 7: 76, 8: 70, 9: 84, 10: 90, 11: 98 },
  // échelle de chaque calque autour de l'origine : un calque à trou rétrécit pour recouvrir les bords de ce qu'il entoure,
  // un calque qui remplit un trou grossit un peu ; les parois ne coïncident jamais
  scale: { 5: 1, 6: 1, 7: 0.9975, 8: 1.0007, 9: 1, 10: 1.0012, 11: 0.9975 },
};

// items : [{ id, fill, d }] dans l'ordre de dessin. materialFor(role, item) -> THREE.Material (appelé une fois par face).
// Retourne un Group centré sur l'origine du logo, face +z ; group.userData.eyeToBottom = distance monde de l'origine au bas.
export function createExtrudedLogo(items, { height = 3.5, materialFor, gid = 0, spec = ERATHIC_PICTO, curveSegments = 10 } = {}) {
  const LS = height / spec.height, group = new THREE.Group();
  items.forEach(it => {
    const role = spec.roles[it.fill], h = spec.half[it.id], k = spec.scale[it.id] ?? 1;
    const data = new SVGLoader().parse('<svg xmlns="http://www.w3.org/2000/svg"><path fill-rule="nonzero" d="' + it.d + '"/></svg>');
    [1, -1].forEach(side => {                                   // 1 = recto, -1 = verso (copie en miroir, se lit à l'endroit)
      const material = materialFor(role, it);
      data.paths.forEach(p => p.toShapes().forEach(shape => {
        const g = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false, curveSegments });
        g.translate(-spec.eye[0], -spec.eye[1], 0); g.scale(k, k, 1); g.scale(side * LS, -LS, side * LS);   // Y du SVG inversé
        const pa = g.attributes.position.array;                 // déterminant négatif : on retourne l'orientation des triangles
        for (let i = 0; i < pa.length; i += 9) for (let c = 0; c < 3; c++) { const t = pa[i + 3 + c]; pa[i + 3 + c] = pa[i + 6 + c]; pa[i + 6 + c] = t; }
        g.computeVertexNormals();
        const m = new THREE.Mesh(g, material); m.userData.gid = gid; m.userData.role = role; group.add(m);
      }));
    });
  });
  group.userData.eyeToBottom = (spec.bottom - spec.eye[1]) * LS;
  return group;
}
