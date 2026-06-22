# 🏎️ Drunk to Survive — F1 2026 Contest Tracker

A head-to-head tracking site for a season-long Formula 1 betting contest between
two friends, **Gav** and **Nico**, across the entire **2026 F1 World Championship**.

Each contender picks **3 drivers** and **3 teams** at the start of the season.
After every race weekend, their score grows by the points their picks earned.
The site visualizes who's ahead — race by race — all season long.

> Project name: **Drunk to Survive** (a nod to *Drive to Survive*). The GitHub
> repo is `drunk-to-survive`.

---

## 🥊 The Contenders & Their Picks

| | **Gav** (🧑 you) | **Nico** |
|---|---|---|
| **Driver 1** | Antonelli | Lewis Hamilton |
| **Driver 2** | Piastri | Antonelli |
| **Driver 3** | Hadjar | Franco Colapinto |
| **Team 1** | Mercedes | Ferrari |
| **Team 2** | Red Bull | Alpine |
| **Team 3** | Williams | Cadillac |

**Notable quirks of the picks** (all allowed by the rules):
- **Antonelli is picked by both** contenders — he scores for both.
- Nico's picks overlap by design: **Hamilton (Ferrari)** + **Ferrari**, and
  **Colapinto (Alpine)** + **Alpine** — his drivers also feed his teams' points.

> ⚠️ Driver↔team mappings for 2026 (e.g. which team Hadjar drives for) will be
> confirmed automatically from live data during the build — see the SPEC.

---

## 📊 How Scoring Works — TWO independent contests

This is the most important rule: **Drunk to Survive is actually two separate
competitions running in parallel.** There is **no combined total**.

1. **🏎️ Drivers Contest** — only each contender's **3 drivers'** points count.
2. **🏆 Teams Contest** — only each contender's **3 teams'** points count.

So every contender has **two independent running scores** (a drivers score and a
teams score), and there are **two separate winners** at the end of 2026 — a
Drivers Champion and a Teams Champion.

For each contest, after every race weekend a contender's score grows by:

```
drivers_round = points of their 3 drivers   (Grand Prix + Sprint)
teams_round   = points of their 3 teams      (Grand Prix + Sprint)
```

- **Grand Prix (Sunday) points** — official F1 system: 25-18-15-12-10-8-6-4-2-1 (top 10).
- **Sprint (Saturday) points** — official F1 system: 8-7-6-5-4-3-2-1 (top 8).
- **Team points** = the constructor's points for that session (i.e. the sum of
  that team's two drivers' points), exactly as F1 awards them.
- Each contest's **season score** is the running sum of that contest's per-round points.

---

## ✨ What the Site Shows

The site has **two tabs — Drivers Contest and Teams Contest** — and each tab shows
that contest's own:

- **Head-to-head bubbles** — both contenders' photos with their score *in that contest*,
  styled in full F1 livery.
- **The trace (line chart)** — the headline visual:
  - **X-axis:** each Grand Prix of the season (in order).
  - **Y-axis:** cumulative points *in that contest*.
  - **Two lines** (one per contender) so you can see who's pulling ahead.
- **Standings table** — score, gap, and the picks.
- **Per-race breakdown** — what each round added and the running cumulative.
- **F1-themed design** — team colors, driver/team cards, the works.

---

## 🔄 How Results Get Updated (no manual typing)

Results come from the free, public **Jolpica-F1 API** (`api.jolpi.ca`), the
community-maintained successor to the old Ergast API. It provides both **race**
and **sprint** results in a clean format.

Updating is **one click** via a **GitHub Action**:

1. After a race weekend, click **Run workflow** in the repo's **Actions** tab
   (or let the scheduled run do it automatically).
2. The Action fetches the latest official results, calculates each contender's
   points, and **saves them into `data/results.json`** in the repo.
3. The website reads that saved file and re-renders the standings and the chart.

Because results are **saved in the repo**, the season history is preserved and
the site keeps working even if the API is temporarily down.

---

## 🧱 Tech Stack

- **Frontend:** static HTML + CSS + JavaScript (no build step) — hostable on GitHub Pages.
- **Chart:** [Chart.js](https://www.chartjs.org/) for the cumulative line trace.
- **Data source:** [Jolpica-F1 API](https://github.com/jolpica/jolpica-f1).
- **Data pipeline:** a Python (or Node) script run by a **GitHub Action**
  (`workflow_dispatch` for one-click + a schedule for auto-updates).
- **Hosting:** **GitHub Pages** (free, served straight from this repo).

---

## 🗺️ Roadmap

- [x] **Phase 0 — Documentation** (this README + `docs/SPEC.md`)
- [ ] **Phase 1 — Site skeleton + mock data**, deployed to GitHub Pages
- [ ] **Phase 2 — Data pipeline**: Jolpica fetch + points calc + GitHub Action
- [ ] **Phase 3 — Full F1 theming**: contender bubbles, livery, polish
- [ ] **Phase 4 — Automation**: scheduled auto-updates after race weekends

---

## 📁 Repository Structure (planned)

```
drunk-to-survive/
├── README.md            # this file
├── docs/
│   └── SPEC.md          # detailed technical design
├── index.html           # the site (Phase 1)
├── assets/              # css, js, images, contender photos
├── data/
│   ├── config.json      # contenders, picks, scoring rules
│   └── results.json     # generated season results (by the Action)
├── scripts/
│   └── fetch_results.py # pulls Jolpica data + computes points (Phase 2)
└── .github/workflows/
    └── update-results.yml  # the one-click / scheduled updater (Phase 2)
```

---

*Built step by step — see `docs/SPEC.md` for the full technical design.*
