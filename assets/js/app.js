// Drunk to Survive — front-end app
// Loads config.json + results.json and renders the dashboard.

async function loadJSON(path) {
  const res = await fetch(path + "?t=" + Date.now()); // cache-bust during dev
  if (!res.ok) throw new Error(`Failed to load ${path} (${res.status})`);
  return res.json();
}

function byId(list, id) {
  return list.find((x) => x.id === id);
}

function completedRounds(results) {
  return results.rounds.filter((r) => r.completed);
}

function latestCumulative(results, contenderId) {
  const done = completedRounds(results);
  if (!done.length) return 0;
  return done[done.length - 1].scores[contenderId].cumulative;
}

// ---------- Head-to-head bubbles ----------
function renderH2H(config, results) {
  const el = document.getElementById("h2h");
  const [a, b] = config.contenders;
  const totalA = latestCumulative(results, a.id);
  const totalB = latestCumulative(results, b.id);
  const leaderId = totalA === totalB ? null : totalA > totalB ? a.id : b.id;
  const gap = Math.abs(totalA - totalB);

  function card(c, total) {
    const isLeader = c.id === leaderId;
    const avatar = c.photo
      ? `<img class="avatar" src="${c.photo}" alt="${c.name}" />`
      : `<div class="avatar">${c.name[0].toUpperCase()}</div>`;
    const drivers = c.drivers.map((d) => d.name).join(" · ");
    const teams = c.teams.map((t) => t.name).join(" · ");
    return `
      <div class="contender ${isLeader ? "leader" : ""}" style="--accent:${c.color}">
        ${avatar}
        <div class="name">${c.name}</div>
        <div class="points">${total}</div>
        <div class="points-label">Total Points</div>
        <div class="picks"><b>Drivers:</b> ${drivers}<br/><b>Teams:</b> ${teams}</div>
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
let traceChart;
function renderTrace(config, results) {
  const done = completedRounds(results);
  const labels = done.map((r) => r.short || r.name);
  const datasets = config.contenders.map((c) => ({
    label: c.name,
    data: done.map((r) => r.scores[c.id].cumulative),
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
        tooltip: { titleColor: "#fff", bodyColor: "#fff" },
      },
      scales: {
        x: {
          title: { display: true, text: "Grand Prix", color: "#9aa1ad" },
          ticks: { color: "#9aa1ad" },
          grid: { color: "#2a2e39" },
        },
        y: {
          title: { display: true, text: "Total Points", color: "#9aa1ad" },
          ticks: { color: "#9aa1ad" },
          grid: { color: "#2a2e39" },
          beginAtZero: true,
        },
      },
    },
  });
}

// ---------- Standings table ----------
function renderStandings(config, results) {
  const table = document.getElementById("standingsTable");
  const rows = config.contenders
    .map((c) => ({ c, total: latestCumulative(results, c.id) }))
    .sort((x, y) => y.total - x.total);

  const head = `<thead><tr><th>Pos</th><th>Contender</th><th>Drivers</th><th>Teams</th><th>Total</th><th>Gap</th></tr></thead>`;
  const leaderTotal = rows[0].total;
  const body = rows
    .map((row, i) => {
      const done = completedRounds(results);
      let dTot = 0, tTot = 0;
      done.forEach((r) => { dTot += r.scores[row.c.id].drivers; tTot += r.scores[row.c.id].teams; });
      const gap = i === 0 ? "—" : "-" + (leaderTotal - row.total);
      return `<tr>
        <td class="num">${i + 1}</td>
        <td><span class="dot" style="background:${row.c.color}"></span>${row.c.name}</td>
        <td class="num">${dTot}</td>
        <td class="num">${tTot}</td>
        <td class="num total-col">${row.total}</td>
        <td class="num">${gap}</td>
      </tr>`;
    })
    .join("");
  table.innerHTML = head + `<tbody>${body}</tbody>`;
}

// ---------- Per-race breakdown ----------
function renderBreakdown(config, results) {
  const table = document.getElementById("breakdownTable");
  const done = completedRounds(results);
  const cs = config.contenders;

  const head = `<thead><tr><th>Round</th><th>Grand Prix</th>${cs
    .map((c) => `<th><span class="dot" style="background:${c.color}"></span>${c.name}</th>`)
    .join("")}<th>Leader</th></tr></thead>`;

  const body = done
    .map((r) => {
      const cells = cs.map((c) => `<td class="num">+${r.scores[c.id].weekend} <span style="color:var(--muted)">(${r.scores[c.id].cumulative})</span></td>`).join("");
      // who leads after this round
      const sorted = [...cs].sort((a, b) => r.scores[b.id].cumulative - r.scores[a.id].cumulative);
      const lead = r.scores[sorted[0].id].cumulative === r.scores[sorted[1].id].cumulative ? "Tie" : sorted[0].name;
      return `<tr><td class="num">${r.round}</td><td>${r.name}</td>${cells}<td>${lead}</td></tr>`;
    })
    .join("");
  table.innerHTML = head + `<tbody>${body}</tbody>` +
    `<tfoot><tr><td></td><td style="color:var(--muted);font-size:.75rem">+weekend (cumulative)</td><td colspan="${cs.length + 1}"></td></tr></tfoot>`;
}

// ---------- Boot ----------
(async function init() {
  try {
    const [config, results] = await Promise.all([
      loadJSON("data/config.json"),
      loadJSON("data/results.json"),
    ]);

    document.getElementById("siteTitle").innerHTML =
      (config.title || "Drunk to Survive").replace(/to/i, '<span class="to">2</span>').toUpperCase();
    document.getElementById("siteSubtitle").textContent = config.subtitle || "";

    if (results.mock) document.getElementById("mockFlag").hidden = false;

    renderH2H(config, results);
    renderTrace(config, results);
    renderStandings(config, results);
    renderBreakdown(config, results);

    const when = results.generated_at ? new Date(results.generated_at).toLocaleString() : "—";
    document.getElementById("updatedAt").textContent = "Results updated: " + when;
  } catch (err) {
    document.querySelector("main").innerHTML =
      `<div class="panel"><h2>Couldn't load data</h2><p style="color:var(--muted)">${err.message}</p></div>`;
    console.error(err);
  }
})();
