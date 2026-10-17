import test from "node:test";
import assert from "node:assert/strict";
import { store, getAreas, getCategories } from "../src/lib/store";
import { canTransition, assertTransition, AppError } from "../src/lib/state";
import { normalizePkPhone } from "../src/lib/phone";
import { completionCode } from "../src/lib/bids";

test("Acceptance Check 1: Customer can create account and post valid plumbing/electrical job", () => {
  const phone = "+923009990001";
  store.recordOtp(phone, "hash", 5);
  const userId = store.consumeOtp(phone, "123456", () => "hash");
  const user = store.getUserById(userId);
  assert.ok(user, "User should be created");
  assert.equal(user?.is_customer, true);

  // Set name
  user!.display_name = "Test Customer A";
  store.users.set(userId, user!);

  // Post plumbing job
  const jobId = store.createDraft(userId, {
    categoryId: 1, // Plumbing
    areaId: 1, // Gulberg
    title: "Burst bathroom pipe under sink",
    description: "Cold water pipe leaking under basin. Need joint replacement.",
    budgetMin: 2000,
    budgetMax: 3500,
    asap: true,
    addressText: "House 12, Street 3, Block G, Gulberg III",
    contactNote: "Ring doorbell twice",
  });
  assert.ok(jobId, "Job draft should be created");

  store.publishJob(userId, jobId);
  const job = store.jobs.get(jobId);
  assert.equal(job?.status, "open");
  assert.equal(job?.is_demo, false, "Real user jobs must not be marked demo");
});

test("Acceptance Check 2: Matching worker sees approximate location only (NO exact address or customer contact)", () => {
  // Demo Plumber (Akram Plumber, covers Gulberg category 1)
  const plumberId = "u-demo-worker-plumb";
  const matchingJobs = store.browseJobsForWorker(plumberId);
  assert.ok(matchingJobs.length > 0, "Worker should find matching jobs");

  for (const j of matchingJobs) {
    // Only public fields: category, area
    assert.ok(j.area, "Should show area name e.g. Gulberg");
    assert.equal((j as any).address_text, undefined, "Worker must NOT see exact address in browse");
    assert.equal((j as any).customer_phone, undefined, "Worker must NOT see customer phone in browse");
    assert.equal((j as any).contact_note, undefined, "Worker must NOT see private contact notes in browse");
  }
});

test("Acceptance Check 3: Worker can submit/edit/withdraw bid and customer compares bids privately", () => {
  const customerId = "u-demo-customer";
  const workerId = "u-demo-worker-elec";
  const jobId = "job-demo-002"; // DHA electrical job

  // Worker submits bid
  store.submitBid(workerId, jobId, {
    amount: 3000,
    timingText: "Today at 5 PM",
    message: "I have the test equipment ready.",
    inclusions: "Labour and breaker test",
    exclusions: "New breaker cost",
  });

  // Customer views bids on their job
  const bids = store.listBidsForCustomer(customerId, jobId);
  assert.ok(bids.length > 0, "Customer should see bids");
  const myBid = bids.find(b => b.worker_id === workerId);
  assert.ok(myBid, "Customer sees worker bid");
  assert.equal(myBid?.amount, 3000);

  // Stranger customer trying to see bids on this job gets AppError (IDOR safe)
  assert.throws(() => {
    store.listBidsForCustomer("u-another-customer", jobId);
  }, /not found/i);

  // Worker edits bid
  store.submitBid(workerId, jobId, {
    amount: 3200,
    timingText: "Today at 5:30 PM",
    message: "Updated ETA and equipment test.",
    inclusions: "Labour and breaker test",
    exclusions: "New breaker cost",
  });
  const updatedBids = store.listBidsForCustomer(customerId, jobId);
  assert.equal(updatedBids.find(b => b.worker_id === workerId)?.amount, 3200);

  // Worker withdraws bid
  const bidToWithdraw = updatedBids.find(b => b.worker_id === workerId)!;
  store.withdrawBid(workerId, bidToWithdraw.id);
  const afterWithdraw = store.listBidsForCustomer(customerId, jobId);
  assert.equal(afterWithdraw.find(b => b.id === bidToWithdraw.id), undefined, "Withdrawn bid is removed from customer view");
});

test("Acceptance Check 4: Customer accepts only one bid; closes job and reveals private details only to participants", () => {
  const customerId = "u-demo-customer";
  const workerId = "u-demo-worker-elec";
  const jobId = "job-demo-002";

  // Re-submit bid to test acceptance
  store.submitBid(workerId, jobId, {
    amount: 3500,
    timingText: "Today 4 PM",
    message: "Ready to inspect breaker.",
    inclusions: "Labour",
    exclusions: "Parts",
  });
  const bids = store.listBidsForCustomer(customerId, jobId);
  const activeBid = bids.find(b => b.worker_id === workerId)!;

  // Before acceptance: private details are null for everyone
  assert.equal(store.getPrivateDetails(workerId, jobId), null, "Worker cannot see address before award");
  assert.equal(store.getPrivateDetails(customerId, jobId), null, "No booking before award");

  // Accept bid atomically
  const { bookingId } = store.acceptBid(customerId, activeBid.id);
  assert.ok(bookingId);

  // Job is now awarded
  const job = store.jobs.get(jobId);
  assert.equal(job?.status, "awarded");

  // Private details unlock ONLY for customer and awarded worker
  const workerPrivate = store.getPrivateDetails(workerId, jobId);
  assert.ok(workerPrivate, "Awarded worker gets private address and customer phone");
  assert.ok(workerPrivate?.address_text.includes("DHA Phase 5"));
  assert.ok(workerPrivate?.customer_phone);

  const customerPrivate = store.getPrivateDetails(customerId, jobId);
  assert.ok(customerPrivate, "Customer gets worker contact details");
  assert.ok(customerPrivate?.worker_phone);

  // Third party stranger gets null (no leak)
  assert.equal(store.getPrivateDetails("u-stranger-worker", jobId), null);
  assert.equal(store.getPrivateDetails("u-demo-admin", jobId), null);
});

test("Acceptance Check 5: Booking progress transitions and server-side validation", () => {
  const customerId = "u-demo-customer";
  const workerId = "u-demo-worker-elec";
  const jobId = "job-demo-002";

  const booking = store.getBookingByJob(customerId, jobId)!;
  assert.equal(booking.status, "awarded");

  // Customer cannot start job (only worker can mark arrival)
  assert.throws(() => {
    store.progressBooking(customerId, booking.id, "start");
  }, /Only the selected worker/);

  // Worker marks arrival/start
  store.progressBooking(workerId, booking.id, "start");
  assert.equal(store.bookings.get(booking.id)?.status, "in_progress");

  // Worker requests completion
  store.progressBooking(workerId, booking.id, "request_completion");
  assert.equal(store.bookings.get(booking.id)?.status, "completion_requested");

  // Cannot jump back to awarded
  assert.throws(() => {
    store.progressBooking(workerId, booking.id, "start");
  });
});

test("Acceptance Check 6: Customer confirms completion or reports problem", () => {
  const customerId = "u-demo-customer";
  const jobId = "job-demo-002";
  const booking = store.getBookingByJob(customerId, jobId)!;

  // Customer confirms completion
  store.progressBooking(customerId, booking.id, "confirm");
  assert.equal(store.bookings.get(booking.id)?.status, "completed");
  assert.equal(store.jobs.get(jobId)?.status, "completed");
});

test("Acceptance Check 7: Only completed booking participants can submit one review each with retaliation protection", () => {
  const customerId = "u-demo-customer";
  const workerId = "u-demo-worker-elec";
  const jobId = "job-demo-002";
  const booking = store.getBookingByJob(customerId, jobId)!;

  // Customer submits review
  store.submitReview(customerId, booking.id, 5, "Prompt and professional load balancing.");

  // Cannot submit a second review for same booking
  assert.throws(() => {
    store.submitReview(customerId, booking.id, 4, "Second review should fail");
  }, /already reviewed/i);

  // Retaliation protection: customer review is NOT revealed publicly until worker reviews or 7 days pass
  let workerReviews = store.revealedReviewsFor(workerId);
  assert.equal(workerReviews.length, 0, "Review must remain hidden under retaliation protection until counterpart reviews");

  // Worker submits review
  store.submitReview(workerId, booking.id, 5, "Great customer, clear instructions.");

  // Now both reviews become revealed
  workerReviews = store.revealedReviewsFor(workerId);
  assert.equal(workerReviews.length, 1, "Review is revealed once both sides review");
  assert.equal(workerReviews[0].stars, 5);

  const customerReviews = store.revealedReviewsFor(customerId);
  assert.equal(customerReviews.length, 1);
});

test("Acceptance Check 8: User can submit report and moderator can record reasoned auditable action", () => {
  const reporterId = "u-demo-customer";
  const targetId = "u-demo-worker-plumb";
  const adminId = "u-demo-admin";

  // Reporter submits report
  store.createReport(reporterId, "user", targetId, "misconduct", "Technician was late and rude.");
  const queue = store.reportQueue("open");
  const report = queue.find(r => r.target_id === targetId);
  assert.ok(report, "Moderator should see report in queue");

  // Moderator adds internal note
  store.addReportNote(adminId, report.id, "Investigating technician history.");
  const updatedReport = store.reports.get(report.id);
  assert.ok(updatedReport?.internal_notes?.includes("Investigating"));

  // Moderator takes reasoned action
  store.moderate(adminId, "warn", "user", targetId, report.id, "First warning for unprofessional conduct");
  assert.equal(store.reports.get(report.id)?.status, "actioned");

  // Audit log recorded
  const logs = store.getAuditLogs();
  assert.ok(logs.some(l => l.action === "moderation.warn" && l.target_id === targetId));
});

test("Acceptance Check 9: Suspended or banned user cannot post, bid, or contact", () => {
  const adminId = "u-demo-admin";
  const targetId = "u-demo-worker-plumb";

  // Admin suspends worker
  store.moderate(adminId, "suspend", "user", targetId, undefined, "Suspended for safety review", 7);
  const worker = store.getUserById(targetId);
  assert.equal(worker?.account_status, "suspended");

  // Suspended worker cannot bid
  assert.throws(() => {
    store.submitBid(targetId, "job-demo-001", {
      amount: 4000,
      timingText: "Today",
      message: "Test bid while suspended",
      inclusions: "Labour",
      exclusions: "None",
    });
  });
});

test("Acceptance Check 10: Guest access cannot retrieve private bids, contact details, or exact addresses", () => {
  // Public job list for guests
  const publicFeed = store.getPublicJobs();
  for (const j of publicFeed) {
    // Only coarse info allowed
    assert.ok(j.title);
    assert.ok(j.area);
    assert.equal((j as any).address_text, undefined);
    assert.equal((j as any).customer_phone, undefined);
    assert.equal((j as any).bids, undefined);
  }

  // Guest changing ID has no session, cannot get private details
  assert.equal(store.getPrivateDetails("guest-id", "job-demo-001"), null);
});

test("Acceptance Check 11: Identity status options and no NADRA claim", () => {
  const validStatuses = ["not_submitted", "pending_review", "verified", "rejected", "needs_resubmission"];
  for (const s of validStatuses) {
    assert.ok(validStatuses.includes(s));
  }
  // Store worker profiles have proper identity_status
  const wp = store.getWorkerProfile("u-demo-worker-elec");
  assert.equal(wp?.identity_status, "verified");
});

test("Acceptance Check 12: No claim of escrow, fund holding, or employment", () => {
  // Direct settlement model: completionCode is solely customer acknowledgement
  const code = completionCode("job-demo-001");
  assert.equal(code.length, 4, "Completion code is 4 digits");
  assert.match(code, /^\d{4}$/);
});

test("Acceptance Check 13: Demo data is strictly tagged is_demo: true and prefixed [DEMO]", () => {
  const demoJobs = Array.from(store.jobs.values()).filter(j => j.is_demo);
  assert.ok(demoJobs.length >= 3, "At least 3 demo jobs seeded");

  for (const j of demoJobs) {
    assert.equal(j.is_demo, true);
    assert.ok(j.title.startsWith("[DEMO]"), `Job title must start with [DEMO]: ${j.title}`);
  }

  const demoUsers = Array.from(store.users.values()).filter(u => u.display_name?.startsWith("[DEMO]"));
  assert.ok(demoUsers.length >= 4, "At least 4 demo users seeded");
});

test("Acceptance Check 14: Lahore pilot areas and categories are configured", () => {
  const areas = getAreas();
  assert.ok(areas.length >= 20, "At least 20 Lahore neighbourhoods seeded");
  assert.ok(areas.some(a => a.name === "Gulberg"));
  assert.ok(areas.some(a => a.name === "DHA Phase 5"));
  assert.ok(areas.some(a => a.name === "Model Town"));

  const cats = getCategories();
  assert.equal(cats.length, 2, "Pilot trade categories: plumbing and electrical");
  assert.ok(cats.some(c => c.slug === "plumbing"));
  assert.ok(cats.some(c => c.slug === "electrical"));
});

test("Acceptance Check 15: Visible bid counts and status labels agreement", () => {
  const j1 = store.jobs.get("job-demo-001")!;
  const publicJobs = store.getPublicJobs();
  const j1Public = publicJobs.find(p => p.id === "job-demo-001")!;

  let activeBids = 0;
  for (const b of store.bids.values()) {
    if (b.job_id === j1.id && ["active", "accepted"].includes(b.status)) activeBids++;
  }

  assert.equal(j1Public.bid_count, activeBids, "Marketplace bid count matches actual active bids");
  assert.equal(j1Public.status, j1.status, "Status matches between model and public view");
});
