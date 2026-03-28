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

export async function initializeDatabase(): Promise<void> {
  const schemaPath = await resolveSchemaPath();
  const schemaSql = await fs.readFile(schemaPath, "utf-8");
  await pool.query(schemaSql);
}
