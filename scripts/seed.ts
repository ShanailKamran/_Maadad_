import { Pool } from "pg";
import { normalizePkPhone } from "../src/lib/phone";

/**
 * Seeds reference data (Lahore, categories, areas) — safe for any environment, idempotent.
 * Optional demo data (SEED_DEMO=true, never in production) is clearly labelled "[DEMO]" and is
 * flagged is_demo. Demo phones come from env: nothing is hard-coded. No reviews are ever seeded.
 * Area centroids are APPROXIMATE neighbourhood centres; operators should refine them.
 */
const AREAS: [string, string, number, number][] = [
  ["Gulberg", "گلبرگ", 31.512, 74.344], ["DHA Phase 5", "ڈی ایچ اے فیز 5", 31.477, 74.4],
  ["DHA Phase 6", "ڈی ایچ اے فیز 6", 31.465, 74.43], ["Johar Town", "جوہر ٹاؤن", 31.4697, 74.2728],
  ["Model Town", "ماڈل ٹاؤن", 31.4826, 74.3239], ["Bahria Town", "بحریہ ٹاؤن", 31.3653, 74.186],
  ["Wapda Town", "واپڈا ٹاؤن", 31.4417, 74.2658], ["Faisal Town", "فیصل ٹاؤن", 31.485, 74.3],
  ["Garden Town", "گارڈن ٹاؤن", 31.498, 74.33], ["Lahore Cantt", "لاہور کینٹ", 31.529, 74.39],
  ["Allama Iqbal Town", "علامہ اقبال ٹاؤن", 31.505, 74.29], ["Samanabad", "سمن آباد", 31.54, 74.3],
  ["Shadman", "شادمان", 31.538, 74.332], ["Township", "ٹاؤن شپ", 31.435, 74.3],
  ["Valencia Town", "ویلنشیا ٹاؤن", 31.432, 74.256], ["Askari 10", "عسکری 10", 31.493, 74.402],
  ["Muslim Town", "مسلم ٹاؤن", 31.524, 74.328], ["Sabzazar", "سبزہ زار", 31.5, 74.268],
  ["Walled City", "اندرون شہر", 31.5826, 74.3294], ["Cavalry Ground", "کیولری گراؤنڈ", 31.51, 74.38],
];

async function main() {
  const url = process.env.DATABASE_URL;
  const isSupabase =
    url?.includes("supabase.co") ||
    url?.includes("supabase.com") ||
    process.env.DATABASE_SSL === "true";

  const prod = process.env.NODE_ENV === "production";
  const pool = new Pool({
    connectionString: url,
    ssl: isSupabase ? { rejectUnauthorized: false } : undefined,
  });
  const city = (await pool.query(
    `INSERT INTO cities (slug, name, active) VALUES ('lahore','Lahore',true)
     ON CONFLICT (slug) DO UPDATE SET active=true RETURNING id`)).rows[0].id;
  await pool.query(`INSERT INTO service_categories (slug, name, name_ur, sort_order) VALUES ('plumbing','Plumbing','پلمبنگ',1),('electrical','Electrical','الیکٹریکل',2)
    ON CONFLICT (slug) DO NOTHING`);
  for (const [name, ur, lat, lng] of AREAS)
    await pool.query(
      `INSERT INTO service_areas (city_id, name, name_ur, centroid) VALUES ($1,$2,$3, ST_SetSRID(ST_MakePoint($5,$4),4326)::geography)
       ON CONFLICT (city_id, name) DO NOTHING`, [city, name, ur, lat, lng]);
  console.log(`reference data ready (${AREAS.length} Lahore areas)`);

  if (process.env.SEED_DEMO === "true") {
    if (prod) throw new Error("Refusing to seed demo data when NODE_ENV=production.");
    const cp = normalizePkPhone(process.env.DEMO_CUSTOMER_PHONE || "");
    const wp = normalizePkPhone(process.env.DEMO_WORKER_PHONE || "");
    if (!cp || !wp) throw new Error("Set DEMO_CUSTOMER_PHONE and DEMO_WORKER_PHONE (numbers you control) to seed demo accounts.");
    const cu = (await pool.query(
      `INSERT INTO users (phone, phone_verified_at, display_name, is_customer) VALUES ($1, now(), '[DEMO] Demo Customer', true)
       ON CONFLICT (phone) WHERE deleted_at IS NULL DO UPDATE SET display_name=users.display_name RETURNING id`, [cp])).rows[0].id;
    const wu = (await pool.query(
      `INSERT INTO users (phone, phone_verified_at, display_name, is_customer, is_worker) VALUES ($1, now(), '[DEMO] Demo Worker', true, true)
       ON CONFLICT (phone) WHERE deleted_at IS NULL DO UPDATE SET is_worker=true RETURNING id`, [wp])).rows[0].id;
    await pool.query(
      `INSERT INTO worker_profiles (user_id, bio, experience_years, is_demo) VALUES ($1,'[DEMO] Fictional profile for testing only. Not a real worker.',5,true)
       ON CONFLICT (user_id) DO NOTHING`, [wu]);
    await pool.query(`INSERT INTO worker_categories SELECT $1, id FROM service_categories ON CONFLICT DO NOTHING`, [wu]);
    await pool.query(`INSERT INTO worker_areas SELECT $1, id FROM service_areas WHERE name IN ('Gulberg','Model Town','Garden Town') ON CONFLICT DO NOTHING`, [wu]);
    const exists = (await pool.query(`SELECT 1 FROM jobs WHERE customer_id=$1 AND is_demo`, [cu])).rowCount;
    if (!exists) {
      const j = (await pool.query(
        `INSERT INTO jobs (customer_id, category_id, area_id, title, description, asap, status, is_demo, published_at, expires_at)
         SELECT $1, c.id, a.id, '[DEMO] Leaking kitchen tap', '[DEMO] Fictional job for testing: kitchen tap drips constantly and needs a washer or replacement.', true,
                'open', true, now(), now() + interval '7 days'
         FROM service_categories c, service_areas a WHERE c.slug='plumbing' AND a.name='Gulberg' RETURNING id`, [cu])).rows[0].id;
      await pool.query(`INSERT INTO job_private (job_id, address_text) VALUES ($1,'[DEMO] Fictional address')`, [j]);
    }
    console.log("demo accounts/job created (all labelled [DEMO]; no reviews seeded)");
  }
  await pool.end();
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
