import { promises as fs } from "node:fs";
import path from "node:path";
import { pool } from "./queries";

async function resolveSchemaPath(): Promise<string> {
  const candidates = [
    path.resolve(__dirname, "schema.sql"),
    path.resolve(process.cwd(), "src", "db", "schema.sql"),
    path.resolve(process.cwd(), "dist", "db", "schema.sql")
  ];

  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // Keep trying other candidate paths.
    }
  }

  throw new Error(`Database schema file not found. Looked in: ${candidates.join(", ")}`);
}

async function resolveMigrationsDir(): Promise<string | null> {
  const candidates = [
    path.resolve(__dirname, "migrations"),
    path.resolve(process.cwd(), "src", "db", "migrations"),
    path.resolve(process.cwd(), "dist", "db", "migrations")
  ];

  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // Keep trying other candidate paths.
    }
  }

  return null;
}

async function listMigrationFiles(): Promise<Array<{ name: string; fullPath: string }>> {
  const migrationsDir = await resolveMigrationsDir();
  if (!migrationsDir) return [];

  const entries = await fs.readdir(migrationsDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".sql"))
    .map((entry) => ({ name: entry.name, fullPath: path.join(migrationsDir, entry.name) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function ensureMigrationsTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function getAppliedMigrations(): Promise<Set<string>> {
  const result = await pool.query<{ filename: string }>(
    "SELECT filename FROM schema_migrations ORDER BY filename"
  );
  return new Set(result.rows.map((row) => row.filename));
}

async function applyMigration(filename: string, sql: string): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(sql);
    await client.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [filename]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function initializeDatabase(): Promise<void> {
  await ensureMigrationsTable();
  const applied = await getAppliedMigrations();
  const migrations = await listMigrationFiles();

  // Backward-compatible fallback for environments without migration files.
  if (migrations.length === 0) {
    const schemaPath = await resolveSchemaPath();
    const schemaSql = await fs.readFile(schemaPath, "utf-8");
    const fallbackFilename = "000_legacy_schema.sql";
    if (!applied.has(fallbackFilename)) {
      await applyMigration(fallbackFilename, schemaSql);
    }
    return;
  }

  for (const migration of migrations) {
    if (applied.has(migration.name)) continue;
    const sql = await fs.readFile(migration.fullPath, "utf-8");
    await applyMigration(migration.name, sql);
  }
}
