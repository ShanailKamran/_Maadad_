import test from "node:test";
import assert from "node:assert/strict";
import { normalizePkPhone, maskPhone } from "../src/lib/phone";
import { canTransition, assertTransition, AppError } from "../src/lib/state";
import { pkr, budgetText, parseKarachiLocal } from "../src/lib/format";
import { looksLikePhone, LAHORE_BBOX, bidSchema } from "../src/lib/validation";
import { redact, redactText } from "../src/lib/logger";
import { completionCode } from "../src/lib/bids";

test("Pakistan phone normalization & validation", () => {
  assert.equal(normalizePkPhone("03001234567"), "+923001234567");
  assert.equal(normalizePkPhone("0300-1234567"), "+923001234567");
  assert.equal(normalizePkPhone("0300 1234567"), "+923001234567");
  assert.equal(normalizePkPhone("+92 300 1234567"), "+923001234567");
  assert.equal(normalizePkPhone("923001234567"), "+923001234567");
  assert.equal(normalizePkPhone("00923001234567"), "+923001234567");
  assert.equal(normalizePkPhone("3001234567"), "+923001234567");

  // Invalid numbers
  assert.equal(normalizePkPhone("04235881234"), null); // PTCL landline (not mobile)
  assert.equal(normalizePkPhone("+14155552671"), null); // US number
  assert.equal(normalizePkPhone("12345"), null); // Too short
  assert.equal(normalizePkPhone("030012345678"), null); // Too long

  // Masking
  assert.equal(maskPhone("+923001234567"), "+92300****567");
});

test("Explicit marketplace state machine transitions", () => {
  // Permitted transitions
  assert.equal(canTransition("draft", "open", "customer"), true);
  assert.equal(canTransition("open", "awarded", "customer"), true);
  assert.equal(canTransition("open", "cancelled", "customer"), true);
  assert.equal(canTransition("awarded", "in_progress", "worker"), true);
  assert.equal(canTransition("in_progress", "completion_requested", "worker"), true);
  assert.equal(canTransition("completion_requested", "completed", "customer"), true);
  assert.equal(canTransition("completion_requested", "in_progress", "customer"), true);
  assert.equal(canTransition("awarded", "disputed", "worker"), true);
  assert.equal(canTransition("in_progress", "disputed", "customer"), true);
  assert.equal(canTransition("disputed", "completed", "admin"), true);
  assert.equal(canTransition("disputed", "cancelled", "admin"), true);

  // Prohibited transitions
  assert.equal(canTransition("completed", "in_progress", "worker"), false);
  assert.equal(canTransition("cancelled", "open", "customer"), false);
  assert.equal(canTransition("open", "completed", "customer"), false);
  assert.equal(canTransition("awarded", "completed", "worker"), false); // cannot jump without completion_requested

  // Actor permission checks
  assert.equal(canTransition("draft", "open", "worker"), false); // worker cannot publish customer draft
  assert.equal(canTransition("awarded", "in_progress", "customer"), false); // customer cannot mark arrival for worker
  assert.equal(canTransition("completion_requested", "completed", "worker"), false); // worker cannot self-confirm completion

  assert.throws(() => assertTransition("completed", "open", "customer"), AppError);
});

test("PKR Currency and Budget formatting", () => {
  assert.equal(pkr(0), "Rs 0");
  assert.equal(pkr(1500), "Rs 1,500");
  assert.equal(pkr(250000), "Rs 250,000");
  assert.equal(pkr(null), "—");

  assert.equal(budgetText(1000, 3000), "Rs 1,000 – Rs 3,000");
  assert.equal(budgetText(1500, null), "from Rs 1,500");
  assert.equal(budgetText(null, 5000), "up to Rs 5,000");
  assert.equal(budgetText(null, null), "No budget stated");
});

test("Date and Karachi local time parsing", () => {
  const d = parseKarachiLocal("2026-10-15T14:30");
  assert.ok(d);
  assert.equal(d!.toISOString(), "2026-10-15T09:30:00.000Z"); // UTC+5
});

test("Phone number detection in public texts", () => {
  assert.equal(looksLikePhone("Call me at 0300 1234567 please"), true);
  assert.equal(looksLikePhone("My number is 0321-9876543"), true);
  assert.equal(looksLikePhone("Tap drips in kitchen, second floor"), false);
  assert.equal(looksLikePhone("Need 2 pipes of 3 inches"), false);
});

test("Lahore bounding box sanity", () => {
  // Centroid of Lahore ~ 31.52, 74.35
  assert.ok(31.52 >= LAHORE_BBOX.minLat && 31.52 <= LAHORE_BBOX.maxLat);
  assert.ok(74.35 >= LAHORE_BBOX.minLng && 74.35 <= LAHORE_BBOX.maxLng);

  // Karachi coordinates should fail Lahore bbox
  const karachiLat = 24.86, karachiLng = 67.0;
  assert.ok(karachiLat < LAHORE_BBOX.minLat || karachiLng < LAHORE_BBOX.minLng);
});

test("Bid schema validation", () => {
  const valid = bidSchema.safeParse({
    amount: "1500",
    timingText: "Today afternoon",
    message: "I carry heavy-duty pipe wrenches and can arrive within 1 hour.",
    inclusions: "Labour only",
    exclusions: "Parts",
  });
  assert.ok(valid.success);
  assert.equal(valid.data.amount, 1500);

  // Amount below min 100
  const invalidAmount = bidSchema.safeParse({
    amount: "50",
    timingText: "Tomorrow",
    message: "Valid message here",
  });
  assert.ok(!invalidAmount.success);
});

test("Sensitive log redaction", () => {
  const clean = redact({
    action: "login",
    phone: "+923001234567",
    otp_code: "123456",
    customer_address: "House 123",
    nested: {
      password_hash: "secret",
      status: "active",
    },
  }) as Record<string, unknown>;

  assert.equal(clean.action, "login");
  assert.equal(clean.phone, "[REDACTED]");
  assert.equal(clean.otp_code, "[REDACTED]");
  assert.equal(clean.customer_address, "[REDACTED]");
  assert.equal((clean.nested as Record<string, unknown>).password_hash, "[REDACTED]");
  assert.equal((clean.nested as Record<string, unknown>).status, "active");

  assert.equal(redactText("Failed to send to +923001234567 with code 500"), "Failed to send to [REDACTED_NUM] with code 500");
});

test("Deterministic 4-digit completion code generation", () => {
  const id1 = "11111111-1111-1111-1111-111111111111";
  const id2 = "22222222-2222-2222-2222-222222222222";
  const code1 = completionCode(id1);
  const code2 = completionCode(id2);

  assert.equal(code1.length, 4);
  assert.equal(code2.length, 4);
  assert.match(code1, /^\d{4}$/);
  assert.match(code2, /^\d{4}$/);
  // Consistent for same ID
  assert.equal(completionCode(id1), code1);
});
