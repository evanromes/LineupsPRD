// One-off diagnostic for the vendored admin1 GeoJSON.
// Tells us whether the 50m file is dense enough to cover the regions we care about.
// Run from LineupsClient/: node scripts/check_admin1.js

const d = require('../assets/world/admin1.json')

console.log('Total features:', d.features.length)

const ranks = [...new Set(d.features.map(f => f.properties.scalerank))].sort((a, b) => a - b)
console.log('Scaleranks present:', ranks)

const us = d.features.filter(f => f.properties.admin === 'United States of America')
console.log('US states found:', us.length, '/ 50 expected')
console.log('  Sample:', us.slice(0, 8).map(f => f.properties.name))

const checks = [
  'Hawaii',
  'California',
  'South Carolina',
  'Florida',
  'North Carolina',
  'Bali',
  'New South Wales',
  'Baja California Sur',
]

for (const n of checks) {
  const hit = d.features.find(f => f.properties.name === n)
  console.log(' ', n + ':', hit ? `YES (admin=${hit.properties.admin})` : 'MISSING')
}
