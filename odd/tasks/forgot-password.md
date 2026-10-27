# forgot-password

## Objective
Users can recover access from the login page via "¿Olvidaste tu contraseña?".

## Scope
- API: `POST /api/v1/auth/forgot-password` `{email}` → always 204 (no account enumeration). If user exists, active and not deleted: invalidate unused tokens, create a new one, send a reset email linking to `/set-password?token=...`.
- Email: `send_password_reset_email` + `templates/password_reset_email.html` matching invite template branding.
- Web: link on login, `(auth)/olvide-contrasena` page with email form and neutral success message; set-password copy works for both invite and reset.

## Constraints
- Router → Service → Repository. No test suite in `api/` → test-first exception; runtime check against dev DB with email sending stubbed.
- `invalidate_unused_for_user` must be byte-identical to the one on `fix/user-invite-resend` so both branches merge cleanly.
- No rate limiting exists in the project (follow-up, out of scope).

## Tasks
- [x] T1 (delegated: 2+ non-trivial files) API endpoint + reset email
- [x] T2 (delegated, same writer) Web: login link + forgot-password page

## Acceptance
- Unknown/inactive/deleted email → 204, no email, no token.
- Valid email → 204, previous unused tokens invalidated, one new token, email sent.
- The link sets the password through the existing `/set-password` flow.

## Progress
- Branch `feat/forgot-password` created from `main`.
- T1+T2 verified: `import main` ok; token repo identical to other branch; runtime check vs dev DB with email stubbed (rolled back) passed; template renders; eslint exit 0; tsc exit 0. UI not checked in browser.
