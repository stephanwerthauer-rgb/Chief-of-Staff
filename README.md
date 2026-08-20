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

Emails and messages: forward/copy the important bit and paste it into Head
space — that's the capture point. (True Gmail/Calendar sync needs a server and
OAuth credentials; the storage and planner here are structured so that could be
added later as a sync layer feeding the same inbox and events.)

## Tech

Plain HTML/CSS/JS — no build step, no dependencies.

```
index.html            app shell
css/style.css         calm design system (light + dark)
js/store.js           localStorage data layer
js/planner.js         the scheduling engine (capacity + deadlines → day plan)
js/app.js             UI and flows
sw.js                 offline support
manifest.webmanifest  installability
icons/                app icons
```

To run locally: `python3 -m http.server` in the repo folder, then open
`http://localhost:8000`.
