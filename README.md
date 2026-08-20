# Haven 🌿 — a gentle chief of staff

A calm, phone-first app that carries the weight of remembering, planning and
prioritising — built for someone who is overwhelmed by to-do lists, not helped
by them.

Haven is deliberately different from a normal productivity app:

- **One thing at a time.** Today shows a single "Just this, for now" card, not a
  wall of tasks.
- **Prescriptive planning.** You tell Haven what something is, roughly how long
  it takes, and when it's due. *Haven* decides which day it happens — always
  before the deadline — so nothing has to be held in your head.
- **A protected daily capacity.** Each day holds a set amount of "doing"
  (default: a steady 4 hours, adjustable). Calendar events shrink it. Haven will
  never quietly overfill a day; overflow flows to the next day with room.
- **Small chunks.** Anything estimated at an hour or more triggers a gentle
  offer to break it into tiny steps ("open the email" counts). Focus mode shows
  only the next tiny step, with a breathing circle and a no-pressure timer.
- **Head space.** A brain-dump inbox for tasks, worries, emails and messages —
  pasted or typed. Sorting happens later, *one item at a time*, with four soft
  choices: Today · Give it a day · Someday · Let it go.
- **Kind endings.** "Close the day" celebrates what got done and quietly rehomes
  what didn't — no guilt, no red badges, no overdue shaming anywhere.
- **A morning check-in.** One tap — running low / okay / good — and the day
  reshapes itself: a low-energy day is automatically planned lighter.
- **A "too much" escape hatch.** When it all tightens up: shrink the day to one
  tiny thing, move everything to tomorrow, or just breathe for a minute.
- **Recurring tasks.** Laundry, bills, watering plants — finish one and the
  next occurrence quietly books itself in.
- **A weekly look-back.** "Look what you did": everything finished this week,
  as evidence against the "I'm not doing enough" voice. No streaks, no scores.
- **Hand it over.** Any task or email can be handed to a partner in one tap —
  a kind pre-written message opens in the share sheet.
- **A week-full guardrail.** If a new task pushes the coming week near its
  limit, Haven says so gently and offers to help make room — it never lets
  overload happen silently.
- **Share into Haven** (Android): share any message or email from another app
  straight into Head space via the system share sheet.

Everything is written in warm, calm language, with soft colours, large touch
targets, and a dark mode that follows the phone.

## Getting it on her phone

Haven is a static PWA — no server, no account, no cost. Her data never leaves
her phone (stored in the browser's local storage; Settings has backup/restore).

1. **Host it** — easiest is GitHub Pages:
   - In this repo: *Settings → Pages → Deploy from a branch* → choose the main
     branch, root folder. GitHub gives you a URL like
     `https://<user>.github.io/Chief-of-Staff/`.
2. **Install it on the phone:**
   - **iPhone:** open the URL in Safari → Share button → *Add to Home Screen*.
   - **Android:** open the URL in Chrome → menu (⋮) → *Add to Home screen* /
     *Install app*.
3. It now opens full-screen like a native app and works offline.

## Using it (the 60-second version)

- **＋ button** → add a task (with a time guess and optional deadline), a
  calendar entry, or "just get it out of my head".
- **Today** → do the one thing on the card. *Begin gently* opens focus mode;
  *Not today* moves it on kindly. In the evening, *Close the day*.
- **Plan** → the next two weeks, showing exactly which day each thing will
  happen and whether every deadline is covered.
- **Head space** → dump everything; then "Sort these together — one at a time".
- **Yours** → her name, her daily pace, and backups.

Messages from other apps (WhatsApp, texts): copy the important bit and paste it
into Head space — that's the capture point. Email and calendar can sync
automatically — see below.

## Connecting Gmail and Google Calendar

Haven can link her Google account **directly from the phone — no server
anywhere**. Calendar appointments flow into the plan (and shrink the day's task
capacity); Gmail is watched through a strict three-layer gate so that **only
emails that genuinely need something from her** ever appear in Head space:

1. **Gmail-side query** — spam, promotions, social and forum mail never even
   get fetched.
2. **Machine-mail filter** — no-reply senders and anything with an unsubscribe
   header (newsletters, bulk mail) are dropped on the phone.
3. **"Does this need *her*?"** — the remainder is classified. With a Claude API
   key set (optional, see below), Claude reads each sender/subject/preview and
   lets through only what requires her action, rephrased as a small kind task
   with a time estimate ("Reply to Sarah about the weekend · 10 min"). Without
   a key, a conservative built-in filter is used. When in doubt, Haven stays
   quiet — a missed newsletter is fine; a noisy app is not.

Everything already surfaced is remembered, so nothing appears twice, and each
item links back to the original email in Gmail.

### One-time Google setup (~10 minutes, free)

Google requires an app "client ID" before any app may read mail — this is what
keeps it secure. You (not her) can do this once:

1. Go to [console.cloud.google.com](https://console.cloud.google.com) → create
   a project (call it "Haven").
2. **APIs & Services → Library** → enable **Gmail API** and **Google Calendar
   API**.
3. **APIs & Services → OAuth consent screen** → External → fill in the app
   name ("Haven") and your email → add her Gmail address under **Test users**.
   (As a test-user app it never needs Google review.)
4. **Scopes**: add `gmail.readonly`, `calendar.readonly`, `userinfo.email`.
5. **APIs & Services → Credentials → Create credentials → OAuth client ID** →
   type **Web application** → under **Authorized JavaScript origins** add your
   GitHub Pages origin (e.g. `https://<user>.github.io`).
6. Copy the client ID (ends in `.apps.googleusercontent.com`) and paste it
   into Haven → **Yours → Connected accounts**, then tap **Connect Google**
   on her phone and sign in as her.

Access is read-only (Haven can never send, delete or modify anything), the
token lives only in the phone's browser, and *Disconnect* revokes it.

### Optional: Claude-powered email filtering

In **Yours → Smart email filtering**, paste an Anthropic API key (create one at
[console.anthropic.com](https://console.anthropic.com)). The key is stored only
on the phone and calls the Claude API directly from the browser. Each sync
classifies at most 25 message previews in a single small request, so the cost
is pennies per month. Requests are sent with server-side refusal fallbacks
enabled, and if a request fails for any reason Haven quietly falls back to the
built-in filter — mail checking never breaks.

## Tech

Plain HTML/CSS/JS — no build step, no dependencies.

```
index.html            app shell
css/style.css         calm design system (light + dark)
js/store.js           localStorage data layer
js/planner.js         the scheduling engine (capacity + deadlines → day plan)
js/connect.js         Google sign-in, Gmail/Calendar sync, email triage gate
js/app.js             UI and flows
sw.js                 offline support
manifest.webmanifest  installability
icons/                app icons
```

To run locally: `python3 -m http.server` in the repo folder, then open
`http://localhost:8000`.
