# Lenny Garden - Backend / Deploy

The static site (GitHub Pages) talks to an edge API (Cloudflare Worker) that holds DB credentials as secrets (never in the repo).

Architecture:
GitHub Pages (static) -> VITE_GARDEN_API -> Cloudflare Worker -> (secrets) -> Turso/Supabase

Deploy the Worker (run locally, secrets stay on your machine):
1. npm i -g wrangler
2. wrangler secret put TURSO_URL
3. wrangler secret put TURSO_TOKEN
4. wrangler deploy
Then set VITE_GARDEN_API to the worker URL and redeploy the site.

Schema: apply db/schema.sql to your Turso/Supabase database.

Safety:
- DB credentials are Worker secrets only.
- The client only knows the public API base.
- Offline: CloudProgressStore falls back to localStorage.
