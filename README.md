# BHIMS — Barangay Health Information & Management System

BHIMS is a PHP 8.2 / Apache / MySQL application packaged for local development with Docker Compose.

## Important deployment status

**This repository is a hardened PHP/MySQL baseline, not yet a Cloudflare Workers application.**
Cloudflare Workers does not run this PHP/Apache Docker container as-is. A separate port to Workers + D1 is required before it can be deployed on that architecture.

Do not use real patient or payroll information in this build. It is for development with synthetic data until the remaining privacy, access-control, operational, and security work is completed.

## Security changes in this revision

- CSRF tokens on POST forms and server-side validation of POST requests.
- State-changing patient deletion, appointment/referral status changes, payroll approval, and logout use POST.
- Session ID regeneration after login; strict session mode and HttpOnly/SameSite cookies.
- Persistent login throttling keyed by client IP and account name.
- Password hash rehashing when PHP's default password algorithm changes.
- Production configuration rejects empty/known weak database passwords and missing APP_KEY.
- Security response headers and production error-display suppression.
- Payroll approval and inventory stock movement use database transactions.
- Inventory stock-out rejects negative stock.
- Patient list no longer displays contact number or PhilHealth number; patient removal is an archive action, not a hard delete.
- Patient registration validates required fields, allowed sex values, date format, and database field lengths.
- Patient name is omitted from audit detail text.
- New databases do not receive a publicly known default administrator account.

## Requirements

- Docker Engine and Docker Compose plugin.
- PHP 8.2+ for direct CLI checks (the container uses PHP 8.2).
- MySQL 8.0.

## Local development setup

1. Copy `.env.example` to `.env`.
2. Replace every placeholder with unique random values. Do not commit `.env`.
3. Start the containers:

   ```bash
   docker compose up -d --build
   ```

4. Create the first administrator from the application container (CLI only):

   ```bash
   docker compose exec -e BHIMS_ADMIN_USERNAME=admin1 \
     -e BHIMS_ADMIN_NAME="System Administrator" \
     -e BHIMS_ADMIN_PASSWORD="Use-A-Unique-Long-Password-Here" \
     app php /var/www/app/database/create_admin.php
   ```

   Use a unique password manager-generated password, and do not reuse the example above. Avoid putting real credentials into shell history on shared machines; use a secure secret-injection method for production.

5. Open `http://localhost:8080` for local development only. The container port is bound to loopback so it is not directly exposed to the public network.

For an existing database, apply `database/migrations/001_security_hardening.sql` before using the new login throttling code. Existing known default administrator accounts must be disabled or have their password reset before any deployment.

## Configuration

- `APP_ENV=development` for local work.
- Set `APP_ENV=production` only behind HTTPS.
- Set a unique `APP_KEY` of at least 32 characters.
- Set strong unique `DB_PASS` and `DB_ROOT_PASS` values.
- Keep `.env` out of version control and container build context.

## Remaining work before real deployment

1. Complete a least-privilege permission matrix, including record-level patient access.
2. Build administrator-managed user provisioning, disabling, and password-reset workflows.
3. Add field-level protection for sensitive health identifiers and define lawful purposes/retention.
4. Review all input validation, output encoding, and error paths across every module.
5. Add consultation records UI and test clinical workflows.
6. Add audit-log integrity controls, export governance, and retention policy.
7. Add automated encrypted backups and perform restore drills.
8. Perform dynamic security testing and an independent penetration test.
9. Complete the Cloudflare Workers + D1 rewrite and test it separately. MySQL SQL syntax and PHP behavior must not be assumed compatible with D1/Workers.

## Data protection warning

BHIMS processes sensitive personal information and health information. Before using actual residents' data, the responsible organization must complete the applicable privacy impact assessment, establish lawful processing and access policies, implement retention and breach-response procedures, and obtain appropriate legal/privacy review under Philippine law. This software revision is not a compliance certification.
