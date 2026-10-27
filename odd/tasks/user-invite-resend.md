# user-invite-resend

## Objective
Allow admins to resend an expired user invitation, and to re-invite a user that was deleted.

## Problem
- Invitation token is only created in `UserService.create`; there is no way to issue a new one after it expires.
- Deleting a user is a soft delete, so the user disappears from the list, but `UserRepository.get_by_email` does not filter deleted rows and `users.email` is unique → re-creating returns 409.

## Scope
- API: `POST /api/v1/users/{id}/resend-invite`; `create` restores a soft-deleted user with the same email and sends a new invite.
- Web: "Reenviar invitación" action for users with pending invitation in the users list (desktop + mobile).

## Constraints
- Router → Service → Repository layering; repositories flush/refresh, never commit.
- No test suite exists in `api/` → test-first exception; verify with manual API calls against the dev DB and `npm run lint`.

## Tasks
- [x] T1 (delegated: 2+ non-trivial files) API: resend endpoint + restore soft-deleted user on create
- [x] T2 (delegated, same writer) Web: resend button in users list
- [x] T3 (delegated: 2+ non-trivial files) Restore deleted users: list deleted + `POST /users/{id}/restore` + "Ver eliminados" toggle with restore button. Restore keeps password/role (user returns as it was).

## Acceptance
- Resend on a pending user invalidates previous unused tokens and emails a fresh link.
- Resend on an already-activated user → 400.
- Creating with the email of a deleted user restores it (pending invitation) and appears in the list.
- Creating with the email of an active user still → 409.

## Progress
- Branch `fix/user-invite-resend` created.
- T1+T2 verified: `import main` ok; eslint (web container) exit 0; `tsc --noEmit` exit 0. Runtime not exercised (would send real email).
- T3 verified: `import main` ok; runtime check vs dev DB (rolled back) passed; eslint exit 0; tsc exit 0. UI not checked in browser.
