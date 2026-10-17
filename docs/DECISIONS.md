# Architectural & Product Decisions: Kaam Lahore MVP

## 1. Marketplace Model: Open-Bid vs. Dispatch / Employment

- **Explicit Boundary:** Kaam Lahore is an open-bid classifieds and bidding board for independent service workers, **not** an on-demand dispatch or home-services company.
- **Worker Independence:** Workers register independently, select their own trade categories (plumbing, electrical) and Lahore service areas, and choose whether to bid on incoming jobs.
- **Customer Autonomy:** Customers create jobs and evaluate bids side-by-side using multi-dimensional criteria (total labour price, timing window, worker bio/experience, completed job count, star ratings, and manual ID review badge). Customers choose whom to hire. The platform never automatically picks a winner or sets prices.
- **No Employment Relationship:** Workers are never employees, contractors, or agents of the platform.

---

## 2. Payments & Financial Disclaimers

- **Zero-Funds Architecture:** The platform holds no customer or worker funds. There are no wallets, escrow accounts, commission deductions, or refund mechanisms.
- **Direct Settlement:** Customers and workers settle payment directly with one another outside the platform (cash, Raast, bank transfer, mobile wallet).
- **No Guarantee of Workmanship or Payment:** Explicitly stated in headers, footers, post forms, bidding cards, terms, and dedicated `/payments` trust documentation.
- **Dispute Boundary:** When a party marks a booking "disputed", the booking enters the moderation queue for human review. Resolving a dispute records booking status only (`completed` or `cancelled`); it does not withhold or reverse payment.

---

## 3. Currency & Time Representation

- **Currency (PKR):**
  - Stored as integer whole rupees (`INTEGER` in PostgreSQL).
  - Rationale: Paisa are obsolete in contemporary Pakistani retail transactions. Using integer whole PKR avoids floating-point precision issues while matching real-world quotation practices (e.g., Rs 1,500).
  - Formatted using `Intl.NumberFormat('en-PK')` with prefix `Rs`.
- **Timezone (Asia/Karachi):**
  - All database columns use `timestamptz` (stored in UTC).
  - All user-facing timestamps, job expirations, arrival windows, and review reveal deadlines are rendered in `Asia/Karachi` (UTC+5, no Daylight Saving Time).

---

## 4. Privacy & Location Architecture

- **Two-Tier Location Model:**
  - **Public / Bidder Tier:** Stored in `jobs.area_id` referencing pre-seeded Lahore neighbourhoods (e.g. Gulberg, DHA Phase 5, Johar Town). Only this coarse area name and category are visible to prospective bidders.
  - **Private / Booking Tier:** Stored in `job_private` (`address_text`, `contact_note`, `precise_point`). Accessible **exclusively** to the customer and the single awarded worker while the booking is active (`awarded`, `in_progress`, `completion_requested`, `disputed`).
- **PostGIS Matching:** PostGIS spatial indexes (`geography(Point,4326)`) match jobs against workers' selected coverage areas or radius without ever exposing the precise coordinates to unselected bidders.
- **No Continuous Location Tracking:** Neither workers nor customers are tracked. Geolocation in the browser is strictly optional, read once upon button tap, and used purely to suggest matching neighbourhoods with an immediate manual fallback.
- **EXIF Metadata Stripping:** All image uploads are re-encoded via HTML5 canvas before transmission, stripping GPS and camera metadata. Direct uploads bearing EXIF segments are rejected on the server.

---

## 5. Phone Authentication & Provider Abstraction

- **Normalized E.164 (+92):** All Pakistani numbers (e.g. `03001234567`, `0300-1234567`, `+92 300 1234567`) normalize to `+923001234567`.
- **Passwordless OTP:** Reduces friction for tradespeople and eliminates password compromise risks.
- **Development OTP Guardrail:** `devOtpEnabled()` displays the generated OTP code in the UI **only** when `NODE_ENV !== 'production'`, `ENABLE_DEV_OTP === 'true'`, and the application URL points to `localhost`. If deployed to production, dev OTP is hard-disabled.
- **Real SMS Provider Interface:** `OtpProvider` interface in `src/lib/otp/provider.ts` is ready for integration with an SMS gateway (e.g., Twilio, Telenor, Jazz, or SMSCountry).

---

## 6. Reputation & Anti-Retaliation Reviews

- **Eligibility:** Only verified participants of a `completed` booking can submit a review.
- **Single Submission:** Enforced by PostgreSQL unique constraint: `UNIQUE (booking_id, reviewer_id)`.
- **Anti-Retaliation Window:** To prevent retaliatory reviews (e.g. one party withholding an honest negative review fearing a vindictive response), reviews are hidden until **both** parties submit their review, or **7 days** pass, whichever comes first.
- **Balanced Metric Display:** We never show a star score in isolation. Review summaries always pair average stars with the total number of reviews and the count of completed jobs.

---

## 7. Identity Review vs. NADRA Clarification

- **No NADRA Integration:** The MVP does not connect to NADRA, nor does it simulate or claim verification against NADRA databases.
- **Manual Review Only:** A worker submitting CNIC photos receives an "ID reviewed by our team" badge only after manual visual inspection by a human moderator.
- **Disclaimers:** Clear notices explain that an ID review does not verify criminal record, background, safety, or quality of craftsmanship.
- **Secure Handling & Retention:** CNIC images are stored in private, unguessable storage paths, never in public buckets or web directories. Full CNIC numbers are never stored in database text columns. Retention is capped at a configurable window (default 30 days) after review, after which the files are securely shredded by `runMaintenance()`.
- **Upload Safety Gate:** CNIC uploads are disabled in environments where private, encrypted object storage is not configured (`ENABLE_IDENTITY_UPLOAD=false`).
