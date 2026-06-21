# HGWO-MS3D / STACKR — Handoff: Phases 3 & 4

Handoff doc for the UI tab-shell and visual-polish work. Phases 0–2 (repo
cleanup, SQLite auth backend, routing + login/register/protected app) are
**done and committed**. This covers what's left.

Repo: `D:\dev\3d-bin-packing` · Node v22.12.0 · Windows
Stack: CRA (react-scripts 5) + React 19 + Three.js (client) · Express 5 + ws (server)

---

## ⚠️ READ THIS FIRST — the worktree trap

There WAS a git worktree mirror at `.claude/worktrees/admiring-jang-e53b9e/`
that contained a **full duplicate** of the project — identical folder names,
identical files. Edits made there silently never reached the running app,
because `npm start` reads from the real `client/src`, not the mirror. This cost
hours of debugging. **It has been removed**, but the lesson stands:

- Before editing ANY file, glance at the editor title bar / breadcrumb and
  confirm the path is `D:\dev\3d-bin-packing\...` with **no** `.claude` or
  `worktrees` in it.
- Open the folder in your editor as exactly `D:\dev\3d-bin-packing` (the root).
- If a new `.claude/worktrees/...` folder ever reappears, do not edit inside it.

---

## How to run the app (two terminals)

PowerShell note: don't chain with `&&`; use separate lines or `;`. Git Bash
accepts `&&` if you prefer (terminal dropdown in VS Code).

Terminal A — backend:
```powershell
cd D:\dev\3d-bin-packing\server
node index.js
```
Starts HTTP API on :3001 and WebSocket on :3002. First run auto-creates
`server/data/app.db` (SQLite — gitignored, holds users + run history).

Terminal B — frontend:
```powershell
cd D:\dev\3d-bin-packing\client
npm start
```
Opens http://localhost:3000. The `proxy` in `client/package.json` forwards
`/api/...` to :3001, so no CORS work is needed.

You'll be redirected to `/login`. Register an account (any email/password;
roles are Researcher / Logistics / Other and are just a label, not a
permission gate). After login you land on `/app`.

---

## What's already built (don't redo)

**Backend (`server/`)**
- `db.js` — SQLite setup; `users` and `runs` tables.
- `auth.js` — Express router mounted at `/api/auth`:
  - `POST /register`, `POST /login`, `POST /logout`
  - `GET /me` (returns current user; 401 if not signed in)
  - `GET /runs` (current user's run history), `POST /runs` (save a run)
  - Auth via httpOnly cookie `stackr_token` (JWT). `authRequired` middleware
    guards the protected routes.
- `index.js` — original optimizer server (WebSocket runner + `/api/instances`)
  PLUS the auth wiring (`cookieParser`, `app.use("/api/auth", authRouter)`,
  and CORS set to `{ origin: true, credentials: true }`).

**Frontend (`client/src/`)**
- `auth/AuthContext.jsx` — `useAuth()` exposes `{ user, loading, login,
  register, logout }`. All fetches use `credentials: "include"`.
- `auth/LoginPage.jsx`, `auth/RegisterPage.jsx` — minimal but functional
  (intentionally unstyled — styling is Phase 4). Register has a role picker as
  tabs (Researcher / Logistics / Other).
- `index.js` — Router: `/login`, `/register`, `/app` (wrapped in `Protected`),
  catch-all → `/app`. `Protected` redirects to `/login` when not signed in.
- `App.js` — the EXISTING single-page dark "STACKR" app (a `LiveRunner`
  component doing everything), plus `BinViewer.jsx` (3D viewer) and
  `BatchRunner.jsx`. Untouched by Phases 0–2; this is what Phase 3 restructures.

**Key versions / choices already locked**
- `react-router-dom@6` (NOT 7 — v7 broke the routing pattern; stay on 6).
- `better-sqlite3`, `bcryptjs` (pure-JS, no Windows build tools), `jsonwebtoken`,
  `cookie-parser`.

---

## Two open decisions (resolve before/while building)

1. **Brand name:** STACKR (current code) vs HGWO-MS3D (mockup). UNDECIDED —
   pick one and use it consistently in the header and login card.
2. **Palette:** the team wants BOTH light and dark. So Phase 4 should implement
   a **theme toggle** (light = mockup look, dark = current code), not a single
   hardcoded palette. Default to light to match the mockup for the prof demo.

---

# PHASE 3 — Tab shell (restructure `App.js` into 4 tabs)

**Goal:** turn the single-page app into the mockup's tabbed layout while keeping
the live optimizer + 3D viewer working. This is structure, not styling.

The mockup has four tabs: **Logistics · Results · Visualization · Run history**,
a top brand header with an instance/run badge and a profile avatar (with
logout), matching `Screen_Mockup.pdf` slides 3–6.

### Suggested approach
1. **Create `client/src/Shell.jsx`** — the frame:
   - Top bar: brand name (see decision #1), a right-side badge (e.g. selected
     instance / run id), and a profile menu showing the logged-in user's name +
     role with a **Logout** button (call `logout()` from `useAuth()`).
   - A tab bar with the four tabs; track `activeTab` in state.
   - Render the active tab's panel below.
2. **Lift `LiveRunner`'s state up** (or keep `LiveRunner` and pass slices down).
   `LiveRunner` currently holds the WebSocket connection, the streaming
   iteration updates, and the final result. The four panels each consume part
   of that:
   - **Logistics** — instance selector (`GET /api/instances`), container info,
     algorithm settings (Sequential / Embedded / Repair-based → existing
     strategy flags), the item/box table, and the **Run optimizer** button
     (sends `{ action: "run", instancePath, maxTime }` over the WS — protocol
     unchanged).
   - **Results** — the metric stat chips + metrics summary + axis utilization,
     and the convergence curve. Include the **researcher/logistics view toggle**
     here (see below).
   - **Visualization** — the existing `<BinViewer>` + view controls.
   - **Run history** — fetch `GET /api/auth/runs`, list past runs, filter by
     strategy. (This now persists per user via the backend already built.)
3. **Persist runs:** when the WS sends `instance_complete`, POST a summary to
   `/api/auth/runs` (fields: strategy, instance, n_items, space_util,
   dissipation, runtime_s, bins_used) so Run history fills in.
4. **Point `/app` at `Shell`** instead of `App` in `index.js` (or have `App`
   render `Shell`).

### Researcher / Logistics view toggle (requested feature)
The account role is just a label and does NOT gate features. Instead, add a
toggle in the Results/Visualization area so ANYONE can switch between a
"Researcher" view (full metrics: composite score, optimality gap, dissipation,
convergence) and a "Logistics" view (operationally-focused: space utilization,
load/unload order, bins used) of the **same result**. It's a view switch on the
data already there, not a permission system.

### WebSocket protocol (server → client) — for reference
Each message is a JSON line. Types: `instance_info`, `iteration_update`
(has best_bins, best_dissipation, best_composite, temperature, solution[…]),
`integration_applied`, `instance_complete` (final metrics + items[…]),
`stopped`, `error`, `run_closed`. The client sends `{action:"run", instancePath,
maxTime}` and `{action:"stop"}`. **Do not change this protocol** — the Python
optimizer depends on it.

**Checkpoint 3:** app is tabbed; every existing feature still works (running an
instance still streams and renders in 3D); Run history populates after a run;
view toggle switches the Results presentation. Commit:
`git commit -m "checkpoint 3: tab shell + run history + view toggle"`

---

# PHASE 4 — Visual polish (match the mockup + prof feedback)

**Goal:** make it look like `Screen_Mockup.pdf`. This is the phase that closes
the visual gap.

### Theme toggle (per decision #2)
Implement light + dark palettes with a toggle (e.g. in the header or profile
menu). Light = mockup (white/elevated cards, indigo/violet accent ~`#6366f1`,
soft shadows). Dark = current STACKR look. Use CSS variables so the toggle just
swaps a class on the root. Default light.

### Mockup-feedback items (from `Mock_up_Feedback` — must address)
- **"Sign in" not "Request access"** on the auth screen. (Login already says
  "Sign in"; make sure Register/links match and there's no "Request access".)
- **Visible frames** — cards/panels must have visible borders/outlines; the
  mockup screens currently look like they float.
- **Separate large graphs** — the convergence curve and axis-utilization were
  cramped/cut-off ("putol") in the mockup. Give each its OWN full-size card in
  the Results tab, not a tiny clipped box.
- **Palette open** — hence the toggle above.

### Polish targets
- Login/Register → the glassmorphic centered card from mockup slide 2 (brand
  logo, "Welcome back / Sign in to continue", email + password fields with
  icons, full-width Sign in button, "No account? Register" link).
- Header, tab bar, stat chips, tables, and the run-history rows styled to match
  slides 3–6.
- Profile avatar with initials, dropdown with name/role + logout.

**Checkpoint 4:** closely matches the mockup in light mode; dark mode works via
toggle; all three feedback items addressed. Commit, then it's ready to show the
SE professor for the clutter critique.

---

## Git / workflow notes
- Commit at each checkpoint. Keep `.claude/` and `server/data/` OUT of git
  (already in `.gitignore`).
- Local `main` is ahead of `origin/main` by a couple commits — run `git push`
  to back up to GitHub when ready.
- The Python optimizer + dataset are unchanged; don't touch `optimizer/` or
  `data/`. We are NOT building the Multi-Objective variant — current scope is
  HD-GWO + Simulated Annealing only.

## Useful references in the repo
- `Screen_Mockup.pdf` — the target design (slides 1–7).
- `Mock_up_Feedback` — the prof's notes (the must-address items above).
