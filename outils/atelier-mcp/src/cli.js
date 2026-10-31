#!/usr/bin/env node
// Ligne de commande de l'atelier local. Voir README.md.
import fs from 'node:fs';
import * as core from './core.js';

const USAGE = `atelier : modèles GLB, jamais modifiés, dérivés numérotés dans derives/

  atelier list [sous-dossier]
  atelier inspect <fichier> [--arbre] [--json]
  atelier derive <fichier> --nom <nom> [--a-blanc] <opérations...>
  atelier rapport <dossier-du-dérivé>

opérations (appliquées dans l'ordre écrit) :
  --recette <fichier.json>      liste d'opérations au format JSON
  --supprimer <noms|motifs>     nœuds à retirer, séparés par des virgules (joker *)
  --extraire <noms|motifs>      ne garder que ces nœuds (avec leur squelette)
  --simplifier <ratio>          part de triangles conservée, ex. 0.5
  --compresser <mode>           quantifier | meshopt | draco
  --textures <max>[:format]     ex. 1024:webp  (formats : webp, jpeg, png, garder)
  --garder-clips <noms>         ne garder que ces clips (joker *)
  --supprimer-clips <noms>      retirer ces clips
  --reechantillonner            réduire les images clés des animations
  --nettoyer                    fusionner les doublons, retirer l'inutilisé
`;
const list = v => v.split(',').map(s => s.trim()).filter(Boolean);

function parseOps(argv) {
  const ops = []; let nom, aBlanc = false;
  for (let i = 0; i < argv.length; i++) { const a = argv[i], v = () => argv[++i];
    switch (a) {
      case '--nom': nom = v(); break; case '--a-blanc': aBlanc = true; break;
      case '--recette': ops.push(...JSON.parse(fs.readFileSync(v(), 'utf8'))); break;
      case '--supprimer': ops.push({ op: 'supprimer', noms: list(v()) }); break;
      case '--extraire': ops.push({ op: 'extraire', noms: list(v()) }); break;
      case '--simplifier': ops.push({ op: 'simplifier', ratio: parseFloat(v()) }); break;
      case '--compresser': ops.push({ op: 'compresser', mode: v() }); break;
      case '--textures': { const [m, f] = v().split(':'); ops.push({ op: 'textures', taille_max: parseInt(m, 10), format: f || 'webp' }); break; }
      case '--garder-clips': ops.push({ op: 'animations', garder: list(v()) }); break;
      case '--supprimer-clips': ops.push({ op: 'animations', supprimer: list(v()) }); break;
      case '--reechantillonner': ops.push({ op: 'animations', reechantillonner: true }); break;
      case '--nettoyer': ops.push({ op: 'nettoyer' }); break;
      default: throw new Error('Option inconnue : ' + a);
    } }
  return { ops, nom, aBlanc };
}
const kb = n => (n / 1024).toFixed(n > 1048576 ? 0 : 1) + ' Ko';

const [cmd, ...rest] = process.argv.slice(2);
try {
  if (cmd === 'list') console.log(core.listAssets(rest[0] || '').map(a => `${kb(a.octets).padStart(10)}  ${a.chemin}`).join('\n') || '(aucun fichier .glb)');
  else if (cmd === 'inspect') { const r = await core.inspectFile(rest[0], { arbre: rest.includes('--arbre') });
    if (rest.includes('--json')) console.log(JSON.stringify(r, null, 1));
    else { console.log(`${r.fichier} : ${kb(r.octets_fichier)}, ${r.triangles} triangles, ${r.noeuds} nœuds, ${r.maillages} maillages, ${r.materiaux} matériaux, ${r.textures} textures, ${r.animations} clips, ${r.peaux} peau(x)`);
      console.log('extensions : ' + (r.extensions.join(', ') || 'aucune'));
      console.log('\nmaillages les plus lourds :'); [...r.maillages_detail].sort((a, b) => b.octets - a.octets).slice(0, 8).forEach(m => console.log(`  ${kb(m.octets).padStart(9)}  ${String(m.triangles).padStart(6)} tri  ${m.nom}  [${m.materiaux.join(', ')}]`));
      if (r.textures_detail.length) { console.log('\ntextures :'); r.textures_detail.forEach(t => console.log(`  ${kb(t.octets).padStart(9)}  ${t.taille ? t.taille.join('x') : '?'}  ${t.type}  ${t.nom}`)); }
      if (r.animations_detail.length) { console.log('\nclips les plus lourds :'); [...r.animations_detail].sort((a, b) => b.octets - a.octets).slice(0, 8).forEach(a => console.log(`  ${kb(a.octets).padStart(9)}  ${a.duree}s  ${a.nom}`)); }
      if (r.arbre) console.log('\narbre :\n' + (function w(a, d) { return a.map(n => '  '.repeat(d + 1) + n.nom + (n.maillage ? '  [maillage ' + n.maillage + ']' : '') + (n.os ? '  (os)' : '') + '\n' + w(n.enfants, d + 1)).join(''); })(r.arbre, 0)); } }
  else if (cmd === 'derive') { const [fichier, ...opts] = rest; const { ops, nom, aBlanc } = parseOps(opts); if (!ops.length) throw new Error('Aucune opération demandée (voir : atelier sans argument)');
    const r = await core.derive({ entree: fichier, nom, ops, a_blanc: aBlanc }); const p = r.rapport;
    console.log((r.ecrit ? 'Dérivé écrit : ' + r.fichier : 'À blanc (rien écrit)') + `\n  octets     ${kb(p.avant.octets)} -> ${kb(p.apres.octets)}  (${p.variation_octets_pct} %)\n  triangles  ${p.avant.triangles} -> ${p.apres.triangles}  (${p.variation_triangles_pct} %)`);
    p.pas.forEach(s => console.log(`  - ${s.op} : ${s.note}`));
    console.log(`  validation glTF : ${p.validation.erreurs_base} erreur(s) dans la base, ${p.validation.erreurs_derive} dans le dérivé, nouveaux types : ${p.validation.nouveaux_codes.join(', ') || 'aucun'}\n  à faire : ${p.a_verifier}`); }
  else if (cmd === 'rapport') console.log(JSON.stringify(core.readReport(rest[0]), null, 1));
  else console.log(USAGE);
} catch (e) { console.error('Erreur : ' + e.message); process.exitCode = 1; }
