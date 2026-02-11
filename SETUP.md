# Setup Guide

This guide walks you through getting ThisThenThat running locally. You'll need accounts on Supabase and Anthropic, plus Node.js 18+ installed.

---

## 1. Clone and Install

```bash
git clone https://github.com/your-username/thisthenthat.git
cd thisthenthat
npm install
```

---

## 2. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in (or create a free account).
2. Click **New Project**.
3. Pick an organization, give your project a name (e.g. `thisthenthat`), set a database password, and choose a region close to you.
4. Click **Create new project** and wait for it to finish provisioning (usually under a minute).

### Run the Database Migration

Once your project is ready:

1. In the Supabase dashboard, go to **SQL Editor** in the left sidebar.
2. Click **New query**.
3. Open the file `supabase/migrations/001_initial_schema.sql` from this repo, copy its entire contents, and paste it into the SQL editor.
4. Click **Run** (or press Cmd/Ctrl + Enter).

This creates the `assignments` and `checklist_steps` tables, adds indexes, enables Row Level Security, and sets up all the necessary RLS policies so users can only access their own data.

### Grab Your API Keys

1. In the Supabase dashboard, go to **Settings** > **API** (or **Project Settings** > **API**).
2. You need two values:
   - **Project URL** — looks like `https://abcdefghijkl.supabase.co`
   - **anon / public key** — a long `eyJ...` string under "Project API keys"

Keep these handy for the next step.

### Configure Authentication

The app uses email/password auth, which is enabled by default in Supabase. Optionally, you can customize:

1. Go to **Authentication** > **Providers** in the Supabase dashboard.
2. Under **Email**, you can toggle off "Confirm email" if you want users to sign in immediately without email verification (useful during development).

---

## 3. Get an Anthropic API Key

1. Go to [console.anthropic.com](https://console.anthropic.com) and sign in (or create an account).
2. Navigate to **API Keys** in the sidebar.
3. Click **Create Key**, give it a name, and copy the key.

The app uses Claude (claude-sonnet-4-20250514) for both checklist generation and step chat. You'll be charged per usage on Anthropic's pay-as-you-go pricing.

---

## 4. Set Up Environment Variables

Copy the example env file:

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in your values:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...your-anon-key
ANTHROPIC_API_KEY=sk-ant-...your-anthropic-key
```

> **Important:** Never commit `.env.local` to git. It's already in `.gitignore`.

---

## 5. Run the Dev Server

```bash
npm run dev
```

The app will be available at [http://localhost:3000](http://localhost:3000). You'll be redirected to the login page where you can create an account and start uploading assignments.

---

## Common Issues

**"Your project's URL and API key are required"**
Your `.env.local` file is missing or has incorrect values. Double-check that both `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set.

**Auth signup not working / no confirmation email**
If you want to skip email confirmation during development, go to Supabase > Authentication > Providers > Email and toggle off "Confirm email".

**PDF upload returns "Could not extract text"**
The PDF might be image-based (scanned). The current setup uses text extraction, which only works on PDFs with selectable text.

**Chat responses not streaming**
Make sure your `ANTHROPIC_API_KEY` is valid and has available credits.
