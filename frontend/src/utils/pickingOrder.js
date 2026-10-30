import { estCodeTechnique, ugsReelle } from './variation'

// Ordre de parcours de l'entrepôt.
//
// Les UGS servent de codes d'emplacement (A2-41, C4-23, B5-43...) : le préparateur
// suit la liste dans l'ordre alphabétique des UGS qu'il voit à l'écran. On trie donc
// d'abord sur cette UGS (cf. ugsReelle), jamais sur le QR ou l'emplacement enregistrés :
// le client réaffecte ses UGS plusieurs fois par semaine, et ces deux champs peuvent
// garder l'ancienne valeur, ce qui plaçait l'article à son ancien rang.
//
// Une variation sans aucune UGS n'a qu'un code technique (PRODUCT-123), qui n'est pas
// un emplacement : on se rabat alors sur ce qui a été saisi dans Gestion QR.

const PREFIXE_QR = /^QR-/i

export function cleDeParcours(item) {
  if (!item) return ''
  const ugs = ugsReelle(item)
  if (ugs) return ugs
  const qr = (item.qr_code || '').replace(PREFIXE_QR, '').trim()
  if (qr && !estCodeTechnique(qr)) return qr
  return (item.location || '').trim()
    || qr
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
