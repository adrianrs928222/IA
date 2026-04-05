const BASE_URL = "https://funcional-s4vd.onrender.com";
const PICKS_URL = `${BASE_URL}/api/picks`;
const HISTORY_URL = `${BASE_URL}/api/history`;

const app = document.getElementById("app");

let ALL_PICKS = [];
let FILTERS = {
  league: "",
  confidence: "",
  type: ""
};

/* ------------------ HELPERS ------------------ */

function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function num(n) {
  return Number(n || 0);
}

/* ------------------ BADGES ------------------ */

function confBadge(c) {
  if (c >= 80) return `<span class="b green">ALTA</span>`;
  if (c >= 70) return `<span class="b yellow">MEDIA</span>`;
  return `<span class="b red">BAJA</span>`;
}

function resBadge(s) {
  if (s === "won") return `<span class="r win">✔</span>`;
  if (s === "lost") return `<span class="r lost">✖</span>`;
  return `<span class="r pend">⏳</span>`;
}

function typeBadge(t) {
  if (t === "winner") return `<span class="t">Ganador</span>`;
  if (t === "btts_yes") return `<span class="t">BTTS</span>`;
  if (t === "over_2_5") return `<span class="t">+2.5</span>`;
  return `<span class="t">Pick</span>`;
}

/* ------------------ FILTER ------------------ */

function applyFilters(picks) {
  return picks.filter(p => {

    if (FILTERS.league && p.league !== FILTERS.league) return false;

    if (FILTERS.confidence === "high" && p.confidence < 80) return false;
    if (FILTERS.confidence === "mid" && p.confidence < 70) return false;

    if (FILTERS.type && p.pick_type !== FILTERS.type) return false;

    return true;
  });
}

/* ------------------ UI ------------------ */

function filtersUI(leagues) {
  return `
  <div class="filters">
    <select id="league">
      <option value="">Ligas</option>
      ${leagues.map(l => `<option value="${l}">${l}</option>`).join("")}
    </select>

    <select id="conf">
      <option value="">Confianza</option>
      <option value="high">Alta</option>
      <option value="mid">Media</option>
    </select>

    <select id="type">
      <option value="">Mercado</option>
      <option value="winner">Ganador</option>
      <option value="btts_yes">BTTS</option>
      <option value="over_2_5">+2.5</option>
    </select>

    <button id="refresh">Refresh</button>
  </div>
  `;
}

function card(p) {
  return `
  <div class="card">
    <div class="top">
      <div>
        <div class="league">${p.league}</div>
        <h2>${p.match}</h2>
      </div>
      <div>${p.time_local}</div>
    </div>

    <div class="tags">
      ${typeBadge(p.pick_type)}
      ${confBadge(p.confidence)}
      ${resBadge(p.status)}
    </div>

    <div class="pick">${p.pick}</div>

    <div class="stats">
      💰 ${p.odds} | 📊 ${p.confidence}
    </div>

    ${p.score_line ? `<div class="score">${p.score_line}</div>` : ""}

    <p class="tip">${esc(p.tipster_explanation)}</p>
  </div>
  `;
}

function historyUI(h) {
  if (!h.days?.length) return "";

  return `
  <section class="history">
    <h2>Historial</h2>

    ${h.days.map(d => `
      <div class="day">
        <h3>${d.date}</h3>
        <div>✔ ${d.stats.won} | ✖ ${d.stats.lost}</div>
      </div>
    `).join("")}
  </section>
  `;
}

/* ------------------ RENDER ------------------ */

function render(data, history) {
  ALL_PICKS = data.picks || [];

  const leagues = [...new Set(ALL_PICKS.map(p => p.league))];

  const picks = applyFilters(ALL_PICKS);

  app.innerHTML = `
    ${filtersUI(leagues)}

    <div class="meta">
      ${picks.length} picks
    </div>

    <div class="grid">
      ${picks.map(card).join("")}
    </div>

    ${historyUI(history)}
  `;

  bind(data, history);
}

/* ------------------ EVENTS ------------------ */

function bind(data, history) {

  document.getElementById("league").onchange = e => {
    FILTERS.league = e.target.value;
    render(data, history);
  };

  document.getElementById("conf").onchange = e => {
    FILTERS.confidence = e.target.value;
    render(data, history);
  };

  document.getElementById("type").onchange = e => {
    FILTERS.type = e.target.value;
    render(data, history);
  };

  document.getElementById("refresh").onclick = () => load(true);
}

/* ------------------ LOAD ------------------ */

async function load(force = false) {
  try {
    const url = force ? `${PICKS_URL}?force_refresh=true` : PICKS_URL;

    const [data, history] = await Promise.all([
      fetch(url).then(r => r.json()),
      fetch(HISTORY_URL).then(r => r.json())
    ]);

    render(data, history);

  } catch {
    app.innerHTML = "Error cargando";
  }
}

document.addEventListener("DOMContentLoaded", () => load(true));