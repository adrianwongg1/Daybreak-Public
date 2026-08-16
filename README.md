# Daybreak (Daily Brief Web)

An AI-powered personal daily-briefing web app — news, markets, and weather summarized every morning, plus typed natural-language commands for quick actions. This is a public fork with no Google integration: accounts are created and signed in via Supabase Auth (email/password, with email confirmation on sign-up) rather than Auth.js/Google OAuth, and there's no Calendar section. See `DECISIONS.md` for the up-to-date running log of what's actually been built.

## Tech stack

Next.js (App Router) · Supabase (Auth + Postgres) · Netlify · GitHub Actions (scheduled cron) · Google Gemini (news + command parsing) · Open-Meteo, Finnhub/CoinGecko, Guardian/NYT/Google News RSS

## Getting started

1. `npm install`
2. Copy `.env.local.example` to `.env.local` and fill in real values — see the comments in that file for which dashboard each one comes from (Supabase, Google AI Studio, Finnhub, Guardian, NYT).
3. Run `supabase/migrations/0001_init.sql` and `0002_restrict_job_queue_functions_to_service_role.sql` against the Supabase project (Dashboard → SQL Editor), in order.
4. `npm run dev` and open [http://localhost:3000](http://localhost:3000).

## Deployment

Deployed on Netlify via `netlify.toml` (`@netlify/plugin-nextjs`). Environment variables are set in the Netlify dashboard (Site settings → Environment variables), mirroring `.env.local`.
