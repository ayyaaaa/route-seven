// src/seed/seed-veligaa-products.ts
import fs from 'fs'
import path from 'path'
import csv from 'csv-parser'
import payload from 'payload'

const CSV_PATH = path.resolve('products_veligaa_all.csv')
const IMAGES_DIR = path.resolve('scraped_images_veligaa')

interface CsvRow {
  sku: string
  product_name: string
  price?: string
  local_image_filename?: string
}

async function main() {
  console.log('🌱 Starting Veligaa product import...')
  await payload.init({
    secret: process.env.PAYLOAD_SECRET!,
    local: true,
  })

  const rows: CsvRow[] = []
  await new Promise<void>((resolve) => {
    fs.createReadStream(CSV_PATH)
      .pipe(csv())
      .on('data', (row) => rows.push(row))
      .on('end', () => resolve())
  })
  console.log(`📦 Parsed ${rows.length} rows from CSV`)

  for (const [i, r] of rows.entries()) {
    try {
      // Check if product already exists (by productId)
      const existing = await payload.find({
        collection: 'products',
        where: { productId: { equals: r.sku } },
      })

      // Upload image if present
      let gallery: any[] = []
      if (r.local_image_filename) {
        const imagePath = path.resolve(IMAGES_DIR, path.basename(r.local_image_filename))
        if (fs.existsSync(imagePath)) {
          const upload = await payload.create({
            collection: 'media',
            filePath: imagePath,
          })
          gallery = [{ image: upload.id }]
        }
      }

      const data = {
        title: r.product_name,
        productId: r.sku,
        priceInMVR: r.price || '',
        gallery,
      }

      if (existing.totalDocs > 0) {
        await payload.update({
          collection: 'products',
          id: existing.docs[0].id,
          data,
        })
        console.log(`🔄 Updated [${i + 1}] ${r.sku}`)
      } else {
        await payload.create({
          collection: 'products',
          data,
        })
        console.log(`➕ Created [${i + 1}] ${r.sku}`)
      }
    } catch (e: any) {
      console.error(`⚠️  [${i + 1}] Failed to seed ${r.sku}: ${e.message}`)
    }
  }

  console.log('✅ Done seeding Veligaa products!')
  process.exit(0)
}

main().catch((err) => {
  console.error('💥 Fatal error:', err)
  process.exit(1)
})
