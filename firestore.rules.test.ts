/**
 * Adversarial "Dirty Dozen" test specification for firestore.rules.
 * Documents negative test cases verifying PERMISSION_DENIED for invalid/malicious mutations.
 */

export const DIRTY_DOZEN_TESTS = [
  {
    name: '1. Unauthenticated read/write on /users/u1',
    auth: null,
    path: 'users/u1',
    op: 'get',
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '2. Unverified email write on /users/u1',
    auth: { uid: 'u1', email: 'gv@gmail.com', email_verified: false },
    path: 'users/u1',
    op: 'create',
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '3. Self-promotion to role=admin on create',
    auth: { uid: 'u1', email: 'gv@gmail.com', email_verified: true },
    path: 'users/u1',
    op: 'create',
    payload: { role: 'admin', credits: 5 },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '4. Credit inflation on create (credits=999)',
    auth: { uid: 'u1', email: 'gv@gmail.com', email_verified: true },
    path: 'users/u1',
    op: 'create',
    payload: { role: 'teacher', credits: 999 },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '5. Shadow field injection on update',
    auth: { uid: 'u1', email: 'gv@gmail.com', email_verified: true },
    path: 'users/u1',
    op: 'update',
    payload: { isVerified: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '6. Self-granting credits without atomic unused promo code or early 24h reset',
    auth: { uid: 'u1', email: 'gv@gmail.com', email_verified: true },
    path: 'users/u1',
    op: 'update',
    payload: { credits: 100 },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '7. Invalid deduction amount (subtracting 4 not in [1, 2])',
    auth: { uid: 'u1', email: 'gv@gmail.com', email_verified: true },
    path: 'users/u1',
    op: 'update',
    payload: { credits: 1 },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '8. Client-spoofed updatedAt timestamp != request.time',
    auth: { uid: 'u1', email: 'gv@gmail.com', email_verified: true },
    path: 'users/u1',
    op: 'update',
    payload: { updatedAt: '2020-01-01T00:00:00Z' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '9. Cross-user PII read on /users/u1 by u2',
    auth: { uid: 'u2', email: 'other@gmail.com', email_verified: true },
    path: 'users/u1',
    op: 'get',
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '10. Non-admin listing /promo_codes collection',
    auth: { uid: 'u1', email: 'gv@gmail.com', email_verified: true },
    path: 'promo_codes',
    op: 'list',
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '11. Non-admin forging /promo_codes/FREE999 document',
    auth: { uid: 'u1', email: 'gv@gmail.com', email_verified: true },
    path: 'promo_codes/FREE999',
    op: 'create',
    payload: { code: 'FREE999', credit_value: 999, is_used: false },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '12. Redeeming already used promo code or inflating credit_value',
    auth: { uid: 'u1', email: 'gv@gmail.com', email_verified: true },
    path: 'promo_codes/USED10',
    op: 'update',
    payload: { is_used: true, used_by: 'u1', credit_value: 9999 },
    expected: 'PERMISSION_DENIED',
  },
];
