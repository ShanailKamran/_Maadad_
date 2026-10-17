/** Explicit job/booking state machine. Pure, so it is unit-tested without a database. */
export type JobStatus =
  | "draft"
  | "open"
  | "awarded"
  | "in_progress"
  | "completion_requested"
  | "completed"
  | "disputed"
  | "cancelled"
  | "expired";

export type Actor = "customer" | "worker" | "admin" | "system";

const T: Record<JobStatus, Partial<Record<JobStatus, Actor[]>>> = {
  draft: { open: ["customer"], cancelled: ["customer"] },
  open: {
    awarded: ["customer"], // via accepting a bid
    cancelled: ["customer", "admin"],
    expired: ["system", "admin"],
  },
  awarded: {
    in_progress: ["worker"],
    cancelled: ["customer", "worker", "admin"],
    disputed: ["customer", "worker"],
  },
  in_progress: {
    completion_requested: ["worker"],
    disputed: ["customer", "worker"],
    cancelled: ["admin"],
  },
  completion_requested: {
    completed: ["customer"],
    disputed: ["customer"],
    in_progress: ["customer"], // customer says "not finished yet"
  },
  disputed: { completed: ["admin"], cancelled: ["admin"] },
  completed: {},
  cancelled: {},
  expired: {},
};

export function canTransition(from: JobStatus, to: JobStatus, actor: Actor): boolean {
  return T[from]?.[to]?.includes(actor) ?? false;
}

export function assertTransition(from: JobStatus, to: JobStatus, actor: Actor): void {
  if (!canTransition(from, to, actor)) {
    throw new AppError(`That change isn't allowed right now (${from} → ${to}).`);
  }
}

/** Statuses during which exact address / phone are shared with the two parties. */
export const CONTACT_VISIBLE: JobStatus[] = ["awarded", "in_progress", "completion_requested", "disputed"];

export class AppError extends Error {
  constructor(
    message: string,
    public code: "bad_request" | "forbidden" | "not_found" | "rate_limited" = "bad_request",
  ) {
    super(message);
  }
}
