// Test du serveur MCP avec un client MCP réel (processus séparé, protocole stdio).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const REPO = path.resolve(import.meta.dirname, '../../..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'atelier-mcp-'));
fs.mkdirSync(path.join(tmp, 'personnages/bot_v1'), { recursive: true });
for (const f of ['Character-bot.glb', 'fiche.json']) fs.copyFileSync(path.join(REPO, 'personnages/bot_v1', f), path.join(tmp, 'personnages/bot_v1', f));
const client = new Client({ name: 'test', version: '1.0.0' });
await client.connect(new StdioClientTransport({ command: process.execPath, args: [path.resolve(import.meta.dirname, '../src/mcp.js')], env: { ...process.env, ATELIER_ROOTS: tmp } }));
const call = async (name, args) => { const r = await client.callTool({ name, arguments: args }); const t = r.content[0].text; let j = null; try { j = JSON.parse(t); } catch {} return { r, t, j }; };
const BOT = 'personnages/bot_v1/Character-bot.glb';

test('outils exposés', async () => {
  const { tools } = await client.listTools(); const names = tools.map(t => t.name).sort();
  assert.deepEqual(names, ['atelier_deriver', 'atelier_inspecter', 'atelier_lister', 'atelier_rapport']);
  assert.ok(tools.find(t => t.name === 'atelier_inspecter').annotations.readOnlyHint === true);
  assert.ok(tools.find(t => t.name === 'atelier_deriver').inputSchema.properties.ops);
});
test('lister et inspecter', async () => {
  const l = await call('atelier_lister', {}); assert.ok(l.j.some(a => a.chemin === BOT));
  const i = await call('atelier_inspecter', { chemin: BOT }); assert.equal(i.j.animations, 22); assert.ok(i.j.maillages_les_plus_lourds[0].octets > 100000);
  const a = await call('atelier_inspecter', { chemin: BOT, detail: 'arbre' }); assert.ok(JSON.stringify(a.j.arbre).includes('Weapon'));
});
test('dériver : à blanc puis écrit, rapport relu', async () => {
  const ops = [{ op: 'supprimer', noms: ['Sword'] }, { op: 'simplifier', ratio: 0.6 }, { op: 'compresser', mode: 'quantifier' }];
  const dry = await call('atelier_deriver', { entree: BOT, nom: 'bot_mcp', ops, a_blanc: true }); assert.equal(dry.j.ecrit, false); assert.ok(!fs.existsSync(path.join(tmp, 'derives')));
  const w = await call('atelier_deriver', { entree: BOT, nom: 'bot_mcp', ops }); assert.equal(w.j.ecrit, true); assert.ok(fs.existsSync(path.join(tmp, w.j.fichier)));
  assert.ok(w.j.rapport.variation_octets_pct < -40); assert.deepEqual(w.j.rapport.validation.nouveaux_codes, []);
  const rep = await call('atelier_rapport', { dossier: w.j.dossier }); assert.equal(rep.j.apres.octets, w.j.rapport.apres.octets);
});
test('erreurs : hors racine, opération invalide, sélection vide', async () => {
  const a = await call('atelier_inspecter', { chemin: '/etc/hostname' }); assert.ok(a.r.isError); assert.match(a.t, /hors des dossiers/);
  let rejected = false; try { const b = await call('atelier_deriver', { entree: BOT, nom: 'x', ops: [{ op: 'detruire' }] }); rejected = b.r.isError === true; } catch { rejected = true; } assert.ok(rejected, 'une opération inconnue doit être refusée');
  const c = await call('atelier_deriver', { entree: BOT, nom: 'x', a_blanc: true, ops: [{ op: 'extraire', noms: ['Inexistant'] }] }); assert.ok(c.r.isError); assert.match(c.t, /Aucun nœud/);
});
test.after(async () => { await client.close(); fs.rmSync(tmp, { recursive: true, force: true }); });
