// Drunk to Survive — front-end app
// Two INDEPENDENT contests (drivers + teams), switched via tabs.
// Loads config.json + results.json and renders the active contest.

let CONFIG, RESULTS;
let currentContest = "drivers"; // "drivers" | "teams"
let traceChart;

const CONTEST_LABEL = { drivers: "Drivers Contest", teams: "Teams Contest" };

async function loadJSON(path) {
  const res = await fetch(path + "?t=" + Date.now()); // cache-bust during dev
  if (!res.ok) throw new Error(`Failed to load ${path} (${res.status})`);
  return res.json();
}

function completedRounds() {
  return RESULTS.rounds.filter((r) => r.completed);
}

// picks list for the active contest: contender.drivers OR contender.teams
function picksFor(contender, contest) {
  return contest === "drivers" ? contender.drivers : contender.teams;
}

function score(round, contenderId, contest) {
  return round.scores[contenderId][contest];
}

function latestCumulative(contenderId, contest) {
  const done = completedRounds();
  if (!done.length) return 0;
  return score(done[done.length - 1], contenderId, contest).cumulative;
}

// ---------- Head-to-head bubbles ----------
function renderH2H(contest) {
  const el = document.getElementById("h2h");
  const [a, b] = CONFIG.contenders;
  const totalA = latestCumulative(a.id, contest);
  const totalB = latestCumulative(b.id, contest);
  const leaderId = totalA === totalB ? null : totalA > totalB ? a.id : b.id;
  const gap = Math.abs(totalA - totalB);

  function card(c, total) {
    const isLeader = c.id === leaderId;
    const avatar = c.photo
      ? `<img class="avatar" src="${c.photo}" alt="${c.name}" />`
      : `<div class="avatar">${c.name[0].toUpperCase()}</div>`;
    const picks = picksFor(c, contest).map((p) => p.name).join(" · ");
    return `
      <div class="contender ${isLeader ? "leader" : ""}" style="--accent:${c.color}">
        ${avatar}
        <div class="name">${c.name}</div>
        <div class="points">${total}</div>
        <div class="points-label">${CONTEST_LABEL[contest]} pts</div>
        <div class="picks">${picks}</div>
        ${isLeader ? `<div class="leader-badge">★ Leading</div>` : ""}
      </div>`;
  }

  const middle = `
    <div class="vs">VS
      ${gap ? `<span class="gap-pill">${gap} pt${gap === 1 ? "" : "s"} gap</span>` : `<span class="gap-pill">dead heat</span>`}
    </div>`;

  el.innerHTML = card(a, totalA) + middle + card(b, totalB);
}

// ---------- The trace (line chart) ----------
function renderTrace(contest) {
  const done = completedRounds();
  const labels = done.map((r) => r.short || r.name);
  const datasets = CONFIG.contenders.map((c) => ({
    label: c.name,
    data: done.map((r) => score(r, c.id, contest).cumulative),
    borderColor: c.color,
    backgroundColor: c.color + "33",
    pointBackgroundColor: c.color,
    pointRadius: 4,
    pointHoverRadius: 6,
    borderWidth: 3,
    tension: 0.25,
    fill: false,
  }));

  const ctx = document.getElementById("traceChart");
  if (traceChart) traceChart.destroy();
  traceChart = new Chart(ctx, {
    type: "line",
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { labels: { color: "#f3f4f6", font: { family: "Inter", weight: "600" }, usePointStyle: true } },
      },
      scales: {
        x: { title: { display: true, text: "Grand Prix", color: "#9aa1ad" }, ticks: { color: "#9aa1ad" }, grid: { color: "#2a2e39" } },
        y: { title: { display: true, text: CONTEST_LABEL[contest] + " — total points", color: "#9aa1ad" }, ticks: { color: "#9aa1ad" }, grid: { color: "#2a2e39" }, beginAtZero: true },
      },
    },
  });
}

// ---------- Standings table ----------
function renderStandings(contest) {
  const table = document.getElementById("standingsTable");
  const rows = CONFIG.contenders
    .map((c) => ({ c, total: latestCumulative(c.id, contest) }))
    .sort((x, y) => y.total - x.total);
  const leaderTotal = rows[0].total;

  const head = `<thead><tr><th>Pos</th><th>Contender</th><th>Picks</th><th>Total</th><th>Gap</th></tr></thead>`;
  const body = rows
    .map((row, i) => {
      const picks = picksFor(row.c, contest).map((p) => p.name).join(", ");
      const gap = i === 0 ? "—" : "-" + (leaderTotal - row.total);
      return `<tr>
        <td class="num">${i + 1}</td>
        <td><span class="dot" style="background:${row.c.color}"></span>${row.c.name}</td>
        <td style="color:var(--muted)">${picks}</td>
        <td class="num total-col">${row.total}</td>
        <td class="num">${gap}</td>
      </tr>`;
    })
    .join("");
  table.innerHTML = head + `<tbody>${body}</tbody>`;
}

// ---------- Per-race breakdown ----------
function renderBreakdown(contest) {
  const table = document.getElementById("breakdownTable");
  const done = completedRounds();
  const cs = CONFIG.contenders;

  const head = `<thead><tr><th>Round</th><th>Grand Prix</th>${cs
    .map((c) => `<th><span class="dot" style="background:${c.color}"></span>${c.name}</th>`)
    .join("")}<th>Leader</th></tr></thead>`;

  const body = done
    .map((r) => {
      const cells = cs
        .map((c) => {
          const s = score(r, c.id, contest);
          return `<td class="num">+${s.round} <span style="color:var(--muted)">(${s.cumulative})</span></td>`;
        })
        .join("");
      const sorted = [...cs].sort((a, b) => score(r, b.id, contest).cumulative - score(r, a.id, contest).cumulative);
      const tie = score(r, sorted[0].id, contest).cumulative === score(r, sorted[1].id, contest).cumulative;
      const lead = tie ? "Tie" : sorted[0].name;
      return `<tr><td class="num">${r.round}</td><td>${r.name}</td>${cells}<td>${lead}</td></tr>`;
    })
    .join("");
  table.innerHTML =
    head +
    `<tbody>${body}</tbody>` +
    `<tfoot><tr><td></td><td style="color:var(--muted);font-size:.75rem">+round (cumulative)</td><td colspan="${cs.length + 1}"></td></tr></tfoot>`;
}

// ---------- Render a whole contest ----------
function renderContest(contest) {
  currentContest = contest;
  document.getElementById("contestCaption").textContent =
    contest === "drivers"
      ? "Only the 3 chosen drivers' points count here."
      : "Only the 3 chosen teams' points count here.";
  document.getElementById("traceTitle").textContent = "The Trace — " + CONTEST_LABEL[contest];

  document.querySelectorAll(".tab").forEach((t) => {
    const active = t.dataset.contest === contest;
    t.classList.toggle("is-active", active);
    t.setAttribute("aria-selected", active ? "true" : "false");
  });

  renderH2H(contest);
  renderTrace(contest);
  renderStandings(contest);
  renderBreakdown(contest);
}

// ---------- Boot ----------
(async function init() {
  try {
    [CONFIG, RESULTS] = await Promise.all([
      loadJSON("data/config.json"),
      loadJSON("data/results.json"),
    ]);

    document.getElementById("siteTitle").innerHTML =
      (CONFIG.title || "Drunk to Survive").replace(/to/i, '<span class="to">2</span>').toUpperCase();
    document.getElementById("siteSubtitle").textContent = CONFIG.subtitle || "";
    if (RESULTS.mock) document.getElementById("mockFlag").hidden = false;

    document.querySelectorAll(".tab").forEach((t) =>
      t.addEventListener("click", () => renderContest(t.dataset.contest))
    );

    renderContest("drivers");

    const when = RESULTS.generated_at ? new Date(RESULTS.generated_at).toLocaleString() : "—";
    document.getElementById("updatedAt").textContent = "Results updated: " + when;
  } catch (err) {
    document.querySelector("main").innerHTML =
      `<div class="panel"><h2>Couldn't load data</h2><p style="color:var(--muted)">${err.message}</p></div>`;
    console.error(err);
  }
})();
