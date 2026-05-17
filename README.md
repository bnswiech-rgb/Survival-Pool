# SurvivorPicks

A peer-to-peer sports survival picking contest platform. Submit your pick, survive the round, win the prize pool.

## Overview

SurvivorPicks lets users create and join peer-to-peer sports survival contests. Each round, participants submit one eligible pick. Win and advance. Lose and you're eliminated (depending on format). Last survivor wins the net prize pool.

**This is NOT a sportsbook.** No wagering occurs on the platform. All contests are peer-to-peer picking contests.

## Tech Stack

- **Framework**: Next.js 16 (App Router, TypeScript)
- **Database & Auth**: Supabase (PostgreSQL + Row Level Security + Realtime)
- **Styling**: Tailwind CSS v4
- **State**: React hooks + Supabase Realtime subscriptions
- **Payments**: Mock payment flow (Stripe-ready)
- **Testing**: Jest + ts-jest (68 tests)

## Local Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Set up Supabase

1. Create a project at https://supabase.com
2. Run the SQL schema in your Supabase SQL editor: supabase/schema.sql
3. Enable Realtime for tables listed at the bottom of schema.sql

### 3. Configure environment variables

```bash
cp .env.example .env.local
# Then fill in your Supabase credentials
```

| Variable | Description |
|----------|-------------|
| NEXT_PUBLIC_SUPABASE_URL | Your Supabase project URL |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Your Supabase anon/public key |
| SUPABASE_SERVICE_ROLE_KEY | Your Supabase service role key |
| NEXT_PUBLIC_APP_URL | App URL (http://localhost:3000 for dev) |
| STRIPE_SECRET_KEY | Stripe secret key (for real payments) |
| NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY | Stripe publishable key |
| STRIPE_WEBHOOK_SECRET | Stripe webhook secret |

### 4. Start the dev server

```bash
npm run dev
```

Open http://localhost:3000

### 5. Set yourself as admin

After signing up, run in your Supabase SQL editor:

```sql
UPDATE profiles SET role = 'admin' WHERE username = 'yourusername';
```

## Running Tests

```bash
npm test
```

68 tests covering eligibility rules, all 6 contest format engines, and utility functions.

## Contest Formats

| Format | Win Condition |
|--------|--------------|
| Classic Survival | Last survivor (1 life) |
| Lives Mode | Last to run out of lives |
| First To X Wins | First to reach target wins |
| Best Record | Best W-L after N rounds |
| Streak Race | First to reach consecutive win target |
| Team Battle | Last team standing |

## Pick Eligibility Rules

- Spread/Total: Odds must be -115 to -105 (standard juice only)
- Moneyline: Must be -150 or better; positive odds always allowed; -151 or worse blocked

## Compliance

SurvivorPicks is a peer-to-peer sports picking contest platform. No sportsbook wagering occurs. Must be 18+. Not available where prohibited. Please play responsibly.
