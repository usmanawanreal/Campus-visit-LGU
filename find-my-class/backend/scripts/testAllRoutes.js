/**
 * Test all location-to-location routes by sampling random pairs.
 * Usage: node scripts/testAllRoutes.js [sampleSize]
 */
const SAMPLE_SIZE = Number(process.argv[2]) || 30;
const BASE = 'http://localhost:7000/api';
const TIMEOUT_MS = 60000;

async function main() {
  const res = await fetch(`${BASE}/navigation/locations`);
  const { data } = await res.json();
  const points = data.filter(l => l.kind === 'point');
  console.log(`Total point locations: ${points.length}`);
  console.log(`Testing ${SAMPLE_SIZE} random pairs...\n`);

  const results = { success: 0, noPath: 0, error: 0, timeout: 0, total: 0 };
  const failures = [];

  // Generate random unique pairs
  const pairs = [];
  const tried = new Set();
  while (pairs.length < SAMPLE_SIZE && pairs.length < points.length * (points.length - 1)) {
    const a = points[Math.floor(Math.random() * points.length)];
    const b = points[Math.floor(Math.random() * points.length)];
    if (a._id === b._id) continue;
    const key = `${a._id}|${b._id}`;
    if (tried.has(key)) continue;
    tried.add(key);
    pairs.push([a, b]);
  }

  for (const [start, end] of pairs) {
    results.total++;
    const sameMap = start.mapId === end.mapId;
    const label = `${start.name} → ${end.name} [${sameMap ? 'same-map' : 'cross-map'}]`;
    
    const t0 = Date.now();
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      
      const r = await fetch(
        `${BASE}/navigation/route?start=${start._id}&end=${end._id}`,
        { signal: controller.signal }
      );
      clearTimeout(timer);
      
      const elapsed = Date.now() - t0;
      const j = await r.json();
      
      if (j.error) {
        // Expected errors (different buildings, etc.) are not real failures
        if (j.error.includes('same building') || j.error.includes('same map')) {
          console.log(`  SKIP  ${elapsed}ms  ${label}  (${j.error.slice(0, 60)}...)`);
        } else {
          results.noPath++;
          failures.push({ label, elapsed, error: j.error.slice(0, 100) });
          console.log(`  FAIL  ${elapsed}ms  ${label}`);
          console.log(`        Error: ${j.error.slice(0, 120)}`);
        }
      } else if (j.segments?.length > 0) {
        results.success++;
        console.log(`  OK    ${elapsed}ms  ${label}  (${j.segments.length} segments)`);
      } else {
        results.noPath++;
        failures.push({ label, elapsed, error: 'No segments returned' });
        console.log(`  FAIL  ${elapsed}ms  ${label}  (no segments)`);
      }
    } catch (e) {
      const elapsed = Date.now() - t0;
      if (e.name === 'AbortError') {
        results.timeout++;
        failures.push({ label, elapsed, error: 'TIMEOUT' });
        console.log(`  TOUT  ${elapsed}ms  ${label}`);
      } else {
        results.error++;
        failures.push({ label, elapsed, error: e.message });
        console.log(`  ERR   ${elapsed}ms  ${label}  ${e.message}`);
      }
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Results: ${results.success} OK, ${results.noPath} no-path, ${results.error} error, ${results.timeout} timeout (of ${results.total})`);
  if (failures.length > 0) {
    console.log(`\nFailures:`);
    for (const f of failures) {
      console.log(`  ${f.label}`);
      console.log(`    ${f.elapsed}ms — ${f.error}`);
    }
  }
}

main().catch(e => { console.error(e); process.exit(1); });
