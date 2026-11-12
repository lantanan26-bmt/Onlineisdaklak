# Firestore Security Specification (Phase 0 TDD)

## 1. Data Invariants
1. **Default Deny:** Unmatched paths are permanently denied (`allow read, write: if false;`).
2. **ID Poisoning Guard:** All document IDs (`examId`, `batchId`, `studentId`, `submissionId`, `username`, `configId`) must pass `isValidId(id)` (`^[a-zA-Z0-9_\-]+$`, length `1..128`).
3. **No Open Reads or Open Writes:** Neither `allow read: if true;` nor `allow write: if true;` is permitted.
4. **Admin Bootstrap & Verified Email:** Admin operations require Firebase Auth with `request.auth.token.email_verified == true` and either an entry in `/admins/{uid}` or the bootstrapped admin email `lantanan26@gmail.com`.
5. **PII Isolation:** Teacher `email` and `phone` are split into `/teacher_accounts/{username}/private/{contactDocId}` and restricted strictly to `isAdmin()`.
6. **Teacher Account Scraping Prevention:** `/teacher_accounts` forbids unauthenticated `list`; only `isAdmin()` may list all teacher accounts.
7. **Student Submission Terminal State Locking:** A student may submit an exam score onto `/students/{studentId}` ONLY when `existing().submittedAt == null` (never overwriting an already-submitted grade unless `isAdmin()` resets it for a retake), and immutable identity fields (`id`, `name`, `grade`, `className`, `school`) cannot be modified during score submission.
8. **Temporal Integrity:** Server timestamps (`request.time`) are enforced on `updatedAt` / `createdAt` for all writes.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Unauthenticated Exam Overwrite:** Anonymous client attempts `update` on `/exams/exam-grade-2` with `{ title: "Hacked" }` -> **PERMISSION_DENIED**.
2. **Unauthenticated Teacher List Scraping:** Anonymous client queries `list` on `/teacher_accounts` -> **PERMISSION_DENIED**.
3. **Teacher PII Access:** Non-admin authenticated user reads `/teacher_accounts/gv_thuha/private/contact` -> **PERMISSION_DENIED**.
4. **Email Spoofing Admin Bypass:** Attacker creates account with `email: "lantanan26@gmail.com"` and `email_verified: false` -> **PERMISSION_DENIED** (`email_verified == true` required).
5. **Shadow Field Injection on Student Submit:** Student submits score to `/students/HS2001` with extra field `isAdmin: true` -> **PERMISSION_DENIED** (`affectedKeys().hasOnly(...)` blocks it).
6. **Student Identity Tampering on Submit:** Student attempts to change `name` or `school` during score submission on `/students/HS2001` -> **PERMISSION_DENIED**.
7. **Score Re-submission Overwrite (Terminal State Bypass):** Student attempts to overwrite `/students/HS2001` when `submittedAt` is already set -> **PERMISSION_DENIED**.
8. **Orphaned Submission Creation:** Attacker creates `/submissions/sub_fake` referencing non-existent `studentId: "FAKE_999"` -> **PERMISSION_DENIED** (`exists()` check fails).
9. **ID Poisoning Attack:** Attacker attempts to create `/submissions/` with a 200-char ID containing `/` or spaces -> **PERMISSION_DENIED** (`isValidId()` fails).
10. **Client-Forged Timestamp:** Attacker creates `/submissions/sub_1` with `createdAt: "2020-01-01T00:00:00Z"` instead of `request.time` -> **PERMISSION_DENIED**.
11. **Unbounded Array / Payload Bomb:** Attacker tries to write `/app_config/main` with `schools` array of 500 items -> **PERMISSION_DENIED** (`schools.size() <= 50`).
12. **Privilege Escalation on Admins Collection:** Signed-in non-admin tries to write `/admins/{theirUid}` -> **PERMISSION_DENIED**.
