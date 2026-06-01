// One-shot backfill: derive country + admin1 for every break via point-in-polygon
// against the vendored Natural Earth GeoJSON.
//
// Run from LineupsClient/ with the service-role key from Supabase Dashboard → Settings → API:
//
//   SUPABASE_URL=https://your-project.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=eyJ... \
//   node scripts/backfill-break-geography.js
//
// Safe to re-run — skips breaks that already have both country and admin1 populated.

const path = require('path')
const { createClient } = require('@supabase/supabase-js')
const { geoContains, geoCentroid, geoDistance } = require('d3-geo')
const { feature: topoFeature } = require('topojson-client')

// Both files are TopoJSON (post-mapshaper simplification). Unwrap to GeoJSON
// FeatureCollections so the rest of this script keeps working with .features.
const admin1Topo = require(path.join(__dirname, '..', 'assets', 'world', 'admin1.json'))
const admin0Topo = require(path.join(__dirname, '..', 'assets', 'world', 'admin0.json'))
const admin1ObjName = Object.keys(admin1Topo.objects)[0]
const admin0ObjName = Object.keys(admin0Topo.objects)[0]
const admin1 = topoFeature(admin1Topo, admin1Topo.objects[admin1ObjName])
const admin0 = topoFeature(admin0Topo, admin0Topo.objects[admin0ObjName])

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing env vars. Usage:')
  console.error('  SUPABASE_URL=<url> SUPABASE_SERVICE_ROLE_KEY=<key> node scripts/backfill-break-geography.js')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
})

// Fallback cap for nearest-feature search (offshore breaks). 1000km is generous
// enough for atoll/reef breaks (Fiji's Cloudbreak is ~80km from Suva's centroid)
// and tight enough to reject open-ocean junk coordinates.
const FALLBACK_KM = 1000
const FALLBACK_RAD = FALLBACK_KM / 6371

async function main() {
  console.log(`Loaded admin0 (${admin0.features.length}) and admin1 (${admin1.features.length}) features.`)

  // Precompute centroids once — geoCentroid is expensive and the features never change.
  console.log('Precomputing centroids...')
  const admin1WithCentroids = admin1.features.map(f => ({ feature: f, centroid: geoCentroid(f) }))
  const admin0WithCentroids = admin0.features.map(f => ({ feature: f, centroid: geoCentroid(f) }))

  const { data: breaks, error } = await supabase
    .from('breaks')
    .select('id, name, lat, lng, country, admin1')

  if (error) throw error
  console.log(`Fetched ${breaks.length} breaks.\n`)

  let withAdmin1 = 0
  let countryOnly = 0
  let withAdmin1Fallback = 0
  let countryOnlyFallback = 0
  let unresolved = 0
  let skipped = 0
  let failed = 0

  for (const b of breaks) {
    if (b.country && b.admin1) { skipped++; continue }

    const lat = Number(b.lat)
    const lng = Number(b.lng)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      console.log(`✗ ${b.name} — invalid lat/lng`)
      unresolved++
      continue
    }

    const point = [lng, lat] // GeoJSON convention is [lng, lat]

    let country = null
    let admin1Name = null
    let usedFallback = false

    // Pass 1: direct contains on admin1 (best case — gives state + country in one shot)
    for (const f of admin1.features) {
      if (geoContains(f, point)) {
        admin1Name = f.properties.name
        country    = f.properties.admin
        break
      }
    }

    // Pass 2: point is inside an admin0 country polygon but missed admin1
    // (10m coastline jaggedness — common for coastal breaks).
    // Find the country, then find the nearest admin1 *within that country*.
    if (!country) {
      let containingCountry = null
      for (const f of admin0.features) {
        if (geoContains(f, point)) {
          containingCountry = f.properties.NAME
          break
        }
      }
      if (containingCountry) {
        country = containingCountry
        let best = null
        let bestDist = Infinity
        for (const { feature: f, centroid } of admin1WithCentroids) {
          if (f.properties.admin !== containingCountry) continue
          const d = geoDistance(point, centroid)
          if (d < bestDist) { bestDist = d; best = f }
        }
        if (best) {
          admin1Name = best.properties.name
          usedFallback = true
        }
      }
    }

    // Pass 3: truly offshore — nearest admin1 globally (with distance cap)
    if (!country) {
      let best = null
      let bestDist = Infinity
      for (const { feature: f, centroid } of admin1WithCentroids) {
        const d = geoDistance(point, centroid)
        if (d < bestDist) { bestDist = d; best = f }
      }
      if (best && bestDist <= FALLBACK_RAD) {
        admin1Name = best.properties.name
        country    = best.properties.admin
        usedFallback = true
      }
    }

    // Pass 4: last-resort country-only fallback
    if (!country) {
      let best = null
      let bestDist = Infinity
      for (const { feature: f, centroid } of admin0WithCentroids) {
        const d = geoDistance(point, centroid)
        if (d < bestDist) { bestDist = d; best = f }
      }
      if (best && bestDist <= FALLBACK_RAD) {
        country = best.properties.NAME
        usedFallback = true
      }
    }

    if (!country) {
      console.log(`✗ ${b.name} (${lat.toFixed(2)}, ${lng.toFixed(2)}) — no match within ${FALLBACK_KM}km`)
      unresolved++
      continue
    }

    const { error: updErr } = await supabase
      .from('breaks')
      .update({ country, admin1: admin1Name })
      .eq('id', b.id)

    if (updErr) {
      console.error(`✗ ${b.name} — update failed:`, updErr.message)
      failed++
    } else {
      const tag = usedFallback ? ' [fallback]' : ''
      console.log(`✓ ${b.name} → ${country}${admin1Name ? ' / ' + admin1Name : ' (country only)'}${tag}`)
      if (usedFallback) {
        if (admin1Name) withAdmin1Fallback++; else countryOnlyFallback++
      } else {
        if (admin1Name) withAdmin1++; else countryOnly++
      }
    }
  }

  console.log('\n──── Summary ────')
  console.log(`Total:                              ${breaks.length}`)
  console.log(`Already populated (skipped):        ${skipped}`)
  console.log(`Direct contains, admin1:            ${withAdmin1}`)
  console.log(`Direct contains, country only:      ${countryOnly}`)
  console.log(`Nearest-centroid fallback, admin1:  ${withAdmin1Fallback}`)
  console.log(`Nearest-centroid fallback, country: ${countryOnlyFallback}`)
  console.log(`Unresolved (>${FALLBACK_KM}km from any land): ${unresolved}`)
  console.log(`Update failures:                    ${failed}`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
