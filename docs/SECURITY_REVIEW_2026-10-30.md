# BHIMS Security Remediation Report
Date: 2026-10-30
Scope: Static review and hardening changes to the supplied PHP/MySQL source archive.

## Executive status

**Not approved for real patient data or production use.** This revision addresses several clear weaknesses, but it has not been run against a live MySQL instance, a built Docker image, or a deployed Cloudflare Worker. There has been no penetration test or independent security assessment.

## Changes applied in this revision

| Area | Change | Verification |
|---|---|---|
| CSRF | Added per-session random CSRF tokens to all POST forms; POST requests are checked centrally in protected modules and login. | Static form/token coverage; valid and invalid token helper checks. |
| State-changing requests | Patient archive, appointment/referral status changes, payroll approval, and logout now require POST. | Static scan found no old GET mutation handlers for these actions. |
| Session fixation | Regenerate session ID after successful authentication; strict session mode and cookie-only sessions. | Source review; runtime authentication flow not exercised. |
| Session cookies | HttpOnly, SameSite=Lax, production Secure cookie flag. | Source review. |
| Login throttling | Persistent attempt records keyed by IP and normalized account name; five failed attempts per key pair trigger a 15-minute block based on the combined row count. | Source review; requires login_attempts table migration. |
| Password storage | Rehash passwords when PHP's PASSWORD_DEFAULT policy changes. | Source review. |
| Default admin | Removed known default administrator seed from fresh schema; added CLI-only initial admin creation script. | Static schema/script review. |
| Configuration | Removed weak DB password fallback; Docker Compose requires explicit DB secrets. Production requires APP_KEY and a non-weak DB password. | Static config review. |
| Security headers | Added CSP, frame/content-type/referrer/permissions headers; moved inline JS into a same-origin JS file and removed inline event handlers. | Static review. |
| Patient data display | Removed contact number and PhilHealth number from patient listing; patient records are archived instead of hard-deleted; registration validates basic field constraints. | Static source review. |
| Payroll | Approval is POST-only, locks the payroll row, verifies draft status, checks for an existing ledger record, and updates payroll + ledger inside a transaction. | Source review; not run against MySQL. |
| Inventory | Stock movement and related ledger entry are transactional; rejects invalid quantities and stock-out that would create negative inventory. | Source review; not run against MySQL. |
| Audit details | Patient name removed from registration audit message; audit details bounded; raw client IP is validated. | Source review. |
| Container build context | Added `.dockerignore` to exclude `.env`, VCS data, logs, and backups. | File review. |

## Checks performed

- PHP syntax: 19 of 19 PHP files passed `php -l` using local PHP 8.4.24.
- POST forms: every detected POST form in PHP files has a CSRF field (no mismatches).
- Mutating GET handlers: none of the reviewed modules retain the former GET-based delete/approve/status handlers.
- Inline event handlers: none found in PHP files after moving confirmation logic to the local JS file.
- CSRF helper: valid token accepted; invalid token rejected with HTTP 403 behavior/message.
- No Docker, MySQL, or MariaDB executable was available in the review environment, so container build, Compose validation, SQL execution, and database-backed tests were not performed.

## Important limitations / remaining risks

1. **Authorization is still too broad for health records.** Module-level role access is not equivalent to patient-by-patient or field-level authorization. Some roles can still view more patient data than they should. A least-privilege clinical workflow must be designed and tested.
2. **The patient list still shows names, sex, and birthdate.** This remains sensitive information. The application needs a role-specific minimum-necessary view and access logging.
3. **No complete user administration workflow.** Secure invitation/provisioning, disabling, password reset, role changes, and staff-account linking remain to be built.
4. **No MFA.** Add MFA for privileged accounts and stronger approval controls for payroll/finance.
5. **Validation is not comprehensive.** All modules need server-side validation, length/range constraints, and business-rule checks. This pass added validation only to patient registration and inventory movement.
6. **Output encoding needs a complete contextual audit.** Most displayed values are escaped, but a full XSS review and dynamic payload testing are still required.
7. **Audit logs are not tamper-proof.** A database administrator could alter them. Consider restricted append-only storage or an external log destination, with retention and access controls.
8. **Sensitive data at rest is not encrypted by this code.** Assess database/storage encryption, key management, backups, and encryption of exports.
9. **No automated encrypted backup or restore drill.**
10. **No dynamic security test or penetration test.** SQL injection, stored/reflected XSS, session handling, access-control bypass, CSRF exploit attempts, and business logic need testing against an isolated staging environment.
11. **Cloudflare migration has not been completed.** The current code is PHP/MySQL and cannot be uploaded directly to Workers. Workers + D1 requires a separate backend rewrite and SQL/schema migration. This PHP hardening pass is a safer baseline, not a Cloudflare deployment artifact.
12. **Privacy/legal review is outstanding.** Before processing real resident records, the responsible organization must complete applicable privacy impact, lawful-basis, transparency, retention, access, breach response, and NPC obligations under Philippine law.

## Existing database upgrade steps

For an existing MySQL database, back up first, then apply these migrations in order:

1. `database/migrations/001_security_hardening.sql`
2. `database/migrations/002_patient_archive.sql`

Fresh databases receive the same structures through `database/schema.sql`.

Existing accounts using the former known default password must be disabled or have their passwords reset. The new schema does not seed a default administrator. Use `database/create_admin.php` from the CLI to create the first administrator.

## Deployment gate

Do not connect real patient data or expose this application publicly until all critical authorization, validation, backup, privacy, and dynamic security testing work is complete. Use fictional test data only.
