# Evergreen — Routine Tracker

A simple habit/routine grid tracker built with React + Vite, with accounts via Supabase so your data follows you across browsers and devices. It's also an installable PWA — people can add it to their phone's home screen like a real app, no app store needed.

## Installing it like an app (free, no Play Store)

Once deployed, anyone visiting the site can:
- **Android (Chrome):** tap the **⋮** menu → **"Add to Home Screen"** / **"Install app"**
- **iPhone (Safari):** tap the **Share** icon → **"Add to Home Screen"**

It'll show up with the Evergreen icon and open full-screen like a native app.

## One-time setup: Supabase

1. Create a free project at https://supabase.com.
2. In the SQL Editor, run the contents of `supabase-setup.sql` (included in this folder) — this creates the table that stores each user's routines.
3. In your Supabase project, go to **Settings → API**. Copy the **Project URL** and the **anon public** key.
4. You'll paste these into Vercel as environment variables (see below) — no need to put them in a file for deployment.

## Deploy for free (no coding experience needed)

**Step 1 — Put this folder on GitHub**
1. Create a free account at https://github.com if you don't have one.
2. Click the "+" in the top right → "New repository". Name it `evergreen-tracker` and click "Create repository".
3. On the new repo page, click "uploading an existing file" and drag in all the files from this folder (keep the folder structure — `src/` should stay a folder).
4. Click "Commit changes".

**Step 2 — Deploy on Vercel**
1. Go to https://vercel.com and sign up using your GitHub account (free).
2. Click "Add New" → "Project".
3. Select your `evergreen-tracker` repo and click "Import".
4. Before deploying, expand **"Environment Variables"** and add:
   - `VITE_SUPABASE_URL` → your Supabase Project URL
   - `VITE_SUPABASE_ANON_KEY` → your Supabase anon public key
5. Click "Deploy" and wait about a minute.
6. You'll get a free link like `evergreen-tracker.vercel.app`. Anyone who visits can sign up for their own account and see only their own routines.

Any time you upload changed files to GitHub, Vercel automatically redeploys the site — no extra steps.

## Running it on your own computer (optional)

If you want to preview it locally, you'll need [Node.js](https://nodejs.org) installed. Copy `.env.example` to `.env` and fill in your real Supabase values, then:

```
npm install
npm run dev
```

This opens the app at `http://localhost:5173`.

## Setting up personalized reminders (optional)

Each user picks their own reminder time(s) and timezone — up to twice a day.

1. Run `supabase-push-setup.sql`, then `supabase-personalized-reminders.sql`, in Supabase's SQL Editor, in that order.
2. Get your Supabase **service_role key**: Supabase → Settings → API → "service_role" (different from the anon key — keep it secret, never put it in client code).
3. In Vercel → Settings → Environment Variables, add:
   - `VAPID_PUBLIC_KEY` → `BNiMwkTUOnc7cS92AAB71NU-p4K35dqE_RYW9GFlfiZuEXnQkhdILYXF7ckulCVWI69cekeSdiuWA_Br9M14_iY`
   - `VAPID_PRIVATE_KEY` → `_3mknvS2VF3wj9NIEIzyn2aB2rhEIceYC9S6eRp43gQ` (keep secret)
   - `SUPABASE_URL` → same value as `VITE_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY` → the service_role key from step 2
   - `CRON_SECRET` → any random string of 16+ characters, e.g. `ev3rgr33n-9x7Lp2qR4kT8mNw1`
4. Redeploy, then copy your deployed function's full URL, e.g. `https://your-app.vercel.app/api/send-reminders`.
5. On GitHub, go to your repo → **Settings → Secrets and variables → Actions → New repository secret**, and add:
   - `REMINDER_URL` → the URL from step 4
   - `CRON_SECRET` → same value you used in Vercel
6. Commit the new `.github/workflows/send-reminders.yml` file (included here) — GitHub will now ping your function every 15 minutes for free, and it only actually sends a notification to a user when their local time matches what they picked.
7. In the app, tap **"Turn on daily reminders"**, pick a timezone, one or two times, and save.

Why GitHub Actions instead of Vercel's own cron: Vercel's free plan only allows a cron to run once a day, which can't support "everyone's own local time." GitHub Actions' free scheduled workflows can run every 15 minutes, which is what makes personalized timing possible without paying for anything.

Note: GitHub's scheduler isn't perfectly precise under load and can drift by a few minutes — reminders may land a little after the exact minute chosen, not before.
