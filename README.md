# NextStep Tokyo Application

A minimal information and team registration website for NextStep Tokyo.

The page includes an animated welcome, three sections, a rotating navigation ring, and scroll progress indicators. Section 2 describes the organizational leader, Marketing team, and Event team. Section 3 contains a three-step membership application backed by a Supabase Edge Function and private Postgres table.

## Run locally

From the project directory, run:

```sh
python -m http.server 3000 --bind 127.0.0.1 --directory dist
```

Open http://localhost:3000.

The website uses plain HTML, CSS, and JavaScript. No dependency installation or build step is required. The website source is in `dist/index.html`.

## Deploy to Vercel

Import the GitHub repository and use the repository root as the Root Directory. The included `vercel.json` selects the Other framework preset, skips installation and building, and serves `dist`.

If configuring the project manually, choose **Other** for Framework Preset, set Output Directory to **dist**, and leave Build Command and Install Command empty. Then redeploy.

## Application behavior

Applicants complete About you, Team interest, and Your motivation, review their details, and consent to recruitment use. They do not need an account. Answers survive section navigation in memory, but not a refresh. A successful submission displays a UUID reference. A request UUID prevents duplicate rows when a failed connection is retried without changing answers. Emails are normalized; repeated applications with the same email are allowed.

No applicant data is stored in browser storage or logged by the function. There are no email notifications, uploads, applicant tracking, or custom admin pages. Until the public configuration is supplied, the form is available to explore and submission is explicitly unavailable.

## Connect Supabase and Turnstile

1. Create or select a Supabase project. Install the Supabase CLI and authenticate using `supabase login`. From this repository run `supabase link --project-ref YOUR_PROJECT_REF`, then `supabase db push`. This applies the migration in `supabase/migrations`.
2. Create a Cloudflare Turnstile widget and allow your production hostname and any specific preview/local hostnames you will test. Do not use production secrets with Cloudflare test site keys.
3. Set function secrets through the Supabase dashboard or CLI: `TURNSTILE_SECRET_KEY` and `ALLOWED_ORIGINS`. The latter is a comma-separated list of exact origins without trailing slashes, for example `https://your-site.vercel.app,http://localhost:3000`. Add each preview origin explicitly; wildcards are not supported. The function also checks that Turnstile's verified hostname matches the request origin and its action is `application`.
4. Deploy with `supabase functions deploy submit-application`. `supabase/config.toml` disables JWT verification for this public endpoint; validation and Turnstile are enforced inside the handler. Supabase supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to the hosted function. Never copy the service role key into the website.
5. In `dist/application-config.js`, set `endpoint` to `https://YOUR_PROJECT_REF.supabase.co/functions/v1/submit-application` and `turnstileSiteKey` to the widget's public site key. These are public values, not secrets. Deploy/redeploy the static site to Vercel.
6. Submit a test application from the deployed origin. Confirm exactly one row appears, repeat a request with the same request UUID, and confirm the same reference is returned. Check an invalid/expired verification produces no row. Remove test records before opening recruitment.

The server checks field types, lengths, role values, consent version, request UUID, origin, JSON content type, and a 32 KiB body limit. Database constraints provide a second validation layer. Client-supplied review status, timestamps, and notes are ignored. CORS is a browser restriction; Turnstile supplies the submission verification. Secrets and applicant payloads should never be committed or pasted into logs.

## Review applications

Give only authorized organizers project access. In Supabase Table Editor, open `public.applications`, sort by `created_at`, filter by `status`, and update `status` (`new`, `reviewing`, `accepted`, `rejected`) and `internal_notes`. Use the dashboard's export controls when needed and handle exported applicant data privately. Public and ordinary authenticated API roles have no table privileges or RLS policies. The endpoint returns only the application reference.

The recruitment notice is versioned as `recruitment-v1`; update both code and database constraints if its meaning changes. The organization should set its own retention/deletion practice before collecting real applications.

## Verification

With Node.js 22+:

```sh
node --test tests/application-backend.test.mjs
node tests/application-browser.cjs
```

The browser check uses installed Microsoft Edge on Windows, with no npm dependencies. Set `BROWSER_PATH` to a Chromium browser executable on other systems. It checks four viewport sizes, validation, keyboard behavior, navigation state, verification configuration, failed-request recovery, retry IDs, and confirmation using mocked services. Screenshots are saved in the system temporary directory. It does not prove live Turnstile, Supabase, or Vercel integration.

With a migrated local or staging database, run `supabase/tests/applications.sql` through `psql` as postgres. It checks RLS, anonymous/authenticated table privileges, and duplicate request rejection in a rolled-back transaction. Live launch requires this database check and the real-service smoke test described above.
