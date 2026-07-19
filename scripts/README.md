# FixTray — Utility Scripts

Utility / one-off scripts for managing the FixTray platform.
Run any script with `node scripts/<script>.js` from the project root.

## 🎯 Phase 5 Consolidation (Latest)

The following scripts have been consolidated to eliminate duplication:

| Consolidated | Canonical | Purpose |
|--------------|-----------|---------|
| `generate-checklist.js` + `v2` | `generate-checklist-v3.js` | Generate QA checklist with role grouping and better HTML escaping |
| `generate-fixtray-info-pdf.js` | `generate-fixtray-info-pdf-v2.js` | Convert checklist to PDF |
| `audit-role-syntax.js` + `cleanup-role-checks.js` + `fix-paren-syntax.js` | `audit-codebase.js` | Unified audit utility (syntax & quality checking) |

**Usage:**
```bash
node scripts/generate-checklist-v3.js > fixtray-qa-checklist.html
node scripts/audit-codebase.js syntax    # Check for syntax errors
node scripts/audit-codebase.js quality   # Score UI quality
node scripts/audit-codebase.js all       # Run all audits
```

## Categories

| Folder | Purpose |
|--------|---------|
| `build/` | Build & deployment helpers (prisma generate, secret scanning, encoding) |
| `admin/` | Create, seed, reset, and inspect admin accounts |
| `db/` | Database inspection, querying, backup, import, and credential rotation |
| `debug/` | One-off debugging: inspect hashes, dump users, show columns/tokens |
| `auth/` | Auth flow testing, password rehashing, login verification |
| `test/` | E2E test helpers, Prisma connection checks, test data creation |
| `stripe/` | Stripe product/price setup |

## Quick Reference

### Build (`scripts/build/`)
| Script | Purpose |
|--------|---------|
| `build-with-dotenv.js` | Load .env then run next build |
| `check-database.js` | Verify DB connection + run migrations |
| `fix-encoding.js` | Fix file encoding issues |
| `prevent-commit-secrets.js` | Pre-commit hook to block secrets |
| `prisma-safe-generate.js` | Safe Prisma client generation |
| `secret-scan-detailed.js` | Detailed secret scanning |

### Admin (`scripts/admin/`)
| Script | Purpose |
|--------|---------|
| `check-admin.js` | Inspect admin account details |
| `create-super-admin.js` | Create a new super-admin |
| `reset-admin-pass.js` | Reset an admin password |
| `seed-admin.js` | Seed initial admin account |

### Database (`scripts/db/`)
| Script | Purpose |
|--------|---------|
| `backup-user.js` | Back up a user record to JSON |
| `check_testshop_services.js` | Verify test shop service catalog |
| `db-info.js` | Print database connection info |
| `find-by-email.js` | Find user/shop by email |
| `find-record.js` | Generic record finder |
| `find_user.js` | Find user by various fields |
| `get-workorder.js` | Fetch a work order by ID |
| `import_defaults_testshop.js` | Import default services for test shop |
| `list-accounts.js` | List all accounts |
| `list-recent-entities.js` | List recently created entities |
| `list-techs.js` | List all technicians |
| `rotate-db-password.js` | Rotate the database password |

### Debug (`scripts/debug/`)
| Script | Purpose |
|--------|---------|
| `check-admin-pw.js` | Compare an admin password hash |
| `check-login-readiness.js` | Verify login flow readiness |
| `check_tokens.js` | Inspect JWT tokens |
| `debug-admin-login-flow.js` | Step-by-step admin login debug |
| `dump-users.js` | Dump all user records |
| `inspect-admin-hash.js` | Inspect admin bcrypt hash |
| `inspect-admin.js` | Print admin record details |
| `inspect-passwords.js` | Inspect stored password hashes |
| `show-activity-logs.js` | Print activity log entries |
| `show-admin-columns.js` | Show admin table columns |
| `show-refresh-metadata.js` | Show refresh token metadata |

### Auth (`scripts/auth/`)
| Script | Purpose |
|--------|---------|
| `hash-user-if-plain.js` | Hash a user's password if stored as plain text |
| `rehash-plaintext-passwords.js` | Bulk rehash all plain-text passwords |
| `rehash-single.js` | Rehash a single user's password |
| `reset-password.js` | Reset any user's password |
| `test-auth.js` | Test auth endpoints (JS) |
| `test-auth.ps1` | Test auth endpoints (PowerShell) |
| `test-decode-token.js` | Decode and inspect a JWT |
| `test-refresh-create.js` | Test refresh token creation |
| `verify-customer.js` | Verify a customer account |
| `verify-login-cli.js` | CLI login verification tool |

### Test (`scripts/test/`)
| Script | Purpose |
|--------|---------|
| `create_test_customer.js` | Create a test customer account |
| `quick-e2e.js` | Quick end-to-end smoke test |
| `test-prisma-connect.js` | Test Prisma database connection |

### Stripe (`scripts/stripe/`)
| Script | Purpose |
|--------|---------|
| `setup-stripe.js` | Set up Stripe products and prices |
