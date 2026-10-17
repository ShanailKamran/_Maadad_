export interface PublicJobItem {
  id: string;
  title: string;
  description: string;
  category: string;
  area: string;
  status: string;
  budget_min: number | null;
  budget_max: number | null;
  asap: boolean;
  preferred_at: string | Date | null;
  created_at: string | Date;
  expires_at: string | Date;
  bid_count: number;
  my_bid_status?: string | null;
  is_demo?: boolean;
}

export type CustomerJobItem = PublicJobItem & { customer_id?: string };

export interface BookingItem {
  id: string;
  job_id: string;
  customer_id: string;
  worker_id: string;
  status: string;
  amount: number;
  title: string;
  customer_name?: string | null;
  worker_name?: string | null;
  selected_at: string | Date;
  completed_at?: string | Date | null;
}

export interface WorkerBidItem {
  id: string;
  job_id: string;
  title: string;
  amount: number;
  status: string;
  job_status: string;
  updated_at: string | Date;
}

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  read_at: string | Date | null;
  created_at: string | Date;
  ref_type?: string | null;
  ref_id?: string | null;
}

export interface ReportItem {
  id: string;
  target_type: string;
  target_id: string;
  reason?: string;
  category?: string;
  details?: string | null;
  status: string;
  created_at: string | Date;
}

export interface AuditLogItem {
  id: string;
  actor_id?: string | null;
  action: string;
  target_type: string;
  target_id: string;
  created_at: string | Date;
}

export interface WorkerProfileData {
  bio: string;
  experience_years: number;
  accepting_bids: boolean;
  identity_status: string;
  categories: number[];
  areas: number[];
}

export interface AreaOption {
  id: number;
  name: string;
}

export interface CategoryOption {
  id: number;
  name: string;
  slug: string;
}

export interface DemoAccount {
  phone: string;
  name: string;
  role: string;
  blurb: string;
}

export interface AppUser {
  id: string;
  phone: string;
  display_name: string | null;
  is_customer: boolean;
  is_worker: boolean;
  is_admin: boolean;
  account_status: string;
}

export type ViewId =
  | "marketplace"
  | "post"
  | "jobs"
  | "worker"
  | "notifications"
  | "settings"
  | "moderation"
  | "signin";
