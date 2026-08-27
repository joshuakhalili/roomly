# Setting up Roomly

Follow these in order. Everything here is free — no card required at any step.

You'll do this once. It takes about 15 minutes.

---

## What you need first

- A **GitHub account** (the code lives here)
- An **email address** for the Supabase and Vercel accounts

---

## Step 1 — Create the database (Supabase)

Supabase gives you the database, the file storage, and the login system in one place.

1. Go to **[supabase.com](https://supabase.com)** → **Start your project** → sign up.
2. Click **New project**.
3. Fill in:
   - **Name**: `roomly`
   - **Database Password**: click *Generate a password* and **save it somewhere safe**
     (a password manager, not a text file on your desktop). You won't need it often,
     but you cannot recover it later.
   - **Region**: choose **London (eu-west-2)**.
     This matters — it keeps tenant data physically in the UK, which is the
     straightforward position under UK GDPR.
4. Click **Create new project** and wait ~2 minutes while it sets up.

### Get your three keys

Once the project is ready, go to **Project Settings** (gear icon) → **API keys**.

You need three values:

| What it's called there | What it looks like | Secret? |
|---|---|---|
| **Project URL** | `https://abcdefgh.supabase.co` | No |
| **anon** / **public** key | long string starting `eyJ...` | No |
| **service_role** key | long string starting `eyJ...` | **YES — see below** |

> ### ⚠️ About the `service_role` key
>
> This key **bypasses every security rule in the database**. Anyone who has it can
> read and delete all tenant data.
>
> - It goes **only** into environment variables (Steps 2 and 3 below).
> - Never paste it into a chat, a screenshot, a support ticket, or the code itself.
> - Never commit it to GitHub.
>
> If it ever leaks, go to the same page and click **Reset** on that key immediately.

### Create the database tables

1. In Supabase, open **SQL Editor** in the left sidebar.
2. Click **New query**.
3. Open `supabase/migrations/0001_init.sql` from this repo, copy **all** of it,
   paste it in, and click **Run**. You should see "Success".
4. Repeat with `supabase/migrations/0002_seed_templates.sql`.
   This one fills in the inventory checklist templates (Kitchen, Bedroom, Bathroom,
   and so on) and the tenant message templates in English and Chinese.

### Create your first admin login

1. Go to **Authentication** → **Users** → **Add user** → **Create new user**.
2. Enter your email and a password. Tick **Auto Confirm User**.
3. Click **Create user**.

That's your login. Once you're in the app, you can add other admins from the
**Admins** screen — you won't need to come back here for that.

---

## Step 2 — Run it on your own computer

1. Open Terminal and go to the project folder:
   ```
   cd ~/Desktop/Github\ Repos/roomly
   ```
2. Install the dependencies (one time only):
   ```
   npm install
   ```
3. Make your local settings file by copying the template:
   ```
   cp .env.example .env.local
   ```
4. Open `.env.local` and paste in your three Supabase values from Step 1.
   For `CRON_SECRET`, generate a random string by running:
   ```
   openssl rand -base64 32
   ```
   `.env.local` is git-ignored, so it never leaves your machine.
5. Start it:
   ```
   npm run dev
   ```
6. Open **http://localhost:3000** and sign in with the account you made.

---

## Step 3 — Put it online (Vercel)

1. Go to **[vercel.com](https://vercel.com)** → **Sign up** → **Continue with GitHub**.
2. Click **Add New… → Project**, find the `roomly` repository, click **Import**.
3. Before clicking Deploy, expand **Environment Variables** and add the same values
   from your `.env.local`:

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | your Project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | your anon key |
   | `SUPABASE_SERVICE_ROLE_KEY` | your service_role key |
   | `CRON_SECRET` | the random string you generated |
   | `NEXT_PUBLIC_APP_URL` | leave blank for now — see step 5 |

4. Click **Deploy** and wait a couple of minutes.
5. Copy the URL it gives you (something like `https://roomly-xyz.vercel.app`), then go
   to **Settings → Environment Variables**, set `NEXT_PUBLIC_APP_URL` to that URL, and
   redeploy. (This is used to build the calendar subscription links.)

From now on, every time the code is pushed to GitHub's `main` branch, Vercel
redeploys automatically. There's nothing to run by hand.

---

## Step 4 — Add it to your iPhone

1. Open the Vercel URL in **Safari** on your iPhone (it must be Safari — Chrome on
   iOS can't install web apps).
2. Tap the **Share** button (the square with the arrow).
3. Scroll down and tap **Add to Home Screen**.

You'll get a Roomly icon on your home screen that opens without browser bars, like a
normal app. The app shows a one-time reminder about this, because iOS gives no
automatic install prompt.

---

## Optional — daily email summary

Only needed if you want a daily email listing that day's reminders. The in-app alerts
and the calendar reminders work without it.

1. Sign up at **[resend.com](https://resend.com)** (free tier: 3,000 emails/month).
2. Create an API key.
3. Add `RESEND_API_KEY` and `RESEND_FROM_EMAIL` to Vercel's environment variables.

---

## If something goes wrong

**"Invalid API key" when signing in**
The Supabase keys in `.env.local` (or Vercel) are wrong or have extra spaces. Copy
them again, carefully.

**The site says the project is paused**
Free Supabase projects pause after about a week with no activity. Open your Supabase
dashboard and click **Restore project**. Nothing is lost.

**Changes aren't showing up on the live site**
Check the **Deployments** tab in Vercel — a build may have failed. The log will say why.

**You need to start the database over**
Re-running `0001_init.sql` will fail because the tables already exist. To wipe and
start again, run `drop schema public cascade; create schema public;` in the SQL
Editor first — this **deletes everything**, so only do it while setting up.
