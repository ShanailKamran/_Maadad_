import { runMaintenance } from "../src/lib/maintenance";
import { pool } from "../src/lib/db";

runMaintenance()
  .then((r) => console.log(JSON.stringify(r)))
  .catch((e) => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1; })
  .finally(() => pool().end());
