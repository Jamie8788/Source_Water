/**
 * Remove white backgrounds from mascot PNGs → transparent WebP + PNG
 * Run: node scripts/remove-bg.mjs
 */
import sharp from 'sharp'
import { readdir } from 'fs/promises'
import { join } from 'path'

const SRC = 'C:/Users/algom/Downloads/Water Mascot/Images'
const OUT = 'client/public/mascot-images'

// Map source files to pose names — ALL poses
const MOOD_MAP = {
  'Water_Mascot_Front-View.png': 'nibi_idle',
  'Water_Mascot_Waving.png': 'nibi_wave',
  'Water_Mascot_Curiosity.png': 'nibi_thinking',
  'Water_Mascot_Assistant.png': 'nibi_happy',
  'Water_Mascot_Shy.png': 'nibi_blush',
  'Water_Mascot_Talking.png': 'nibi_talking',
  'Water_Mascot_Confident.png': 'nibi_confident',
  // New poses
  'Water_Mascot_Lab-Coat_Tube_View.png': 'nibi_labcoat',
  'Water_Mascot_Pointing-Side.png': 'nibi_pointing',
  'Water_Mascot_Open-Arms_02.png': 'nibi_openarms',
  'Water_Mascot_Jumping_01.png': 'nibi_jumping',
  'Water_Mascot_Tablet_01.png': 'nibi_tablet',
  'Water_Mascot_Trophy.png': 'nibi_trophy',
  'Water_Mascot_Action.png': 'nibi_action',
  'Water_Mascot_Strong_01.png': 'nibi_strong',
  'Water_Mascot_Walking_01.png': 'nibi_walking',
  'Water_Mascot_Love_Front_View.png': 'nibi_love',
  'Water_Mascot_Rainy-Day.png': 'nibi_rainy',
  'Water_Mascot_UI-Guide.png': 'nibi_guide',
  'Water_Mascot_Pure.png': 'nibi_pure',
  'Water_Mascot_Spinning.png': 'nibi_spinning',
}

async function removeWhiteBg(inputPath, outputBase) {
  // Load image and ensure alpha channel
  // Render at 1400px wide so on-page 520px displays are a clean downscale
  // instead of a near-native blur. Lanczos3 keeps edges crisp.
  const img = sharp(inputPath).ensureAlpha()
  const { data, info } = await img
    .resize(1400, null, { withoutEnlargement: true, kernel: 'lanczos3' })
    .raw()
    .toBuffer({ resolveWithObject: true })

  const { width, height, channels } = info

  // Process pixels — remove white and near-white backgrounds
  for (let i = 0; i < data.length; i += channels) {
    const r = data[i], g = data[i + 1], b = data[i + 2]

    // Pure white and near-white → fully transparent
    if (r > 245 && g > 245 && b > 245) {
      data[i + 3] = 0
    }
    // Near-white with soft edge → partially transparent
    else if (r > 225 && g > 225 && b > 225) {
      const brightness = (r + g + b) / 3
      // Gradual falloff: 225 → ~75% opacity, 245 → ~0% opacity
      const alpha = Math.round(((255 - brightness) / 30) * 255)
      data[i + 3] = Math.min(data[i + 3], Math.max(0, alpha))
    }
    // Light gray edges → slight transparency for smooth blending
    else if (r > 210 && g > 210 && b > 210) {
      const brightness = (r + g + b) / 3
      const alpha = Math.round(((255 - brightness) / 45) * 255 + 128)
      data[i + 3] = Math.min(data[i + 3], Math.min(255, alpha))
    }
  }

  const processed = sharp(data, { raw: { width, height, channels: 4 } })

  // Save WebP with alpha — q95 + effort 6 for sharper edges at display sizes
  await processed.clone().webp({ quality: 95, alphaQuality: 100, effort: 6 }).toFile(`${outputBase}.webp`)
  // Save PNG with alpha
  await processed.clone().png({ compressionLevel: 9 }).toFile(`${outputBase}.png`)

  const webpSize = (await sharp(`${outputBase}.webp`).metadata()).size
  console.log(`  ✓ ${outputBase}.webp`)
}

async function main() {
  console.log('Removing white backgrounds from mascot images...\n')

  for (const [srcFile, moodName] of Object.entries(MOOD_MAP)) {
    const inputPath = join(SRC, srcFile)
    const outputBase = join(OUT, moodName)
    console.log(`Processing: ${srcFile} → ${moodName}`)
    try {
      await removeWhiteBg(inputPath, outputBase)
    } catch (e) {
      console.error(`  ✗ Error: ${e.message}`)
    }
  }

  console.log('\nDone!')
}

main()
