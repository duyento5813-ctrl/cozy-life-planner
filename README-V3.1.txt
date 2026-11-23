COZY LIFE PLANNER V3.1 — INSTALLATION

1. In supabase-config.js replace PASTE_YOUR_sb_publishable_KEY_HERE with the full sb_publishable_... key from Supabase > Project Settings > API Keys. NEVER use a secret/service_role key.
2. Supabase URL in config is based on the project ID visible in screenshots; verify it in Supabase > Connect > Project URL.
3. SQL schema expected for each of the four existing tables: one row per user, user_id UUID UNIQUE or PRIMARY KEY, data JSONB, updated_at timestamptz auto-updated by trigger. Existing RLS must remain enabled and allow authenticated auth.uid()=user_id. If your columns differ, cloud.js needs adapting.
4. In Supabase Authentication > URL Configuration set Site URL and Redirect URL to https://duyento5813-ctrl.github.io/cozy-life-planner/ ; enable email provider and confirmation email.
5. Upload index.html, app.js, style.css, cloud.js, supabase-config.js to repository root.
6. Before login, download backup using the new settings button. First cloud sync on existing cloud/local mismatch downloads another backup and prompts before replacing local data. Cancel pauses sync.
7. Automatic sync polls every 4 seconds while online and signed in; it uses updated_at compare-and-swap to prevent overwriting changed cloud rows. Conflicts pause sync and export backup.
8. Important: logging out does NOT clear localStorage, so shared computers should not be used for private data. Multi-account switching on the same browser is not supported safely yet; use separate browser profiles.
9. Language preference is stored but full interface translation is not yet implemented. Reminders remain active only while the page is open.
10. This version was syntax-checked, but browser integration with your actual Supabase tables and auth emails has not yet been tested.
