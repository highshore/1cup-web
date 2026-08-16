// Where the Firestore NDJSON export lives.
//
// The dump is ~72MB of production data with real names, phone numbers and payment
// records, so it deliberately stays OUTSIDE this repository. The default points at the
// sibling working directory used during the migration; override with MIGRATION_DATA_DIR.
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

export const DATA_DIR = process.env.MIGRATION_DATA_DIR
  ? resolve(process.env.MIGRATION_DATA_DIR)
  : resolve(here, "../../../1cup-db-migration/data");
