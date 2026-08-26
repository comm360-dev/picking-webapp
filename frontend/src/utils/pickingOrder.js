// Ordre de parcours de l'entrepôt.
//
// Les UGS servent de codes d'emplacement (A2-41, C4-23, B5-43...), et les QR
// codes en sont dérivés (`QR-${sku}`, cf. AdminQRView). Trier sur l'un ou
// l'autre revient donc au même parcours, à condition de retirer le préfixe.
//
// Le tri se faisait auparavant sur le seul `qr_code`. Or ce champ n'est rempli
// qu'à la main depuis « Gestion QR » : il vaut null pour tout produit qui n'y
// est pas passé. Toutes les clés valaient alors '', le comparateur renvoyait 0
// partout, et le tri — stable — laissait la liste dans l'ordre du panier client.
// D'où la cascade ci-dessous : elle ne peut pas retomber à vide, `sku` étant
// NOT NULL en base.

const PREFIXE_QR = /^QR-/i

// Premier champ renseigné, du plus précis au plus général.
export function cleDeParcours(item) {
  if (!item) return ''
  const qr = (item.qr_code || '').replace(PREFIXE_QR, '').trim()
  if (qr) return qr
  return (item.location || '').trim()
    || (item.sku || '').trim()
    || (item.name || '').trim()
}

// `numeric: true` est indispensable : les emplacements mêlent deux et trois
// chiffres (A2-99 et A2-100), qu'un tri texte brut classerait à l'envers.
export function comparerParParcours(a, b) {
  return cleDeParcours(a).localeCompare(cleDeParcours(b), 'fr', {
    numeric: true,
    sensitivity: 'base'
  })
}

export function trierParParcours(items) {
  return [...(items || [])].sort(comparerParParcours)
}
