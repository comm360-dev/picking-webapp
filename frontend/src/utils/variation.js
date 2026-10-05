// Affichage et scan d'un article qui est une variation (« finition : zingué »).
//
// En base, une variation est un produit à part entière nommé « <parent> – <options> »
// (cf. backend/src/utils/productMapper.js). Sur la boutique, presque aucune n'a d'UGS
// propre : elle porte celle du parent (le code du bac, B1-35) ou aucune. Son UGS en
// base vaut alors `PRODUCT-<id>`, un code technique qui ne dit rien au préparateur et
// qu'aucune étiquette de bac ne porte. D'où ces règles :
//  - le choix du client s'affiche à part, jamais noyé en fin de titre ni tronqué ;
//  - l'UGS affichée est la vraie (celle de la variation, sinon celle du parent) ;
//  - l'étiquette du bac du parent valide le prélèvement, comme avant les variations.

const CODE_TECHNIQUE = /^PRODUCT-\d+$/i
const PREFIXE_QR = /^QR-/i
const SEPARATEUR = ' – '

const propre = (valeur) => (valeur || '').trim()

export function estCodeTechnique(code) {
  return CODE_TECHNIQUE.test(propre(code))
}

// Le choix du client (« zingué », « Berline, Avec »), ou '' pour un produit simple.
export function choixVariation(item) {
  const parent = propre(item?.parent_name)
  const nom = propre(item?.name)
  if (!parent || !nom.startsWith(parent + SEPARATEUR)) return ''
  return nom.slice(parent.length + SEPARATEUR.length).trim()
}

// Le nom sans le choix du client, que `choixVariation` affiche à part.
export function nomProduit(item) {
  return choixVariation(item) ? propre(item.parent_name) : propre(item?.name)
}

// L'UGS de la boutique, ou '' si ni la variation ni son parent n'en ont.
export function ugsReelle(item) {
  const sku = propre(item?.sku)
  if (sku && !estCodeTechnique(sku)) return sku
  const parent = propre(item?.parent_sku)
  if (parent && !estCodeTechnique(parent)) return parent
  return ''
}

// Ce qu'on montre au préparateur : la vraie UGS, à défaut le code technique, seul
// code que la saisie manuelle puisse alors valider.
export function ugsAffichee(item) {
  return ugsReelle(item) || propre(item?.sku)
}

// Tous les codes qui valident le prélèvement de cet article.
export function codesAcceptes(item) {
  const codes = [propre(item?.sku), propre(item?.qr_code).replace(PREFIXE_QR, '')]
  // L'UGS du parent ne vaut que pour une variation sans UGS propre : une variation
  // qui a la sienne a son propre bac.
  if (estCodeTechnique(item?.sku)) codes.push(ugsReelle(item))
  return [...new Set(codes.filter(Boolean).map(code => code.toUpperCase()))]
}

export function codeCorrespond(item, code) {
  const saisi = propre(code).replace(PREFIXE_QR, '').toUpperCase()
  return Boolean(saisi) && codesAcceptes(item).includes(saisi)
}
