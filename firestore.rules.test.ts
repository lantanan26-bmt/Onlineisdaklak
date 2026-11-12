/**
 * Verification specification test cases for firestore.rules
 * Validates the "Dirty Dozen" security invariants against rule logic.
 */

export const DIRTY_DOZEN_CASES = [
  { name: 'Unauthenticated Exam Overwrite', collection: 'exams/exam-grade-2', operation: 'update', expected: 'PERMISSION_DENIED' },
  { name: 'Unauthenticated Teacher List Scraping', collection: 'teacher_accounts', operation: 'list', expected: 'PERMISSION_DENIED' },
  { name: 'Non-admin Teacher PII Read', collection: 'teacher_accounts/gv_thuha/private/contact', operation: 'get', expected: 'PERMISSION_DENIED' },
  { name: 'Unverified Email Spoofing', collection: 'exams/exam-grade-2', operation: 'create', auth: { email: 'lantanan26@gmail.com', email_verified: false }, expected: 'PERMISSION_DENIED' },
  { name: 'Shadow Field Injection on Student Submit', collection: 'students/HS2001', operation: 'update', payload: { isAdmin: true, score: 10 }, expected: 'PERMISSION_DENIED' },
  { name: 'Student Identity Tampering on Submit', collection: 'students/HS2001', operation: 'update', payload: { name: 'Changed Name', score: 10 }, expected: 'PERMISSION_DENIED' },
  { name: 'Terminal State Re-submit Overwrite', collection: 'students/HS2001', operation: 'update', existing: { submittedAt: '10:00' }, expected: 'PERMISSION_DENIED' },
  { name: 'Orphaned Submission Without Student', collection: 'submissions/sub_fake', operation: 'create', payload: { studentId: 'NON_EXISTENT' }, expected: 'PERMISSION_DENIED' },
  { name: 'ID Poisoning Long ID', collection: 'submissions/' + 'A'.repeat(200), operation: 'create', expected: 'PERMISSION_DENIED' },
  { name: 'Client-Forged Timestamp', collection: 'submissions/sub_1', operation: 'create', payload: { createdAt: '2020-01-01' }, expected: 'PERMISSION_DENIED' },
  { name: 'Unbounded Schools Array', collection: 'app_config/main', operation: 'create', payload: { schoolsCount: 100 }, expected: 'PERMISSION_DENIED' },
  { name: 'Self-Assigned Admin Escalation', collection: 'admins/attacker_uid', operation: 'create', expected: 'PERMISSION_DENIED' }
];
