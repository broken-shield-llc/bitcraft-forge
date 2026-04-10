import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema.js";

export function createPool(connectionString: string): pg.Pool {
  const tlsRejectUnauthorized =
    process.env.FORGE_DATABASE_SSL_REJECT_UNAUTHORIZED?.trim().toLowerCase() !==
    "false";

  const needsSslHint =
    /\bsslmode=(require|verify-ca|verify-full)\b/i.test(connectionString) ||
    /\bssl=true\b/i.test(connectionString);

  let normalizedConnectionString = connectionString;
  const ssl =
    needsSslHint && !tlsRejectUnauthorized
      ? { rejectUnauthorized: false as const }
      : undefined;

  if (ssl) {
    try {
      const u = new URL(connectionString);
      // Prevent pg connection-string sslmode parsing from forcing verify-full.
      u.searchParams.delete("sslmode");
      normalizedConnectionString = u.toString();
    } catch {
      // If parsing fails, fall back to original and let pg handle it.
      normalizedConnectionString = connectionString;
    }
  }

  return new pg.Pool({
    connectionString: normalizedConnectionString,
    ...(ssl ? { ssl } : {}),
  });
}

export function createDb(pool: pg.Pool) {
  return drizzle(pool, { schema });
}

export type ForgeDb = ReturnType<typeof createDb>;
