# Barangay Health Center Information System — REST API Scaffold

Each subsystem below is an independent Express.js REST API with its own `schema.sql`.
Runs on **MySQL 8.0+** (uses `CHECK` constraints and expression `DEFAULT`s, so an
older MySQL or MariaDB won't work — MariaDB's `CHECK`/`DEFAULT (UUID())` support
diverges from MySQL 8's).

## Fastest path: you do NOT need to install MySQL yourself

If you don't want to install MySQL natively on your machine, you don't have to —
`docker-compose.yml` includes a MySQL container that automatically creates all 9
databases and loads every service's `schema.sql` the first time it starts, using
`mysql-init/init.sql` (a combined script generated from all the individual
schema files).

**All you need installed is Docker Desktop.** Then:

```bash
cd barangay-health-system
docker-compose up --build
```

That single command starts: MySQL (pre-loaded with all 9 databases + schemas),
all 9 Node REST APIs, and the NGINX gateway on port 8080. Nothing else to configure —
the `.env` files are already filled in with matching values, and `docker-compose.yml`
points every service at the MySQL container automatically.

Skip straight to **Step 7 (Test the flow)** below if you go this route.

If you'd rather run MySQL and/or the Node services natively without Docker
(e.g. connecting with MySQL Workbench), follow Steps 1–6 below instead.

## What's included per service
```
services/<name>-service/
  server.js        <- Express app + route mounting
  db.js             <- MySQL connection pool (mysql2/promise, reads DATABASE_URL from env)
  schema.sql        <- Run this against that service's database ONCE
  routes/*.js        <- REST endpoints
  package.json
  .env.example        <- Copy to .env and fill in
```

## Services and default ports

| Service | Port | Database name (suggested) |
|---|---|---|
| auth-service | 4001 | auth_db |
| patient-service | 4002 | patient_db |
| consultation-service | 4003 | consultation_db |
| mch-service | 4004 | mch_db |
| appointment-service | 4005 | appointment_db |
| inventory-service | 4006 | inventory_db |
| referral-service | 4007 | referral_db |
| reporting-service | 4008 | reporting_db |
| audit-service | 4009 | audit_db |

---

## STEP-BY-STEP (native install, no Docker for MySQL): what YOU need to do

### 1. Install prerequisites
- Node.js 18+ (`node -v` to check)
- MySQL 8.0+ running somewhere you control (local install, MySQL Workbench + a
  local server, or a managed instance)
- `npm install -g nodemon` (optional, for dev auto-reload)

### 2. Create the databases
Connect to your MySQL server (e.g. via MySQL Workbench, or `mysql -u root -p`)
and run:
```sql
CREATE DATABASE auth_db;
CREATE DATABASE patient_db;
CREATE DATABASE consultation_db;
CREATE DATABASE mch_db;
CREATE DATABASE appointment_db;
CREATE DATABASE inventory_db;
CREATE DATABASE referral_db;
CREATE DATABASE reporting_db;
CREATE DATABASE audit_db;
```
You can put all 9 on one MySQL server (fine at barangay scale) or spread them
across multiple servers later — the code doesn't care, it just uses whatever
`DATABASE_URL` you give it.

### 3. Load each service's schema
For every service, run its `schema.sql` against the matching database. In MySQL
Workbench: open the schema.sql file, select the target database from the schema
dropdown, and execute it. From the command line:
```bash
mysql -u root -p auth_db < services/auth-service/schema.sql
mysql -u root -p patient_db < services/patient-service/schema.sql
mysql -u root -p consultation_db < services/consultation-service/schema.sql
mysql -u root -p mch_db < services/mch-service/schema.sql
mysql -u root -p appointment_db < services/appointment-service/schema.sql
mysql -u root -p inventory_db < services/inventory-service/schema.sql
mysql -u root -p referral_db < services/referral-service/schema.sql
mysql -u root -p reporting_db < services/reporting-service/schema.sql
mysql -u root -p audit_db < services/audit-service/schema.sql
```
Each `schema.sql` uses `CREATE TABLE IF NOT EXISTS`, so it's safe to re-run.

### 4. Configure each service's environment
For every service folder:
```bash
cd services/<name>-service
cp .env.example .env
```
Then edit `.env` and set:
- `DATABASE_URL` — your real MySQL connection string for that service's database
  (e.g. `mysql://root:yourpassword@localhost:3306/patient_db`)
- `PORT` — leave as default unless you have a conflict
- `JWT_SECRET` — **must be the identical value in every service's `.env`**. This is
  what lets each independent service verify a login token issued by auth-service
  without calling auth-service on every request.

### 5. Install dependencies and run each service
Repeat for every service folder:
```bash
cd services/<name>-service
npm install
npm run dev        # nodemon, auto-restarts on change
# or: npm start     # plain node
```
You now have 9 independent REST APIs running on ports 4001–4009.

### 6. (Optional but recommended) Put a gateway in front of them
`gateway/nginx.conf` is included so your frontend only talks to ONE address
(e.g. `http://localhost:8080`) and NGINX routes by path prefix to the right
service. Install NGINX and point it at that config, or use
`docker-compose up` (see `docker-compose.yml`) to run everything, including
NGINX, in one command — you still create the databases and run schema.sql
against them manually per Step 2–3, whether you use Docker or not.

### 7. Test the flow
1. `POST http://localhost:4001/auth/register` → create a user, get back a JWT
2. `POST http://localhost:4002/patients` (with `Authorization: Bearer <token>`) → create a patient
3. `POST http://localhost:4003/visits` → log a visit for that patient
4. `POST http://localhost:4006/stock-transactions/dispense` → deduct inventory
5. `GET http://localhost:4008/reports/monthly?month=2026-09` → pulls data live from the other services via HTTP and summarizes it

### 8. Notes on the Postgres → MySQL rewrite
This project originally ran on Postgres; the port to MySQL touched every layer:
- **Schemas**: `UUID`/`gen_random_uuid()` → `CHAR(36)`/`DEFAULT (UUID())`,
  `TIMESTAMPTZ`/`now()` → `DATETIME`/`CURRENT_TIMESTAMP`, `JSONB` → `JSON`,
  `TEXT UNIQUE` → `VARCHAR(255) UNIQUE` (MySQL needs a bounded key length),
  inline `REFERENCES` → explicit `CONSTRAINT ... FOREIGN KEY` clauses.
- **Queries**: `pg`'s `$1, $2` placeholders → `mysql2`'s `?, ?`. Every
  `INSERT ... RETURNING *` is emulated by generating the row's UUID in Node
  (via the `uuid` package) before inserting, then a follow-up
  `SELECT * WHERE id = ?` — MySQL has no `RETURNING` clause. `ILIKE` → `LIKE`
  (MySQL's default collation is already case-insensitive). Postgres's
  `ON CONFLICT ... DO UPDATE` → MySQL's `ON DUPLICATE KEY UPDATE`. Postgres's
  unique-violation code `'23505'` → MySQL's `'ER_DUP_ENTRY'`.
- **Transactions** (inventory-service's dispense/restock): `pool.connect()` +
  `BEGIN`/`COMMIT`/`ROLLBACK` text queries → `pool.getConnection()` +
  `conn.beginTransaction()`/`conn.commit()`/`conn.rollback()`. The row-locking
  `SELECT ... FOR UPDATE` carries over unchanged — InnoDB supports it the same way.
- This has been tested against a live MySQL-compatible server: schema load,
  UUID default generation, foreign keys, `CHECK` constraint enforcement,
  register/login/duplicate-username handling, the dispense/restock transaction
  (including the insufficient-stock rollback path), and the monthly-report
  upsert were all exercised end-to-end during the rewrite.
- **Event bus (RabbitMQ/Redis Streams)** — right now, reporting-service calls other
  services directly over HTTP to build reports. That's fine at low traffic. If you
  outgrow it, replace those HTTP calls with published events per the earlier
  architecture doc.
- **Refresh tokens / token revocation** — auth-service issues plain JWTs with a
  fixed expiry; add a refresh-token table when you need logout-everywhere support.
- **Rate limiting / HTTPS** — add `express-rate-limit` and terminate TLS at the
  gateway (NGINX + Let's Encrypt) before this goes anywhere public-facing.
