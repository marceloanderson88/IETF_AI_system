import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

/**
 * Invariante §6/§12.1: a dimensão do embedding usada no código DEVE bater com a
 * dimensão da coluna chunk.embedding no schema. Se alguém trocar uma sem a outra,
 * o CI quebra aqui.
 */

function readColumnDim() {
  const sql = readFileSync(join(root, "supabase", "migrations", "0003_vector_and_fts.sql"), "utf8");
  const m = sql.match(/vector\((\d+)\)/);
  assert.ok(m, "não achei vector(N) na migration 0003");
  return Number(m[1]);
}

function readRpcDim() {
  const sql = readFileSync(join(root, "supabase", "migrations", "0004_match_chunks_rpc.sql"), "utf8");
  const m = sql.match(/vector\((\d+)\)/);
  assert.ok(m, "não achei vector(N) na RPC match_chunks");
  return Number(m[1]);
}

function readConfigSchemaDim() {
  const ts = readFileSync(join(root, "lib", "config.ts"), "utf8");
  const m = ts.match(/SCHEMA_EMBEDDING_DIM\s*=\s*(\d+)/);
  assert.ok(m, "não achei SCHEMA_EMBEDDING_DIM em lib/config.ts");
  return Number(m[1]);
}

function readConfigDefaultDim() {
  const ts = readFileSync(join(root, "lib", "config.ts"), "utf8");
  const m = ts.match(/EMBEDDINGS_DIM\s*=\s*Number\(process\.env\.EMBEDDINGS_DIM\s*\?\?\s*"(\d+)"\)/);
  assert.ok(m, "não achei o default de EMBEDDINGS_DIM em lib/config.ts");
  return Number(m[1]);
}

test("dimensão do embedding é consistente entre schema, RPC e código", () => {
  const col = readColumnDim();
  const rpc = readRpcDim();
  const schemaConst = readConfigSchemaDim();
  const codeDefault = readConfigDefaultDim();

  assert.equal(rpc, col, `RPC vector(${rpc}) ≠ coluna vector(${col})`);
  assert.equal(schemaConst, col, `SCHEMA_EMBEDDING_DIM=${schemaConst} ≠ coluna vector(${col})`);
  assert.equal(codeDefault, col, `default EMBEDDINGS_DIM=${codeDefault} ≠ coluna vector(${col})`);
});
