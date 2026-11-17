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
  db.registerFileURL('enderecos.parquet', localParquet, duckdb.DuckDBDataProtocol.NODE_FS, false);
  const conn = db.connect();

  console.log("=== Buscar 'QUADRA: O' em complemento ===");
  const q1 = conn.query(`
      SELECT "Nome do município" as municipio, "Endereco" as endereco, "Número no logradouro" as num, "Complemento" as complemento
      FROM 'enderecos.parquet'
      WHERE "Complemento" LIKE '%QUADRA: O%'
      LIMIT 10
    `);
  console.log("QUADRA: O ->", q1.toArray());

  console.log("=== Buscar exatamente 'QUADRA: O, CASA: 1' ou com outros campos no meio ===");
  const q2 = conn.query(`
      SELECT "Nome do município" as municipio, "Endereco" as endereco, "Número no logradouro" as num, "Complemento" as complemento
      FROM 'enderecos.parquet'
      WHERE "Complemento" LIKE '%QUADRA: O%' AND "Complemento" LIKE '%CASA: 1%'
      LIMIT 10
    `);
  console.log("QUADRA: O com CASA: 1 ->", q2.toArray());

  console.log("=== Buscar 'QUADRA: 0' (zero) com CASA: 1 ===");
  const q3 = conn.query(`
      SELECT "Nome do município" as municipio, "Endereco" as endereco, "Número no logradouro" as num, "Complemento" as complemento
      FROM 'enderecos.parquet'
      WHERE "Complemento" LIKE '%QUADRA: 0%' AND "Complemento" LIKE '%CASA: 1%'
      LIMIT 10
    `);
  console.log("QUADRA: 0 com CASA: 1 ->", q3.toArray());
}

main().catch(err => {
  console.error("Error:", err);
});