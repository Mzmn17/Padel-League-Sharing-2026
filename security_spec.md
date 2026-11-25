# Firestore Security Specification (Phase 0)

## Data Invariants
1. All tournament documents (`categories`, `courts`, `participants`, `teams`, `matches`, `brackets`) belong strictly to `tournamentId == "pls-2026"` and cannot be orphaned or given arbitrary IDs > 64 chars.
2. Verified authenticated administrators (`muhazman441@gmail.com` with `email_verified == true` or users present in `/admins/{uid}`, plus authenticated Panitia sessions on server API routes) hold equal administrative authority to mutate `tournaments`, `categories`, `courts`, `teams`, `matches`, `brackets`, `/admins`, or edit/delete `participants`.
3. Verified signed-in users may create a new `participant` only with `status == "registered"`, `createdByUid == request.auth.uid`, and an existing `categoryId` in `/categories/{categoryId}`.
4. `participants` and `teams` contain zero PII (no phone numbers, no emails, no addresses). `/admins/{uid}` is strictly isolated so only the owner (`request.auth.uid == uid`) or an admin can read it.
5. `createdAt` / `serverCreatedAt` are immutable after creation; `serverUpdatedAt` must equal `request.time`.
6. Once a `match` reaches terminal status `completed`, non-admins cannot alter it (only `isAdmin()` override is permitted).
7. Shadow/ghost fields are rejected on every create and update via `keys().hasOnly(...)` and `affectedKeys().hasOnly(...)`.

## Dirty Dozen Attack Payloads (Expected: PERMISSION_DENIED)
1. Unauthenticated write to `/participants/p-hack` (no `request.auth`).
2. Unverified email spoof (`email == "muhazman441@gmail.com"`, `email_verified == false`) writing to `/matches/match-1`.
3. Non-admin user updating `/matches/match-1` score (`currentPointA: "40"`).
4. Non-admin user elevating privilege by creating `/admins/{uid}` with `role: "admin"`.
5. Non-admin user reading another user's `/admins/{otherUid}` document.
6. Authenticated non-admin user creating a participant with `status: "checked_in"` instead of `"registered"`.
7. Authenticated non-admin user spoofing `createdByUid` to someone else's UID on participant create.
8. Oversized string DoS / Denial-of-Wallet attack (`name` > 100 chars or document ID > 128 chars).
9. Shadow/Ghost field injection on update/create (e.g., adding `isVerified: true` or `role: "admin"` on `/participants/{id}`).
10. Orphaned participant/team creation referencing a non-existent `categoryId` (`"cat-fake"`).
11. Timestamp forgery (`serverUpdatedAt` set to a client-chosen past timestamp instead of `request.time`).
12. Mutating immutable `serverCreatedAt` or `createdAt` during an update on `/participants/{id}` or `/teams/{id}`.
