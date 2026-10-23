# NextStep Tokyo Application

A minimal information and team registration website for NextStep Tokyo.

The page includes an animated welcome, three sections, a rotating navigation ring, and scroll progress indicators. Section 2 describes the organizational leader, Marketing team, and Event team. Section 3 has an Apply button linking to a dedicated full-page, four-step application at `apply.html`, backed by a Supabase Edge Function and private Postgres table.

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

Applicants complete About you, Team interest, and Your motivation, then preview all their answers on a separate Review your answers step and consent to recruitment use. They do not need an account. Answers survive form step navigation in memory, but not a refresh or leaving the application page. A Back to NextStep Tokyo link returns directly to the Join section without replaying the welcome. A successful submission displays a UUID reference. A request UUID prevents duplicate rows when a failed connection is retried without changing answers. Emails are normalized; repeated applications with the same email are allowed.

No applicant data is stored in browser storage or logged by the function. There are no email notifications, applicant tracking, or custom admin pages. Graphics and Video/Photography applicants can optionally add a past-work description, portfolio/video link, and up to three JPG, PNG, WebP or PDF attachments (10 MiB each). Files stay in memory until submission; other roles exclude past work from submission. Until the public configuration is supplied, the form is available to explore and submission is explicitly unavailable.

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

## Past-work deployment

Apply both database migrations with `supabase db push`, then redeploy `submit-application`. The migration creates a private `application-work` Storage bucket. No browser Storage credentials or public read policies are required. JSON submissions without attachments remain supported; attachments use a bounded multipart request. The function validates file signatures, extensions, declared types, sizes, and counts before uploading. It does not scan files for malware.

Files are uploaded only after successful validation, consent, and Turnstile verification. The UI shows an uploading status, retains selected files on failure, and reuses a request UUID for unchanged retries. Files use deterministic SHA-256 paths; duplicate retries return the original application reference. The server verifies existing answers and attachment metadata before accepting a retry.

Deploy `cleanup-application-work`, set a strong random `CLEANUP_SECRET` in Supabase function secrets, and configure an hourly scheduler to POST to that function with `Authorization: Bearer YOUR_CLEANUP_SECRET`. Keep this secret only in the scheduler and server. Each call removes at most 100 unreferenced files older than 24 hours; schedule more frequently if needed. This handles interrupted uploads and failed database writes. Do not enable recruitment until the cleanup schedule is configured and tested.

Organizers review `work_description`, `portfolio_url`, and `work_files` in the private applications table. Attachment metadata contains the original filename and private Storage path; open/download that object through the authorized Supabase Storage dashboard. Deleting an application makes its files eligible for cleanup after the 24-hour grace period. A changed recruitment notice or retention policy should be reviewed before launch.

Before production, test real multipart uploads through the deployed function, private file access, unchanged retries, and cleanup. Local mocked tests do not verify hosted request limits or Storage permissions.
