/**
 * Copy all user collections from a SOURCE MongoDB database to a DESTINATION database.
 *
 * Safety:
 * - SOURCE is only read (listCollections, find). No delete/update/drop on source.
 * - DESTINATION collections with the same name are dropped (replaced), then repopulated.
 *
 * Credentials: set SOURCE_URI and DEST_URI in the environment (never commit real URIs).
 */
import 'dotenv/config';
import { MongoClient } from 'mongodb';

const BATCH_SIZE = Number(process.env.COPY_BATCH_SIZE || 2000);

function normalizeUriForCompare(uri) {
  try {
    const u = new URL(uri.replace(/^mongodb\+srv:\/\//, 'https://'));
    return `${u.hostname}${u.pathname}`;
  } catch {
    return uri;
  }
}

function assertDifferentDatabases(sourceUri, destUri) {
  const a = normalizeUriForCompare(sourceUri);
  const b = normalizeUriForCompare(destUri);
  if (a === b) {
    throw new Error(
      'SOURCE_URI and DEST_URI resolve to the same host/database path. Refusing to run (would duplicate into itself).'
    );
  }
}

/**
 * Require a real Mongo connection string — not a shell command like mongorestore.
 */
function validateMongoConnectionString(uri, envName) {
  const t = uri.trim();
  if (!t.startsWith('mongodb://') && !t.startsWith('mongodb+srv://')) {
    throw new Error(
      `${envName} must be a MongoDB URI starting with mongodb:// or mongodb+srv://\n` +
        `Example: mongodb+srv://user:pass@cluster.example.net/MyDatabase?retryWrites=true&w=majority`
    );
  }
  const lower = t.toLowerCase();
  const shellMarkers = ['mongorestore', 'mongodump', 'mongoimport', 'mongoexport', '--uri=', 'dump/'];
  for (const m of shellMarkers) {
    if (lower.includes(m)) {
      throw new Error(
        `${envName} looks like a terminal command, not a connection string.\n` +
          `Use ONLY the URI (same style as MONGODB_URI), for example:\n` +
          `  mongodb+srv://USER:PASSWORD@cluster.mongodb.net/campus?retryWrites=true&w=majority\n` +
          `Do not paste mongorestore or dump paths into ${envName}.`
      );
    }
  }
}

async function copyCollection(sourceColl, destDb, collName, stats) {
  const destColl = destDb.collection(collName);

  console.log(`  → Reading documents from SOURCE "${collName}" …`);
  const estimated = await sourceColl.estimatedDocumentCount();
  console.log(`    (estimated count: ${estimated})`);

  await destColl.drop().catch(() => {});
  console.log(`  → Replaced DESTINATION collection "${collName}" (dropped if existed).`);

  let inserted = 0;
  const cursor = sourceColl.find({}, { batchSize: BATCH_SIZE });

  let batch = [];
  for await (const doc of cursor) {
    batch.push(doc);
    if (batch.length >= BATCH_SIZE) {
      await destColl.insertMany(batch, { ordered: false });
      inserted += batch.length;
      console.log(`    … inserted ${inserted} documents into DESTINATION`);
      batch = [];
    }
  }
  if (batch.length > 0) {
    await destColl.insertMany(batch, { ordered: false });
    inserted += batch.length;
  }

  stats.push({ name: collName, documents: inserted });
  console.log(`  ✓ Finished "${collName}": ${inserted} document(s) copied (ObjectIds preserved).`);
}

async function main() {
  console.log(
    [
      'Database copy (safe mode):',
      '  • SOURCE: read-only (no deletes/updates/writes).',
      '  • DESTINATION: matching collections are dropped there, then documents inserted from SOURCE.',
      ''
    ].join('\n')
  );

  const sourceUri = process.env.SOURCE_URI?.trim();
  const destUri = process.env.DEST_URI?.trim();

  if (!sourceUri || !destUri) {
    console.error(
      'Missing SOURCE_URI or DEST_URI in the environment.\n' +
        'Load backend/.env (this script imports dotenv) or set vars in your shell.\n' +
        'Example (PowerShell):\n' +
        '  $env:SOURCE_URI="mongodb+srv://USER:PASS@cluster/sourceDb"\n' +
        '  $env:DEST_URI="mongodb+srv://USER:PASS@cluster/destDb"\n' +
        '  npm run copy-db'
    );
    process.exitCode = 1;
    return;
  }

  try {
    validateMongoConnectionString(sourceUri, 'SOURCE_URI');
    validateMongoConnectionString(destUri, 'DEST_URI');
  } catch (e) {
    console.error(e.message || e);
    process.exitCode = 1;
    return;
  }

  assertDifferentDatabases(sourceUri, destUri);

  /** SOURCE: read-only usage — only listCollections + find (via cursor). */
  const sourceClient = new MongoClient(sourceUri, {
    appName: 'campus-copy-db-source-readonly'
  });
  const destClient = new MongoClient(destUri, {
    appName: 'campus-copy-db-destination-write'
  });

  const stats = [];

  try {
    console.log('Connecting to SOURCE (read-only operations) …');
    await sourceClient.connect();
    const sourceDb = sourceClient.db();

    console.log('Connecting to DESTINATION …');
    await destClient.connect();
    const destDb = destClient.db();

    const collInfos = await sourceDb.listCollections().toArray();
    const userCollections = collInfos.filter((c) => {
      const n = c.name || '';
      if (n.startsWith('system.')) return false;
      if (c.type === 'view') {
        console.log(`Skipping VIEW "${n}" (views are not duplicated by this script).`);
        return false;
      }
      return true;
    });

    console.log(
      `\nFound ${userCollections.length} collection(s) on SOURCE database "${sourceDb.databaseName}".\n`
    );

    for (const info of userCollections) {
      const collName = info.name;
      console.log(`\n--- Copying collection: ${collName} ---`);
      try {
        const sourceColl = sourceDb.collection(collName);
        await copyCollection(sourceColl, destDb, collName, stats);
      } catch (collErr) {
        console.error(`  ✗ Failed copying "${collName}":`, collErr.message || collErr);
        throw collErr;
      }
    }

    console.log('\n======== Summary ========');
    for (const s of stats) {
      console.log(`  ${s.name}: ${s.documents} documents`);
    }
    console.log(
      '\nNote: Indexes and views are not copied. Recreate indexes on DESTINATION if needed.\nDone.'
    );
  } catch (err) {
    console.error('\nFatal error:', err.message || err);
    process.exitCode = 1;
  } finally {
    console.log('\nClosing connections …');
    await sourceClient.close().catch(() => {});
    await destClient.close().catch(() => {});
    console.log('Connections closed.');
  }
}

main();
