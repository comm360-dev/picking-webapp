// Traduit un produit ou une variation WooCommerce en ligne de la table products.
// Une variation devient un produit à part entière : son nom complet, sa photo, son
// poids, son stock, sa propre étiquette QR — c'est elle que le préparateur prélève.

const proxyImage = (src) => (src ? `/api/image-proxy?url=${encodeURIComponent(src)}` : null);

function nomDeVariation(parent, variation) {
  const options = (variation.attributes || []).map(a => a.option).filter(Boolean).join(', ');
  return options ? `${parent.name} – ${options}` : parent.name;
}

function mapProduct(wc) {
  return {
    wc_id: wc.id,
    parent_wc_id: null,
    name: wc.name,
    sku: wc.sku || `PRODUCT-${wc.id}`,
    price: parseFloat(wc.price || 0),
    stock_quantity: wc.stock_quantity || 0,
    weight: parseFloat(wc.weight || 0),
    location: null,
    qr_code: null,
    image_url: proxyImage(wc.images && wc.images[0] && wc.images[0].src)
  };
}

function mapVariation(parent, v) {
  const parentSku = (parent.sku || '').trim();
  const ownSku = (v.sku || '').trim();
  // Dans cette boutique les variations héritent souvent l'UGS du parent à l'identique,
  // ce que l'unicité de products.sku interdit : une UGS n'est « propre » que si elle
  // est renseignée et différente de celle du parent.
  const sku = ownSku && ownSku !== parentSku ? ownSku : `PRODUCT-${v.id}`;
  // L'UGS du parent sert de code de bac : la variation en hérite comme emplacement,
  // posé à l'insertion seulement, donc modifiable ensuite dans Gestion QR.
  const location = parentSku && !parentSku.startsWith('PRODUCT-') ? parentSku : null;
  return {
    wc_id: v.id,
    parent_wc_id: parent.id,
    name: nomDeVariation(parent, v),
    sku,
    price: parseFloat(v.price || parent.price || 0),
    stock_quantity: v.stock_quantity ?? parent.stock_quantity ?? 0,
    weight: parseFloat(v.weight || parent.weight || 0),
    location,
    qr_code: null,
    image_url: proxyImage((v.image && v.image.src) || (parent.images && parent.images[0] && parent.images[0].src))
  };
}

module.exports = { mapProduct, mapVariation, nomDeVariation };
