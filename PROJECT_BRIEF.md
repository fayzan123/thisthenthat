# AssignMate — AI-Powered Assignment Checklist Builder

## What It Is

AssignMate is a web app that takes a PDF of a school/university assignment and uses AI to generate an easy, step-by-step checklist to complete it. Students upload their assignment, get an actionable breakdown, and can click on any step to open a contextual AI chat where they can ask specific questions about that part of the assignment. Each step has its own conversation thread that persists until the student marks it complete (and they can uncheck/recheck steps freely). A clean dashboard ties it all together with progress tracking across multiple assignments.

---

## Core Features

### 1. PDF Upload & AI Checklist Generation
- User uploads an assignment PDF
- The app extracts the text and sends it to Claude (Anthropic API)
- Claude analyzes the assignment and returns 5–15 ordered, actionable steps
- Each step has a short title and a 1–2 sentence description explaining what to do
- The checklist is saved and displayed immediately

### 2. Interactive Checklist
- Each step has a checkbox that can be toggled (completed/incomplete)
- Steps are ordered logically (research → outline → draft → revise, etc.)
- Progress is tracked as a percentage and shown visually
- State persists across sessions

### 3. Per-Step AI Chat
- Clicking on any step opens a contextual chat panel
- The AI knows the full assignment, the full checklist, and which step the user is asking about
- Users can ask specific questions like "What sources should I look for?" or "How should I structure this section?"
- Conversation history is saved per step so users can pick up where they left off
- Responses are streamed in real-time (no loading spinners)

### 4. Dashboard
- Shows all uploaded assignments as cards in a grid
- Each card displays: assignment title, date uploaded, progress bar (e.g., "7/12 steps complete")
- Upload button to add new assignments
- Clean, modern, minimal UI

### 5. Authentication
- Email/password sign-up and login
- Each user only sees their own assignments and data
- Protected routes — unauthenticated users redirect to login

---

## Tech Stack

### Frontend
- **Next.js 14+** (App Router, TypeScript) — React framework with file-based routing, server components, and API routes all in one
- **Tailwind CSS** — Utility-first CSS for fast, responsive styling
- **shadcn/ui** — Pre-built, customizable UI components (buttons, cards, dialogs, checkboxes, sheets, progress bars, scroll areas, badges, inputs)
- **Lucide React** — Icon library that pairs with shadcn

### Backend
- **Next.js API Routes** — Server-side endpoints for PDF parsing, checklist generation, and step chat (no separate backend needed)
- **Anthropic SDK (`@anthropic-ai/sdk`)** — Official TypeScript SDK for calling Claude's API with streaming support

### AI
- **Claude (claude-sonnet-4-20250514)** — Powers both checklist generation and per-step chat conversations
- Two main AI interactions:
  - **Checklist generation**: Single structured call that takes assignment text and returns JSON with title + ordered steps
  - **Step chat**: Streaming conversational call with full context (assignment, checklist, active step, conversation history)

### Database & Auth
- **Supabase** — Postgres database + authentication + row-level security, all in one hosted platform
- **@supabase/supabase-js** + **@supabase/ssr** — Client libraries for browser and server-side usage in Next.js

### PDF Processing
- **pdf-parse** — Node.js library for extracting text from uploaded PDFs
- Alternative: Send the PDF directly to Claude's API (it supports native PDF input), useful for complex formatting

### Deployment
- **Vercel** — Zero-config deployment for Next.js, free tier is generous
- **Supabase Free Tier** — 500MB database, 50k monthly active users, more than enough to start
- **Anthropic API** — Pay-as-you-go, only real ongoing cost

---

## Data Model

```
User (managed by Supabase Auth)
  └── assignments
        ├── id: uuid (primary key)
        ├── user_id: uuid (foreign key → auth.users)
        ├── title: text
        ├── original_text: text (extracted PDF content)
        └── created_at: timestamptz

  └── checklist_steps
        ├── id: uuid (primary key)
        ├── assignment_id: uuid (foreign key → assignments)
        ├── step_number: integer
        ├── title: text
        ├── description: text
        ├── completed: boolean (default false)
        ├── chat_history: jsonb (array of {role, content} messages)
        └── created_at: timestamptz
```

Row-level security ensures users can only read/write their own data.

---

## UI Layout

### Dashboard (`/dashboard`)
- Header with app name and user menu (sign out)
- Grid of assignment cards
- Each card: title, date, progress bar, click to open
- Floating "Upload Assignment" button → opens upload dialog

### Assignment Detail (`/dashboard/[id]`)
- Assignment title at top
- Overall progress bar
- Checklist below: each step is a row with checkbox, title, description
- Clicking a step row opens the chat panel

### Step Chat Panel
- Desktop: slides in from the right as a side panel (roughly 40% width)
- Mobile: opens as a full-screen bottom sheet
- Shows step title at top, scrollable message history, input field at bottom
- Messages stream in real-time
- "Mark as complete" button in the panel header

### Login (`/login`)
- Centered card with email/password fields
- Toggle between "Sign In" and "Sign Up"
- Redirects to dashboard on success

---

## API Routes

### `POST /api/parse-assignment`
- Accepts: PDF file via FormData
- Extracts text using pdf-parse
- Sends text to Claude with a structured prompt requesting JSON output
- Returns: `{ title: string, steps: [{ title: string, description: string }] }`
- Saves assignment + steps to Supabase

### `POST /api/step-chat`
- Accepts: `{ assignmentId, stepId, message, history }`
- Loads assignment context and checklist from Supabase
- Calls Claude with streaming enabled, injecting:
  - System prompt with assignment context + active step info
  - Conversation history + new user message
- Returns: Streamed response
- After completion: saves updated chat history to Supabase

---

## Monetization (Lean)

- **Free tier**: 3 assignments/month, checklist generation only (no step chat)
- **Paid tier ($6–8/month)**: Unlimited assignments, full step chat, priority responses
- **Payment**: Stripe Checkout, subscription status stored in Supabase
- Don't build payments until there's demand — focus on the core product first

---

## Key Principles

- **Keep it simple**: No vector databases, no RAG pipelines, no microservices. Claude handles single-document context natively and well.
- **Ship the core loop first**: PDF → checklist → chat. Everything else is secondary.
- **Prompt quality is the product**: The checklist generation prompt determines whether users find the app useful. Invest time here.
- **Streaming is non-negotiable**: Chat responses must stream. Students won't wait for spinners.
- **Mobile-first responsive**: Students live on their phones.
