# Developer Guide — D&H Secheron Psychometric System

## Quick Start

```bash
# 1. Clone
git clone https://github.com/arnavm49-netizen/SechTest.git
cd SechTest

# 2. Install
npm ci --include=dev

# 3. Set up environment
cp .env.example .env
# Edit .env if needed (defaults work for local dev)

# 4. Start Postgres
docker compose up -d

# 5. Run migrations and seed
npm run db:deploy
npm run db:seed

# 6. Start dev server
npm run dev
# Open http://localhost:3000
```

## Login Credentials (local/demo only)

| Role | Email | Password |
|------|-------|----------|
| Super Admin | superadmin@secheron.example.com | Password@123 |
| HR Admin | hradmin1@secheron.example.com | Password@123 |
| Manager | manager1@secheron.example.com | Password@123 |
| Assessor | assessor1@secheron.example.com | Password@123 |
| Candidate | candidate1@secheron.example.com | Password@123 |
| 360 Rater | rater1@secheron.example.com | Password@123 |

## Git Workflow

### Branch naming
```
feature/short-description    — new features
fix/short-description        — bug fixes
chore/short-description      — tooling, deps, config
```

### Process
1. **Never push directly to `main`**
2. Create a feature branch from `main`
3. Make your changes, commit with clear messages
4. Push your branch and open a Pull Request
5. CI runs automatically (type-check → lint → test → build)
6. Get at least 1 review before merging
7. Merge triggers auto-deploy to Render

### Commit messages
Use this format:
```
Short summary of what changed (imperative mood, <70 chars)

Longer explanation if needed. What was the problem?
What does this change? Why this approach?
```

## Architecture Overview

```
src/
├── app/                    # Next.js App Router pages and API routes
│   ├── (auth)/            # Login page (no auth required)
│   ├── (platform)/        # Authenticated pages (dashboard, admin, team, etc.)
│   ├── api/               # API endpoints
│   └── assessment/        # Public assessment-taking flow (token-based)
├── components/            # React components
│   ├── ui/               # Design system primitives (Button, Card, Badge)
│   └── *.tsx             # Feature components
└── lib/                   # Server-side business logic
    ├── auth/             # JWT auth, password hashing, session
    ├── scoring/          # IRT and classical scoring engines
    ├── seed/             # Question bank content (3 files)
    ├── assessment-runtime.ts    # Assessment session lifecycle
    ├── scoring-pipeline.ts      # Full scoring pipeline
    ├── reporting-service.ts     # Report building and PDF generation
    ├── campaigns.ts             # Campaign and invite management
    ├── development-plan-engine.ts  # Auto-generated development plans
    └── rbac.ts                  # Role-based access control
```

## Key Concepts

### Assessment Flow
1. Admin creates a Campaign (links an assessment version + role family)
2. Admin sends invites (generates unique tokens per candidate)
3. Candidate clicks link → consent → questions → completion
4. Scoring runs automatically → role fit result + 9-box placement
5. Reports auto-generated (individual + candidate feedback)

### 6 Assessment Layers
- **Cognitive** — logical, numerical, verbal, abstract reasoning, learning agility
- **Personality** — Big Five + Risk Appetite + Bias for Action
- **Motivators** — financial vs mastery, stability vs growth, etc.
- **Execution** — planning, prioritisation, closure, discipline, detail
- **Leadership** — influence, conflict, delegation, strategic thinking, change leadership
- **SJT** — situational judgment including commercial acumen

### Role-Based Access
| Role | Sees |
|------|------|
| SUPER_ADMIN | Everything |
| HR_ADMIN | Everything except system health |
| MANAGER | Team view (heatmap, 9-box, dev plans) |
| ASSESSOR | Test delivery (generate links, monitor progress) |
| CANDIDATE | Own results and feedback |
| RATER | 360 assignments only |

## Database

### Local development
```bash
docker compose up -d          # Start Postgres + Redis
npm run db:deploy              # Apply migrations
npm run db:seed                # Seed demo data (DESTROYS existing data)
```

### Production (Render)
Migrations run automatically on deploy via `npm run db:bootstrap`.
**NEVER run `db:seed` on production with real data** — it purges everything first.

### Creating migrations
```bash
# After changing prisma/schema.prisma:
npx prisma migrate dev --name descriptive_name
```

## Testing

```bash
npm test                       # Run all tests
npm test -- --watch            # Watch mode
```

Tests live in `src/tests/`. When adding features, add tests for:
- API route input validation
- Scoring logic
- Business rules (RBAC, quality flags, fit calculation)

## Common Tasks

### Add a new question type
1. Add the enum value to `ItemType` in `prisma/schema.prisma`
2. Create migration
3. Add items to `src/lib/seed/question-bank-strategic.ts`
4. Update `choose_seed_response()` in `prisma/seed.ts`
5. Update `ITEM_TYPE_LABELS` in `src/components/question-bank-manager.tsx`
6. Handle the new type in `candidate-assessment-app.tsx`

### Add a new role family
1. Add to `role_family_seed` array in `prisma/seed.ts`
2. Set weight matrix (must sum to 100)
3. Set seniority level
4. Run `db:seed` locally to test

### Add a new sub-dimension
1. Add to `sub_dimension_seed` in `prisma/seed.ts`
2. Create items for it in the question bank files
3. Add development recommendations for all 3 score tiers
4. Add interventions to `src/lib/development-plan-engine.ts`

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| DATABASE_URL | Yes | PostgreSQL connection string |
| AUTH_SECRET | Yes | JWT signing secret (32+ chars) |
| APP_URL | Yes | Public URL of the app |
| ACCESS_TOKEN_TTL_MINUTES | No | Access token lifetime (default: 15) |
| REFRESH_TOKEN_TTL_DAYS | No | Refresh token lifetime (default: 30) |

## Deployment

- **Platform:** Render (web service)
- **Auto-deploy:** On push to `main`
- **Build:** `npm ci --include=dev && npm run build`
- **Start:** `npm run db:bootstrap && npm start`
- **Migrations:** Applied automatically on start via `db:bootstrap`

## Gotchas

1. **`db:seed` destroys all data** — never run on production
2. **Free Render tier sleeps after 15 min** — first request is slow
3. **Assessment sections can have same layer** — e.g., 2 COGNITIVE sections (MCQ + timed). The unique constraint is on `(assessment_id, section_order)`, not `(assessment_id, layer_id)`
4. **Quality flags don't kill tests mid-session** — flags are recorded but assessment continues. Invalidation only at completion, and only for 10+ flags
5. **PDF reports use pdf-lib** — no Puppeteer/Chromium. Charts are drawn as rectangles. If you need richer visuals, you'll need to add a headless browser
6. **Next.js 16** — uses `unstable_retry` in error boundaries, not `reset`. Check `node_modules/next/dist/docs/` for API changes
