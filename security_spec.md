# Firestore Security Specification

## 1. Data Invariants
1. Every document in `/users/{userId}` MUST belong strictly to the authenticated user (`userId == request.auth.uid` and `data.uid == request.auth.uid`).
2. Only verified Google/Firebase Auth accounts (`request.auth.token.email_verified == true`) may create or update their `/users/{userId}` document.
3. No unauthenticated or non-owner user may `get`, `list`, `create`, `update`, or `delete` another user's `/users/{userId}` document (PII isolation).
4. Users may NEVER escalate privileges by setting `role` to `'admin'` or injecting unknown fields (strict `hasAll` + `hasOnly` on create, `affectedKeys().hasOnly(...)` on update).
5. `uid` and `createdAt` are immutable after creation; `createdAt` (on create) and `updatedAt` (on create & update) MUST equal `request.time`.
6. Document ID `{userId}` MUST match `^[a-zA-Z0-9_\-]+$` and be at most 128 characters.

## 2. Dirty Dozen Adversarial Payloads (Must Return PERMISSION_DENIED)
1. Unauthenticated read on `/users/uid123`.
2. Authenticated user `uidA` attempting `get` on `/users/uidB`.
3. Authenticated user `uidA` attempting blanket `list` on `/users` without `uid == request.auth.uid`.
4. Unverified email token (`email_verified: false`) attempting `create` on `/users/uidA`.
5. Identity spoofing: `uidA` creating `/users/uidB` or setting `data.uid = 'uidB'`.
6. Privilege escalation: `uidA` creating `/users/uidA` with `role: 'admin'`.
7. Shadow field injection: `uidA` creating `/users/uidA` with extra key `isAdmin: true` or `ktpVerified: true`.
8. Oversized string DoS: `uidA` setting `name` > 100 chars or `avatar` > 1024 chars.
9. Client timestamp spoofing: `uidA` supplying hardcoded `createdAt` or `updatedAt` != `request.time`.
10. Immutable field mutation on update: `uidA` changing `uid` or `createdAt`.
11. Unauthorized role escalation on update: `uidA` updating `role` to `'admin'`.
12. Path traversal / malformed ID: writing `/users/invalid.id$with%chars` or >128-char ID.
