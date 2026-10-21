import { createClient, SupabaseClient } from "@supabase/supabase-js";

let cachedClient: SupabaseClient | null = null;
let cachedAdminClient: SupabaseClient | null = null;

/**
 * Checks whether Supabase project credentials are configured in environment variables.
 */
export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY;
  return Boolean(url && key && url.startsWith("https://") && !url.includes("your-project-id"));
}

/**
 * Returns a singleton instance of the standard Supabase client (using anon key).
 * Returns null if Supabase environment variables are missing.
 */
export function getSupabaseClient(): SupabaseClient | null {
  if (cachedClient) return cachedClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key || !url.startsWith("https://") || url.includes("your-project-id")) {
    return null;
  }

  try {
    cachedClient = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    return cachedClient;
  } catch (err) {
    console.error("[Supabase] Failed to initialize standard client:", err);
    return null;
  }
}

/**
 * Returns a privileged Supabase client using the SERVICE ROLE key.
 * Used exclusively on server-side routes and actions to bypass RLS for administrative operations.
 * Falls back to standard client if service role key is not configured.
 */
export function getSupabaseAdminClient(): SupabaseClient | null {
  if (cachedAdminClient) return cachedAdminClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (url && serviceKey && url.startsWith("https://") && !url.includes("your-project-id")) {
    try {
      cachedAdminClient = createClient(url, serviceKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });
      return cachedAdminClient;
    } catch (err) {
      console.error("[Supabase] Failed to initialize admin client:", err);
    }
  }

  return getSupabaseClient();
}

export interface SupabaseHealth {
  configured: boolean;
  connected: boolean;
  url: string | null;
  latencyMs?: number;
  error?: string;
  tables: {
    signups: boolean;
    job_leads: boolean;
    bids_activity: boolean;
  };
  counts?: {
    signups: number;
    jobLeads: number;
    bids: number;
  };
}

/**
 * Comprehensive health test for Supabase connection and schema availability.
 */
export async function testSupabaseConnection(): Promise<SupabaseHealth> {
  const configured = isSupabaseConfigured();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || null;

  if (!configured) {
    return {
      configured: false,
      connected: false,
      url,
      tables: { signups: false, job_leads: false, bids_activity: false },
      error: "Supabase environment variables (NEXT_PUBLIC_SUPABASE_URL and KEY) are not set.",
    };
  }

  const client = getSupabaseAdminClient() || getSupabaseClient();
  if (!client) {
    return {
      configured: true,
      connected: false,
      url,
      tables: { signups: false, job_leads: false, bids_activity: false },
      error: "Could not instantiate Supabase client with current credentials.",
    };
  }

  const start = Date.now();
  const tables = { signups: false, job_leads: false, bids_activity: false };
  const counts = { signups: 0, jobLeads: 0, bids: 0 };
  let errorMsg: string | undefined;

  try {
    // 1. Check signups table
    const { count: sc, error: se } = await client
      .from("signups")
      .select("*", { count: "exact", head: true });
    if (!se) {
      tables.signups = true;
      counts.signups = sc || 0;
    } else {
      errorMsg = se.message;
    }

    // 2. Check job_leads table
    const { count: jc, error: je } = await client
      .from("job_leads")
      .select("*", { count: "exact", head: true });
    if (!je) {
      tables.job_leads = true;
      counts.jobLeads = jc || 0;
    }

    // 3. Check bids_activity table
    const { count: bc, error: be } = await client
      .from("bids_activity")
      .select("*", { count: "exact", head: true });
    if (!be) {
      tables.bids_activity = true;
      counts.bids = bc || 0;
    }

    const latencyMs = Date.now() - start;
    const connected = tables.signups || tables.job_leads || tables.bids_activity;

    return {
      configured: true,
      connected,
      url,
      latencyMs,
      tables,
      counts,
      error: connected ? undefined : (errorMsg || "Tables not found in Supabase schema."),
    };
  } catch (err) {
    return {
      configured: true,
      connected: false,
      url,
      latencyMs: Date.now() - start,
      tables,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export interface SignupRecord {
  id?: string;
  name: string;
  phone: string;
  role: "customer" | "technician";
  trade?: string | null;
  area?: string | null;
  created_at?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Collects and stores user signup submissions into the Supabase 'signups' table.
 */
export async function collectSignup(data: SignupRecord): Promise<{ ok: boolean; error?: string }> {
  const client = getSupabaseClient();
  if (!client) {
    console.log("[Data Collection] Supabase not configured. Signup recorded in memory:", {
      name: data.name,
      phone: data.phone,
      role: data.role,
      trade: data.trade,
      area: data.area,
      timestamp: new Date().toISOString(),
    });
    return { ok: true };
  }

  try {
    const { error } = await client.from("signups").insert([
      {
        full_name: data.name,
        phone: data.phone,
        role: data.role,
        trade: data.trade || null,
        area: data.area || null,
        created_at: new Date().toISOString(),
        metadata: data.metadata || {},
      },
    ]);

    if (error) {
      console.warn("[Supabase] collectSignup insert note:", error.message);
      return { ok: false, error: error.message };
    }

    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[Supabase] collectSignup error:", message);
    return { ok: false, error: message };
  }
}

/**
 * Fetches recent signups from Supabase for admin reports.
 */
export async function getSignups(limit = 50): Promise<SignupRecord[]> {
  const client = getSupabaseAdminClient() || getSupabaseClient();
  if (!client) return [];

  try {
    const { data, error } = await client
      .from("signups")
      .select("id, full_name, phone, role, trade, area, created_at, metadata")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error || !data) return [];
    return data.map((r: any) => ({
      id: r.id,
      name: r.full_name,
      phone: r.phone,
      role: r.role,
      trade: r.trade,
      area: r.area,
      created_at: r.created_at,
      metadata: r.metadata,
    }));
  } catch {
    return [];
  }
}

export interface JobLeadRecord {
  id?: string;
  title: string;
  description: string;
  category: string;
  area: string;
  budgetMin?: number | null;
  budgetMax?: number | null;
  customerPhone?: string | null;
  addressText?: string | null;
  created_at?: string;
}

/**
 * Collects and stores newly posted job leads into the Supabase 'job_leads' table.
 */
export async function collectJobLead(data: JobLeadRecord): Promise<{ ok: boolean; error?: string }> {
  const client = getSupabaseClient();
  if (!client) {
    return { ok: true };
  }

  try {
    const { error } = await client.from("job_leads").insert([
      {
        title: data.title,
        description: data.description,
        category: data.category,
        area: data.area,
        budget_min: data.budgetMin || null,
        budget_max: data.budgetMax || null,
        customer_phone: data.customerPhone || null,
        address_text: data.addressText || null,
        created_at: new Date().toISOString(),
      },
    ]);

    if (error) {
      console.warn("[Supabase] collectJobLead insert note:", error.message);
      return { ok: false, error: error.message };
    }

    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[Supabase] collectJobLead error:", message);
    return { ok: false, error: message };
  }
}

/**
 * Fetches recent job leads from Supabase for admin reports.
 */
export async function getJobLeads(limit = 50): Promise<JobLeadRecord[]> {
  const client = getSupabaseAdminClient() || getSupabaseClient();
  if (!client) return [];

  try {
    const { data, error } = await client
      .from("job_leads")
      .select("id, title, description, category, area, budget_min, budget_max, customer_phone, address_text, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error || !data) return [];
    return data.map((r: any) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      category: r.category,
      area: r.area,
      budgetMin: r.budget_min,
      budgetMax: r.budget_max,
      customerPhone: r.customer_phone,
      addressText: r.address_text,
      created_at: r.created_at,
    }));
  } catch {
    return [];
  }
}

export interface BidActivityRecord {
  id?: string;
  jobId: string;
  workerPhone: string;
  amount: number;
  timingText: string;
  message?: string;
  created_at?: string;
}

/**
 * Logs technician bidding activity into the Supabase 'bids_activity' table.
 */
export async function collectBidActivity(data: BidActivityRecord): Promise<{ ok: boolean; error?: string }> {
  const client = getSupabaseClient();
  if (!client) return { ok: true };

  try {
    const { error } = await client.from("bids_activity").insert([
      {
        job_id: data.jobId,
        worker_phone: data.workerPhone,
        amount: data.amount,
        timing_text: data.timingText,
        message: data.message || "",
        created_at: new Date().toISOString(),
      },
    ]);

    if (error) {
      console.warn("[Supabase] collectBidActivity note:", error.message);
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

// ---------- Supabase Private Storage Helpers ----------

/**
 * Uploads a file buffer to a private Supabase Storage bucket.
 */
export async function uploadToSupabaseStorage(
  bucket: string,
  key: string,
  data: Buffer,
  contentType: string,
): Promise<{ key: string; error?: string }> {
  const client = getSupabaseAdminClient() || getSupabaseClient();
  if (!client) throw new Error("Supabase is not configured.");

  const { error } = await client.storage
    .from(bucket)
    .upload(key, data, { contentType, upsert: true });

  if (error) {
    throw new Error(`Supabase Storage upload failed: ${error.message}`);
  }
  return { key };
}

/**
 * Downloads a private file buffer from Supabase Storage.
 */
export async function getFromSupabaseStorage(bucket: string, key: string): Promise<Buffer> {
  const client = getSupabaseAdminClient() || getSupabaseClient();
  if (!client) throw new Error("Supabase is not configured.");

  const { data, error } = await client.storage.from(bucket).download(key);
  if (error || !data) {
    throw new Error(`Supabase Storage download failed: ${error?.message || "File not found"}`);
  }

  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Deletes a file from Supabase Storage.
 */
export async function deleteFromSupabaseStorage(bucket: string, key: string): Promise<void> {
  const client = getSupabaseAdminClient() || getSupabaseClient();
  if (!client) return;
  await client.storage.from(bucket).remove([key]);
}
