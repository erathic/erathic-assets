#!/usr/bin/env node
// Serveur MCP (stdio) de l'atelier local : inspecter, alléger et dériver des modèles GLB. Aucune écriture hors de derives/.
// Important : la sortie standard est réservée au protocole ; tous les messages vont sur la sortie d'erreur.
console.log = (...a) => console.error(...a); console.info = console.log; console.warn = console.error;
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import * as core from './core.js';

const server = new McpServer({ name: 'atelier-erathic', version: '0.1.0' });
const text = v => ({ content: [{ type: 'text', text: typeof v === 'string' ? v : JSON.stringify(v, null, 1) }] });
const run = fn => async args => { try { return text(await fn(args)); } catch (e) { return { isError: true, content: [{ type: 'text', text: 'Erreur : ' + e.message }] }; } };
const sel = { noms: z.array(z.string()).optional().describe('noms de nœuds (joker * accepté)'), motif: z.string().optional().describe('un motif de nom avec joker *'), maillages: z.array(z.string()).optional().describe('noms de maillages (les nœuds qui les utilisent)') };

const ops = z.discriminatedUnion('op', [
  z.object({ op: z.literal('supprimer'), ...sel }).describe('retire des nœuds et leurs enfants (les os de squelette sont refusés)'),
  z.object({ op: z.literal('extraire'), ...sel, garder_animations: z.boolean().optional() }).describe('ne garde que la sélection, avec ses ancêtres et son squelette'),
  z.object({ op: z.literal('simplifier'), ratio: z.number().min(0.02).max(1).describe('part de triangles conservée'), erreur: z.number().min(0).max(1).optional(), bord_verrouille: z.boolean().optional() }),
  z.object({ op: z.literal('compresser'), mode: z.enum(['quantifier', 'meshopt', 'draco']).describe('quantifier = sans décodeur ; meshopt et draco demandent un décodeur dans le chargeur') }),
  z.object({ op: z.literal('textures'), taille_max: z.number().int().min(16).max(8192), format: z.enum(['webp', 'jpeg', 'png', 'garder']).optional(), qualite: z.number().int().min(1).max(100).optional() }),
  z.object({ op: z.literal('animations'), garder: z.array(z.string()).optional(), supprimer: z.array(z.string()).optional(), reechantillonner: z.boolean().optional(), tolerance: z.number().optional() }),
  z.object({ op: z.literal('nettoyer') }),
]);

server.registerTool('atelier_lister', { title: 'Lister les modèles', description: 'Liste les fichiers .glb et .gltf des dossiers autorisés (dépôt d\'assets).', inputSchema: { sous_dossier: z.string().optional() }, annotations: { readOnlyHint: true } },
  run(async ({ sous_dossier }) => core.listAssets(sous_dossier || '')));

server.registerTool('atelier_inspecter', { title: 'Inspecter un modèle', description: 'Triangles, poids en octets par maillage, texture et clip, matériaux, extensions ; avec detail=arbre, la hiérarchie des nœuds (os marqués). Sert à repérer ce qui pèse.',
  inputSchema: { chemin: z.string(), detail: z.enum(['resume', 'arbre', 'complet']).optional() }, annotations: { readOnlyHint: true } },
  run(async ({ chemin, detail = 'resume' }) => { const r = await core.inspectFile(chemin, { arbre: detail !== 'resume' }); if (detail === 'complet') return r;
    const top = (a, k, n = 10) => [...a].sort((x, y) => y[k] - x[k]).slice(0, n);
    const o = { fichier: r.fichier, octets_fichier: r.octets_fichier, triangles: r.triangles, noeuds: r.noeuds, maillages: r.maillages, materiaux: r.materiaux, textures: r.textures, animations: r.animations, peaux: r.peaux, extensions: r.extensions,
      maillages_les_plus_lourds: top(r.maillages_detail, 'octets'), textures_detail: r.textures_detail, clips_les_plus_lourds: top(r.animations_detail, 'octets') }; if (r.arbre) o.arbre = r.arbre; return o; }));

server.registerTool('atelier_deriver', { title: 'Créer un dérivé', description: 'Applique une recette (liste ordonnée d\'opérations) à un modèle GLB et écrit un dérivé numéroté dans derives/<nom>_vN/ (GLB, recette.json, rapport.json, fiche.json). L\'original n\'est jamais modifié. Avec a_blanc=true, calcule le rapport sans rien écrire : à faire d\'abord.',
  inputSchema: { entree: z.string().describe('chemin du GLB source'), nom: z.string().describe('nom du dérivé (devient le dossier)'), ops: z.array(ops).min(1), a_blanc: z.boolean().optional() }, annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false } },
  run(async ({ entree, nom, ops, a_blanc }) => core.derive({ entree, nom, ops, a_blanc: !!a_blanc })));

server.registerTool('atelier_rapport', { title: 'Lire le rapport d\'un dérivé', description: 'Relit rapport.json d\'un dossier de dérivé (avant et après, pas, validation).', inputSchema: { dossier: z.string() }, annotations: { readOnlyHint: true } },
  run(async ({ dossier }) => core.readReport(dossier)));

await server.connect(new StdioServerTransport());
console.error('atelier-erathic prêt, racines : ' + core.roots().join(', '));
