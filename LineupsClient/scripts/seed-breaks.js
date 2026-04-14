// scripts/seed-breaks.js
// Usage: node scripts/seed-breaks.js
//
// Reads data/breaks.json and bulk-inserts into the Supabase breaks table
// in batches of 50. Skips entries that already exist (matched on name + lat).

require('dotenv').config({ path: '.env.local' })

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

const SUPABASE_URL      = process.env.EXPO_PUBLIC_SUPABASE_URL      || 'https://yztxxqfnckvjvhpucifx.supabase.co'
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6dHh4cWZuY2t2anZocHVjaWZ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMTYyMjQsImV4cCI6MjA5MDg5MjIyNH0.69TJD_nLWLp351_7HZktEzRjcyq1GrRGw9Eqv9K7Pik'
const BATCH_SIZE        = 50

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

async function main() {
  const breaksPath = path.join(__dirname, '..', 'data', 'breaks.json')
  const breaks = JSON.parse(fs.readFileSync(breaksPath, 'utf8'))
  console.log(`Loaded ${breaks.length} breaks from data/breaks.json`)

  // Fetch existing (name, lat) pairs to determine what to skip
  const { data: existing, error: fetchError } = await supabase
    .from('breaks')
    .select('name, lat')

  if (fetchError) {
    console.error('Failed to fetch existing breaks:', fetchError.message)
    process.exit(1)
  }

  const existingKeys = new Set(
    (existing ?? []).map(r => `${r.name}|${r.lat}`)
  )

  const toInsert = breaks.filter(b => !existingKeys.has(`${b.name}|${b.lat}`))
  const skipped  = breaks.length - toInsert.length

  console.log(`Skipping ${skipped} already-existing breaks`)
  console.log(`Inserting ${toInsert.length} new breaks in batches of ${BATCH_SIZE}...`)

  let inserted = 0

  for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
    const batch = toInsert.slice(i, i + BATCH_SIZE)
    const { error } = await supabase.from('breaks').insert(batch)
    if (error) {
      console.error(`Batch ${Math.floor(i / BATCH_SIZE) + 1} failed:`, error.message)
      process.exit(1)
    }
    inserted += batch.length
    console.log(`  ✓ Batch ${Math.floor(i / BATCH_SIZE) + 1}: inserted ${batch.length} (${inserted}/${toInsert.length})`)
  }

  console.log(`\nDone. Inserted: ${inserted}  |  Skipped: ${skipped}`)
}

main()
