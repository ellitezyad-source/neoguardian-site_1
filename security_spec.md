# NeoGuardian Firestore Security Specification (Phase 0)

## 1. Data Invariants
1. **Strict Ownership**: Every `users/{userId}` document belongs strictly to `request.auth.uid == userId`. Every `patients/{patientId}` document belongs strictly to `ownerId == request.auth.uid`.
2. **Verified Identity**: All authenticated reads and writes require `request.auth != null && request.auth.token.email_verified == true`.
3. **Immutable Audit & Ownership Fields**: `uid`, `ownerId`, and `createdAt` can never change after creation, and `createdAt`/`updatedAt` must strictly equal `request.time`.
4. **No Shadow Fields**: Both `create` and `update` enforce strict allowlists (`hasAll`/`hasOnly` on create, `affectedKeys().hasOnly(...)` on update) and explicit type/length bounds.
5. **Terminal State Lock**: Once a patient profile reaches `status == 'discharged'`, clinical monitoring edits are locked unless explicitly re-admitted (`status -> 'active'`) by the owner.

## 2. The "Dirty Dozen" Attack Payloads (All Must Return PERMISSION_DENIED)
1. **Unauthenticated read/write**: Any request without `request.auth`.
2. **Unverified email spoofing**: Authenticated user with `email_verified: false` attempting to create `/patients/p1`.
3. **Cross-user profile read (PII leak)**: User A reading `/users/userB`.
4. **Cross-user patient read**: User A reading `/patients/pB` where `ownerId == userB`.
5. **Identity spoofing on create**: User A creating `/patients/p1` with `ownerId: "userB"`.
6. **Shadow field injection on create**: Creating `/patients/p1` with extra field `isAdmin: true`.
7. **Shadow field injection on update**: Updating `/patients/p1` with extra field `role: "admin"`.
8. **Immutable ownerId hijack**: Updating `/patients/p1` to change `ownerId` from `userA` to `userB`.
9. **Client-forged timestamp**: Creating `/patients/p1` with `createdAt` not equal to `request.time`.
10. **ID poisoning**: Creating `/patients/../../bad$id` (fails `^[a-zA-Z0-9_\\-]+$`).
11. **Denial-of-Wallet string overflow**: Creating `/patients/p1` with a 5,000-character `medicalNotes` string (`> 500`).
12. **Unscoped list scraping**: Listing `/patients` without filtering to `ownerId == request.auth.uid`.
