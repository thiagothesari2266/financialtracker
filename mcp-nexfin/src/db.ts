import pg from "pg";

const DATABASE_URL =
  process.env.DATABASE_URL ||
  (process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : null) ||
  "postgresql://postgres:tmttx22ID@localhost:5432/financialtracker";

export const pool = new pg.Pool({ connectionString: DATABASE_URL, max: 5 });
