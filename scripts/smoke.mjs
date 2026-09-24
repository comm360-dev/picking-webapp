#!/usr/bin/env node
// Test de fumée de l'API sur une base locale synchronisée depuis la préprod.
// Exerce chaque endpoint dans l'ordre d'un vrai parcours, vérifie l'état en base,
// puis remet ce qu'il a touché dans son état initial. Sort en 1 au premier écart.
//
//   node scripts/smoke.mjs              # base telle quelle
//   SMOKE_SYNC=1 node scripts/smoke.mjs # lance d'abord une synchro WooCommerce (lecture seule)
//
// Ne finalise jamais une commande sans article manquant : cela écrirait sur la boutique.

import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const requireBackend = createRequire(path.join(racine, 'backend', 'package.json'));
requireBackend('dotenv').config({ path: path.join(racine, 'backend', '.env'), quiet: true });
const { Pool } = requireBackend('pg');

const API = process.env.SMOKE_API || 'http://localhost:3000/api';
const ADMIN = { email: process.env.SMOKE_ADMIN_EMAIL || 'admin@picking.local', password: process.env.SMOKE_ADMIN_PASSWORD || 'admin123' };
const PREPARATEUR = { email: process.env.SMOKE_PREP_EMAIL || 'preparateur@picking.com', password: process.env.SMOKE_PREP_PASSWORD || 'preparateur123' };

const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL })
  : new Pool({ host: process.env.DB_HOST, port: process.env.DB_PORT, database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD });

const resultats = [];
function check(nom, ok, detail = '') {
  resultats.push({ nom, ok, detail });
  console.log(`${ok ? '  ✓' : '  ✗'} ${nom}${detail ? `  — ${detail}` : ''}`);
  return ok;
}
function section(t) { console.log(`\n▸ ${t}`); }

async function api(method, chemin, { token, body } = {}) {
  const r = await fetch(API + chemin, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  let data = null;
  try { data = await r.json(); } catch { /* corps non JSON */ }
  return { status: r.status, data };
}
const sql = async (q, p = []) => (await pool.query(q, p)).rows;

const comparerUgs = (a, b) => (a || '').localeCompare(b || '', 'fr', { numeric: true, sensitivity: 'base' });

const nettoyage = [];
try {
  section('Sonde');
  {
    const r = await api('GET', '');
    check('GET /api répond', r.status === 200 && r.data?.status === 'operational', `completionStatus=${r.data?.completionStatus}`);
  }

  section('Authentification');
  let admin, prep;
  {
    const mauvais = await api('POST', '/auth/login', { body: { ...ADMIN, password: 'faux' } });
    check('mauvais mot de passe refusé', mauvais.status === 401, `HTTP ${mauvais.status}`);
    const a = await api('POST', '/auth/login', { body: ADMIN });
    admin = a.data?.token;
    check('connexion admin', a.status === 200 && !!admin && a.data.user.role === 'admin');
    const p = await api('POST', '/auth/login', { body: PREPARATEUR });
    prep = p.data?.token;
    check('connexion préparateur', p.status === 200 && !!prep && p.data.user.role === 'preparateur');
    const profil = await api('GET', '/auth/profile', { token: admin });
    check('profil admin', profil.status === 200 && profil.data?.email === ADMIN.email, JSON.stringify(profil.data).slice(0, 80));
    const sans = await api('GET', '/orders');
    check('sans jeton → 401', sans.status === 401);
    const faux = await api('GET', '/orders', { token: 'abc.def.ghi' });
    check('jeton invalide → 401', faux.status === 401);
    const sync = await api('POST', '/products/sync', { token: prep });
    check('préparateur → synchro produits interdite (403)', sync.status === 403, `HTTP ${sync.status}`);
    const setup = await api('GET', '/setup/status');
    check('routes setup gardées', setup.status === 403 || setup.status === 503, `HTTP ${setup.status}`);
    const devisPrep = await api('GET', '/quotes', { token: prep });
    check('préparateur → devis interdits (403)', devisPrep.status === 403, `HTTP ${devisPrep.status}`);

    // Changement de mot de passe, aller-retour : l'ancien est refusé, le nouveau accepté.
    const nouveau = `${PREPARATEUR.password}-tmp`;
    const mauvaisActuel = await api('PUT', '/auth/password', { token: prep, body: { currentPassword: 'faux', newPassword: nouveau } });
    check('changement de mot de passe : mot de passe actuel faux refusé', mauvaisActuel.status === 400 || mauvaisActuel.status === 401, `HTTP ${mauvaisActuel.status}`);
    const chg = await api('PUT', '/auth/password', { token: prep, body: { currentPassword: PREPARATEUR.password, newPassword: nouveau } });
    check('changement de mot de passe accepté', chg.status === 200, `HTTP ${chg.status}`);
    nettoyage.push(async () => {
      const t = (await api('POST', '/auth/login', { body: { email: PREPARATEUR.email, password: nouveau } })).data?.token;
      if (t) await api('PUT', '/auth/password', { token: t, body: { currentPassword: nouveau, newPassword: PREPARATEUR.password } });
    });
    const ancien = await api('POST', '/auth/login', { body: PREPARATEUR });
    check('ancien mot de passe refusé après changement', ancien.status === 401, `HTTP ${ancien.status}`);
    const avecNouveau = await api('POST', '/auth/login', { body: { email: PREPARATEUR.email, password: nouveau } });
    check('nouveau mot de passe accepté', avecNouveau.status === 200 && !!avecNouveau.data?.token);
    prep = avecNouveau.data?.token || prep;
  }

  if (process.env.SMOKE_SYNC) {
    section('Synchronisation WooCommerce (lecture seule côté boutique)');
    const t0 = Date.now();
    const r = await api('POST', '/orders/sync', { token: admin });
    check('synchro réussie', r.status === 200 && r.data?.stats?.products >= 1400, `${JSON.stringify(r.data?.stats)} en ${Math.round((Date.now() - t0) / 1000)} s`);
  }

  section('Commandes');
  const [cible] = await sql(`
    SELECT o.id, o.order_number FROM orders o
    WHERE o.status = 'processing' AND (SELECT count(*) FROM order_items oi WHERE oi.order_id = o.id) >= 3
    ORDER BY o.id LIMIT 1`);
  check('une commande en cours avec ≥ 3 articles existe', !!cible, cible ? `#${cible.order_number} (id ${cible.id})` : 'aucune : lancer avec SMOKE_SYNC=1');
  if (!cible) throw new Error('pas de commande de test');

  {
    const liste = await api('GET', '/orders', { token: prep });
    check('liste des commandes', liste.status === 200 && Array.isArray(liste.data?.orders) && liste.data.orders.some(o => o.id === cible.id), `${liste.data?.count} commandes`);
    const detail = await api('GET', `/orders/${cible.id}`, { token: prep });
    const items = detail.data?.items || [];
    check('détail de la commande avec articles', detail.status === 200 && items.length >= 3, `${items.length} articles`);
    const skus = items.map(i => i.sku);
    const tries = [...skus].sort(comparerUgs);
    check('articles renvoyés dans l\'ordre des emplacements', JSON.stringify(skus) === JSON.stringify(tries), skus.slice(0, 5).join(' → '));
    check('chaque article a un nom et une UGS', items.every(i => i.name && i.sku));
  }

  section('Parcours de préparation (puis remise à zéro)');
  {
    const avantCmd = (await sql('SELECT * FROM orders WHERE id = $1', [cible.id]))[0];
    const avantItems = await sql('SELECT * FROM order_items WHERE order_id = $1 ORDER BY id', [cible.id]);
    const maxHist = (await sql('SELECT coalesce(max(id),0) m FROM order_history'))[0].m;
    nettoyage.push(async () => {
      await sql('UPDATE orders SET status=$2, started_at=$3, prepared_by=$4, held_for_stock=$5, completed_at=$6, picked_by=$7, picked_at=$8, picking_duration=$9 WHERE id=$1',
        [cible.id, avantCmd.status, avantCmd.started_at, avantCmd.prepared_by, avantCmd.held_for_stock, avantCmd.completed_at, avantCmd.picked_by, avantCmd.picked_at, avantCmd.picking_duration]);
      for (const it of avantItems) {
        await sql('UPDATE order_items SET is_picked=$2, picked_quantity=$3, is_missing=$4, notes=$5 WHERE id=$1', [it.id, it.is_picked, it.picked_quantity, it.is_missing, it.notes]);
      }
      await sql('DELETE FROM order_history WHERE id > $1 AND order_id = $2', [maxHist, cible.id]);
    });

    const [i1, i2] = avantItems;
    const start = await api('POST', `/orders/${cible.id}/start`, { token: prep });
    check('démarrage de la préparation', start.status === 200 && start.data?.order?.started_at);

    const pick = await api('PUT', `/orders/${cible.id}/items/${i1.id}/pick`, { token: prep, body: { pickedQuantity: i1.quantity } });
    const rowPick = (await sql('SELECT is_picked, picked_quantity FROM order_items WHERE id=$1', [i1.id]))[0];
    check('article scanné → is_picked', pick.status === 200 && rowPick.is_picked === true && rowPick.picked_quantity === i1.quantity);

    const unpick = await api('PUT', `/orders/${cible.id}/items/${i1.id}/unpick`, { token: prep });
    const rowUnpick = (await sql('SELECT is_picked, picked_quantity FROM order_items WHERE id=$1', [i1.id]))[0];
    check('annulation du scan → remis à zéro', unpick.status === 200 && rowUnpick.is_picked === false && rowUnpick.picked_quantity === 0);

    const partiel = await api('PUT', `/orders/${cible.id}/items/${i1.id}/pick`, { token: prep, body: { pickedQuantity: Math.max(1, i1.quantity - 1) } });
    const rowPartiel = (await sql('SELECT is_picked, picked_quantity FROM order_items WHERE id=$1', [i1.id]))[0];
    check('scan partiel → is_picked reflète quantité atteinte', partiel.status === 200 && rowPartiel.is_picked === (rowPartiel.picked_quantity >= i1.quantity));

    const manquant = await api('PUT', `/orders/${cible.id}/items/${i2.id}/missing`, { token: prep, body: { notes: 'test de fumée' } });
    const rowMissing = (await sql('SELECT is_missing, notes, is_picked FROM order_items WHERE id=$1', [i2.id]))[0];
    check('article manquant → is_missing avec note', manquant.status === 200 && rowMissing.is_missing === true && rowMissing.notes === 'test de fumée');

    const complete = await api('POST', `/orders/${cible.id}/complete`, { token: prep });
    check('finalisation refusée tant qu\'un article manque (409)', complete.status === 409 && complete.data?.code === 'ORDER_HAS_MISSING_ITEMS', `HTTP ${complete.status}`);
    const encore = (await sql('SELECT status FROM orders WHERE id=$1', [cible.id]))[0];
    check('la commande n\'est pas passée terminée', encore.status !== 'completed', encore.status);

    const hold = await api('PUT', `/orders/${cible.id}/hold`, { token: prep });
    const rowHold = (await sql('SELECT status, held_for_stock FROM orders WHERE id=$1', [cible.id]))[0];
    check('mise en attente → on-hold + held_for_stock', hold.status === 200 && rowHold.status === 'on-hold' && rowHold.held_for_stock === true);

    const listeAttente = await api('GET', '/orders?status=on-hold', { token: prep });
    const enAttente = listeAttente.data?.orders?.find(o => o.id === cible.id);
    check('la commande en attente remonte avec ses articles manquants', !!enAttente && Array.isArray(enAttente.items) && enAttente.items.some(i => i.is_missing));

    const reset = await api('PUT', `/orders/${cible.id}/items/${i2.id}/reset-missing`, { token: prep });
    const rowReset = (await sql('SELECT is_missing, notes FROM order_items WHERE id=$1', [i2.id]))[0];
    check('article réapprovisionné → plus manquant', reset.status === 200 && rowReset.is_missing === false && rowReset.notes === null);

    const hist = await api('GET', `/history/order/${cible.id}`, { token: prep });
    const actions = (hist.data?.history || hist.data || []).map(h => h.action);
    check('historique : démarrage et mise en attente tracés', hist.status === 200 && actions.includes('started') && actions.includes('on-hold'), actions.join(', '));
  }

  section('Produits et QR');
  {
    const liste = await api('GET', '/products', { token: prep });
    const attendu = (await sql('SELECT count(*)::int n FROM products p WHERE NOT EXISTS (SELECT 1 FROM products c WHERE c.parent_wc_id = p.wc_id)'))[0].n;
    check('liste produits sans les parents de variations', liste.status === 200 && liste.data?.count === attendu, `${liste.data?.count} = ${attendu}`);
    const [variation] = await sql('SELECT * FROM products WHERE parent_wc_id IS NOT NULL ORDER BY wc_id LIMIT 1');
    if (variation) {
      const parSku = await api('GET', `/products/sku/${encodeURIComponent(variation.sku)}`, { token: prep });
      check('recherche par UGS d\'une variation', parSku.status === 200 && parSku.data?.wc_id === variation.wc_id, variation.name?.slice(0, 50));
      const avant = { qr: variation.qr_code, loc: variation.location };
      nettoyage.push(() => sql('UPDATE products SET qr_code=$2, location=$3 WHERE id=$1', [variation.id, avant.qr, avant.loc]));
      const qrPrep = await api('PUT', `/products/${variation.id}/qr`, { token: prep, body: { qrCode: `QR-${variation.sku}` } });
      check('préparateur ne peut pas poser un QR (403)', qrPrep.status === 403);
      const qr = await api('PUT', `/products/${variation.id}/qr`, { token: admin, body: { qrCode: `QR-${variation.sku}`, location: variation.location || 'Z9-99' } });
      const row = (await sql('SELECT qr_code, location FROM products WHERE id=$1', [variation.id]))[0];
      check('admin pose un QR et un emplacement', qr.status === 200 && row.qr_code === `QR-${variation.sku}` && !!row.location, `${row.qr_code} @ ${row.location}`);
    } else {
      check('au moins une variation en base', false, 'lancer avec SMOKE_SYNC=1');
    }
  }

  section('Devis (créé puis supprimé)');
  {
    const [produit] = await sql('SELECT id, name, sku, price, weight FROM products WHERE price > 0 AND weight > 0 AND parent_wc_id IS NULL ORDER BY id LIMIT 1');
    const cree = await api('POST', '/quotes', { token: admin, body: { customerName: 'Test de fumée', customerEmail: 'fumee@example.com', shippingCountry: 'FR' } });
    const devisId = cree.data?.id;
    check('création d\'un devis', cree.status === 201 && !!devisId && /^DEV-/.test(cree.data.quote_number), cree.data?.quote_number);
    if (devisId) {
      nettoyage.push(() => sql('DELETE FROM quotes WHERE id=$1', [devisId]));
      const ajout = await api('POST', `/quotes/${devisId}/items`, { token: admin, body: { productId: produit.id, quantity: 2, unitPrice: produit.price, weight: produit.weight } });
      check('ajout d\'une ligne produit', ajout.status === 201 || ajout.status === 200, `HTTP ${ajout.status}`);
      const recalc = await api('POST', `/quotes/${devisId}/recalculate`, { token: admin, body: {} });
      const devis = await api('GET', `/quotes/${devisId}`, { token: admin });
      const attendu = Math.round(2 * Number(produit.price) * 100) / 100;
      check('sous-total = quantité × prix', recalc.status === 200 && Math.abs(Number(devis.data?.subtotal) - attendu) < 0.01, `${devis.data?.subtotal} vs ${attendu}`);
      const statut = await api('PUT', `/quotes/${devisId}/status`, { token: admin, body: { status: 'sent' } });
      check('changement de statut du devis', statut.status === 200 && (statut.data?.status === 'sent' || statut.data?.quote?.status === 'sent'));
      // Règle métier : seul un brouillon se supprime, un devis envoyé reste tracé.
      const refus = await api('DELETE', `/quotes/${devisId}`, { token: admin });
      check('un devis envoyé ne se supprime pas (400)', refus.status === 400, `HTTP ${refus.status}`);
      await api('PUT', `/quotes/${devisId}/status`, { token: admin, body: { status: 'draft' } });
      const suppr = await api('DELETE', `/quotes/${devisId}`, { token: admin });
      const reste = await sql('SELECT 1 FROM quotes WHERE id=$1', [devisId]);
      check('suppression d\'un brouillon', suppr.status === 200 && reste.length === 0, `HTTP ${suppr.status}`);
    }
  }

  section('Historique et statistiques');
  {
    const h = await api('GET', '/history', { token: admin });
    check('historique récent', h.status === 200);
    const s = await api('GET', '/history/statistics', { token: admin });
    check('statistiques', s.status === 200);
    const perfPrep = await api('GET', '/history/performance', { token: prep });
    check('performances réservées à l\'admin (403)', perfPrep.status === 403);
  }
} catch (e) {
  check('exécution sans exception', false, e.message);
} finally {
  for (const f of nettoyage.reverse()) { try { await f(); } catch (e) { console.error('  ! nettoyage :', e.message); } }
  await pool.end();
}

const echecs = resultats.filter(r => !r.ok);
console.log(`\n${resultats.length - echecs.length}/${resultats.length} contrôles passés${echecs.length ? ` — ${echecs.length} ÉCHEC(S)` : ''}`);
process.exit(echecs.length ? 1 : 0);
