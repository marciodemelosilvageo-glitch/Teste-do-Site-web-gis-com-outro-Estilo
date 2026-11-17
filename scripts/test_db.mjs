import path from 'path';
import { fileURLToPath } from 'url';
import * as duckdb from '@duckdb/duckdb-wasm/dist/duckdb-node-blocking.cjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DUCKDB_DIST = path.resolve(__dirname, '../node_modules/@duckdb/duckdb-wasm/dist');

const DUCKDB_BUNDLES = {
  mvp: {
    mainModule: path.resolve(DUCKDB_DIST, './duckdb-mvp.wasm'),
    mainWorker: path.resolve(DUCKDB_DIST, './duckdb-node-mvp.worker.cjs'),
  },
  eh: {
    mainModule: path.resolve(DUCKDB_DIST, './duckdb-eh.wasm'),
    mainWorker: path.resolve(DUCKDB_DIST, './duckdb-node-eh.worker.cjs'),
  },
};

async function main() {
  const bundle = await duckdb.selectBundle(DUCKDB_BUNDLES);
  const logger = new duckdb.ConsoleLogger();
  const db = await duckdb.createDuckDB(DUCKDB_BUNDLES, logger, duckdb.NODE_RUNTIME);
  await db.instantiate(bundle.mainModule);

  const localParquet = 'C:/Users/DINT-SSPPI/.gemini/antigravity/brain/f5434d00-7832-4f4b-82e7-00fb0e1fd40e/scratch/coordenadas.parquet';

  console.log("Registering local file URL with NODE_FS...");
  db.registerFileURL(
    'enderecos.parquet',
    localParquet,
    duckdb.DuckDBDataProtocol.NODE_FS,
    false
  );

  const conn = db.connect();
  console.log("Querying parquet sample...");
  const res = conn.query(`
      SELECT "Complemento" AS complemento, "CEP" AS cep
      FROM 'enderecos.parquet'
      WHERE "Complemento" IS NOT NULL AND TRIM("Complemento") != ''
        AND (
          upper("Complemento") LIKE '%QUADRA%' OR
          upper("Complemento") LIKE '%CASA%' OR
          upper("Complemento") LIKE '%LOTE%'
        )
      LIMIT 10
    `);
  console.log("Got rows:", res.numRows);
  console.log(res.toArray());
}

main().catch(err => {
  console.error("Error:", err);
});