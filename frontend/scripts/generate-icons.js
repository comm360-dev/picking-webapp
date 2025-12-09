/**
 * Script pour générer les icônes PWA à partir d'une image source
 *
 * Usage:
 * 1. Placez votre logo dans frontend/public/ (ex: logo.png)
 * 2. Installez sharp: npm install sharp
 * 3. Exécutez: node scripts/generate-icons.js votre-logo.png
 */

import sharp from 'sharp'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const sizes = [
  { size: 192, name: 'icon-192x192.png' },
  { size: 512, name: 'icon-512x512.png' },
  { size: 180, name: 'apple-touch-icon.png' } // Icône spéciale pour iOS
]

async function generateIcons(sourceImage) {
  const sourcePath = path.join(__dirname, '..', 'public', sourceImage)
  const iconsDir = path.join(__dirname, '..', 'public', 'icons')

  // Vérifier que le fichier source existe
  if (!fs.existsSync(sourcePath)) {
    console.error(`❌ Fichier source non trouvé: ${sourcePath}`)
    console.log('\n💡 Assurez-vous que votre logo est dans frontend/public/')
    process.exit(1)
  }

  // Créer le dossier icons s'il n'existe pas
  if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true })
  }

  console.log(`📸 Génération des icônes depuis: ${sourceImage}\n`)

  for (const { size, name } of sizes) {
    const outputPath = path.join(iconsDir, name)

    try {
      await sharp(sourcePath)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 0 } // Fond transparent
        })
        .png()
        .toFile(outputPath)

      console.log(`✅ ${name} (${size}x${size}) créé`)
    } catch (error) {
      console.error(`❌ Erreur pour ${name}:`, error.message)
    }
  }

  // Générer aussi le favicon.ico
  try {
    const faviconPath = path.join(__dirname, '..', 'public', 'favicon.ico')
    await sharp(sourcePath)
      .resize(32, 32, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 0 }
      })
      .toFormat('png')
      .toFile(faviconPath.replace('.ico', '.png'))

    console.log(`✅ favicon.png (32x32) créé`)
    console.log(`\n⚠️  Note: Renommez favicon.png en favicon.ico manuellement`)
  } catch (error) {
    console.error(`❌ Erreur pour favicon:`, error.message)
  }

  console.log('\n🎉 Génération terminée !')
  console.log('\n📱 Prochaines étapes:')
  console.log('1. Redémarrez le serveur frontend (Ctrl+C puis npm run dev)')
  console.log('2. Sur iPhone: Supprimez l\'ancienne app de l\'écran d\'accueil')
  console.log('3. Ouvrez Safari et ajoutez à nouveau l\'app à l\'écran d\'accueil')
  console.log('4. Le nouveau logo devrait apparaître ! 🚀')
}

// Récupérer le nom du fichier depuis les arguments
const sourceImage = process.argv[2]

if (!sourceImage) {
  console.error('❌ Usage: node scripts/generate-icons.js <nom-du-logo.png>')
  console.log('\nExemple: node scripts/generate-icons.js logo.png')
  process.exit(1)
}

generateIcons(sourceImage)
