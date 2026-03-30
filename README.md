# Enterprise Psychometric System

Brand baseline: Century Schoolbook typography with `#000000`, `#FFFFFF`, `#ed3338`, and `#f0eeee`.

## Scope

This repository now implements **Steps 1 through 6** of the phased Enterprise Psychometric System build:

- Complete Prisma data model for the Step 1 and Step 2 specification
- JWT login/logout/refresh with rotating refresh tokens
- RBAC for `SUPER_ADMIN`, `HR_ADMIN`, `MANAGER`, `ASSESSOR`, `CANDIDATE`, and `RATER`
- Admin shell with all required navigation targets
- Fully working User Management with CRUD, deactivation, and CSV bulk import
- Question Bank Manager with filtering, import/export, bulk review actions, and version history
- Assessment Configuration workspace with draft/publish/archive controls and role-family overrides
- Campaign workspace with campaign creation, invite orchestration, reminder tracking, and progress monitoring
- Candidate assessment runtime covering all 6 layers with autosave, resume, quality flags, and invite-based launch
- Deterministic Step 3 scoring pipeline with classical and hybrid IRT/Thurstonian engines
- Scoring admin workspace for model versioning, thresholds, CAT configuration, norm groups, and reliability snapshots
- Automatic scoring on assessment completion with persisted scored responses, construct scores, layer scores, role-fit results, and development plans
- Permissible-use enforcement for personality, motivators, and leadership layers in hiring outputs
- Norm-group membership and recomputation workflows for z-score and percentile updates
- Step 4 reporting workspace with live previews, downloadable individual and candidate PDFs, and manager-safe team heatmap Excel exports
- Candidate feedback simplification, behaviour mapping, blind-spot reporting, and editable report template branding/distribution rules
- Step 5 validity dashboard with criterion, reliability, construct, test-retest, adverse-impact, and incremental-validity evidence recomputation
- Step 5 360 configuration with calibration tracking, rater workspace, ICC monitoring, and blind-spot summary support
- Step 5 compliance tooling for DPDP consent visibility, governance requests, audit review, and self-service access/challenge/delete flows
- Step 5 system health monitors covering personality over-weighting, validation-loop gaps, 360 calibration, adverse impact, and outcome linkage
- Step 6 KPI definition and observation management with linked outcome records, role-family correlations, and EBITDA sensitivity summaries
- Unit-tested scoring helpers for quality gates, classical scoring, IRT transforms, aggregation, and fit logic
- Seed data for organisation, users, layers, sub-dimensions, role families, question bank items, assessment versions, campaigns, invites, governance requests, 360 cycles, KPI observations, and outcome records
- Audit logging for login and admin operations
- Docker Compose for PostgreSQL and Redis

## Tech Stack

- Next.js App Router
- TypeScript
- Prisma + PostgreSQL 15
- Custom JWT auth with refresh-token rotation
- Tailwind CSS 4
- `pdf-lib` + `xlsx` export generation
- Vitest

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Start local services if you are using Docker:

```bash
docker compose up -d
```

3. Copy environment variables if needed:

```bash
cp .env.example .env
```

4. Create and apply the database schema:

```bash
npm run db:deploy
```

5. Seed the database:

```bash
npm run db:seed
```

6. Start the app:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Seeded Login

- Email: `superadmin@secheron.example.com`
- Password: `Password@123`

Other seeded users follow the same password.

## One-Click Launch

- Double-click [Launch Enterprise Psychometric System.command](/Users/arnavmaheshwari/Library/CloudStorage/OneDrive-Personal/Desktop/Files/Work/D%26H%20Secheron/GPT/Codex/Launch%20Enterprise%20Psychometric%20System.command)
- The launcher installs missing packages, tries your current `DATABASE_URL`, falls back to Docker Postgres/Redis when needed, applies migrations, seeds only if the app is empty, and opens the browser automatically

## Environment Variables

- `DATABASE_URL`: PostgreSQL connection string
- `AUTH_SECRET`: secret used to sign JWTs; use 32+ characters
- `APP_URL`: application base URL
- `ACCESS_TOKEN_TTL_MINUTES`: short-lived access token duration
- `REFRESH_TOKEN_TTL_DAYS`: rotating refresh token lifetime

## Render Deployment

- The repo includes [render.yaml](/Users/arnavmaheshwari/Library/CloudStorage/OneDrive-Personal/Desktop/Files/Work/D%26H%20Secheron/GPT/Codex/enterprise-psychometric-system/render.yaml) for a one-service Render deployment with health checks and pre-deploy Prisma migrations
- Render should be given a real public `APP_URL` after the service URL is known
- If you reuse an existing Render Postgres instance, point `DATABASE_URL` at a dedicated PostgreSQL schema such as `?schema=sechtest_psychometric_system` so this app stays isolated from other apps in the same database
- Example pattern: `postgresql://USER:PASSWORD@HOST/DATABASE?schema=sechtest_psychometric_system`

## Common Commands

```bash
npm run dev
npm run build
npm run lint
npm run typecheck
npm run test
npm run db:generate
npm run db:deploy
npm run db:seed
```

## Steps 3-6 Definition-of-Done Mapping

- Schema, enums, relations, soft delete fields, and required indexes are defined in `prisma/schema.prisma`
- Step 2 database delta is tracked in `prisma/migrations/20260330_step2_candidate_runtime_and_campaigns/migration.sql`
- Step 3 scoring engine delta is tracked in `prisma/migrations/20260330051803_step3_scoring_engine/migration.sql`
- Steps 4-6 database delta is tracked in `prisma/migrations/20260330082046_step4_step6_reporting_validity_governance/migration.sql`
- Question bank seeding and runtime version seeding are handled by `prisma/seed.ts` plus `src/lib/seed/question-bank.ts`
- Question Bank Manager is implemented at `src/app/(platform)/admin/question-bank/page.tsx`
- Assessment Configuration is implemented at `src/app/(platform)/admin/assessment-configuration/page.tsx`
- Campaign orchestration is implemented at `src/app/(platform)/admin/campaigns/page.tsx`
- Scoring model management is implemented at `src/app/(platform)/admin/scoring/page.tsx`
- Step 3 scoring logic lives in `src/lib/scoring/*`, `src/lib/scoring-pipeline.ts`, and `src/lib/scoring-service.ts`
- Step 4 reporting services live in `src/lib/reporting-service.ts` and `src/components/reports-manager.tsx`
- Step 5 validity, 360, compliance, and health services live in `src/lib/validity-service.ts`, `src/lib/multi-rater-service.ts`, `src/lib/compliance-service.ts`, and `src/lib/system-health-service.ts`
- Step 6 KPI and outcome-linkage services live in `src/lib/kpi-service.ts`
- Scoring APIs live under `src/app/api/admin/scoring`
- Reporting, validity, multi-rater, compliance, KPI, development, self-service, and export APIs live under `src/app/api/admin`, `src/app/api/reports`, `src/app/api/rater`, and `src/app/api/self`
- Candidate runtime routes live under `src/app/api/assessment/[token]`
- Automatic scoring after completion is triggered in `src/app/api/assessment/[token]/complete/route.ts`
- Candidate invite experience is implemented at `src/app/assessment/[token]/page.tsx`
- Admin workspaces for reports, validity, multi-rater, compliance, development, KPI management, and system health live under `src/app/(platform)/admin`
- Candidate, rater, and manager workspaces live at `src/app/(platform)/candidate`, `src/app/(platform)/rater`, and `src/app/(platform)/team`
- Scoring calculation tests are implemented in `src/tests/unit/scoring-core.test.ts`
- Audit log viewing remains available at `/audit`

## Notes

- `responses` table partitioning is not forced in the current build because the platform is still pre-volume; it can be introduced once production usage approaches the stated threshold.
- The seeded role-family weights are illustrative defaults and must be replaced with job-analysis-derived weights before any hiring decision.
