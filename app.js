const BASE_URL = "https://funcional-s4vd.onrender.com";
const BACKEND_URL = `${BASE_URL}/api/picks`;
const HISTORY_URL = `${BASE_URL}/api/history`;
const CACHE_KEY = "top-picks-cache-v26";

const app = document.getElementById("app");

let ALL_PICKS = [];
let CURRENT_FILTERS = {
  league: "",
  confidence: "",
  odds: ""
};

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

/* ---------------- BADGES ---------------- */

function confidenceBadge(conf) {
  const n = Number(conf || 0);
  if (n >= 75) return `<span class="badge badge-green">ALTA</span>`;
  if (n >= 65) return `<span class="badge badge-yellow">MEDIA</span>`;
  return `<span class="badge badge-red">BAJA</span>`;
}

function resultBadge(status) {
  if (status === "won") return `<span class="result-pill result-won">✔</span>`;
  if (status === "lost") return `<span class="result-pill result-lost">✖</span>`;
  return `<span class="result-pill result-pending">⏳</span>`;
}

function pickTypeBadge(type) {
  if (type === "winner") return `<span class="type-pill">Ganador</span>`;
  if (type === "double_chance") return `<span class="type-pill">Doble</span>`;
  if (type === "draw_no_bet") return `<span class="type-pill">DNB</span>`;
  return `<span class="type-pill">Pick</span>`;
}

/* ---------------- FILTROS ---------------- */

function renderFilters(leagues) {
  return `
    <div class="filters">
      <select id="f-league">
        <option value="">Todas ligas</option>
        ${leagues.map(l => `<option value="${l}">${l}</option>`).join("")}
      </select>

      <select id="f-confidence">
        <option value="">Confianza</option>
        <option value="high">Alta</option>
        <option value="mid">Media</option>
      </select>

      <select id="f-odds">
        <option value="">Cuotas</option>
        <option value="low"><1.5</option>
        <option value="mid">1.5-2</option>
        <option value="high">>2</option>
      </select>

      <button onclick="resetFilters()">Reset</button>
    </div>
  `;
}

function applyFilters(picks) {
  return picks.filter(p => {
    if (CURRENT_FILTERS.league && p.league !== CURRENT_FILTERS.league) return false;

    if (CURRENT_FILTERS.confidence === "high" && p.confidence < 75) return false;
    if (CURRENT_FILTERS.confidence === "mid" && p.confidence < 65) return false;

    if (CURRENT_FILTERS.odds === "low" && p.odds >= 1.5) return false;
    if (CURRENT_FILTERS.odds === "mid" && (p.odds < 1.5 || p.odds > 2)) return false;
    if (CURRENT_FILTERS.odds === "high" && p.odds <= 2) return false;

    return true;
  });
}

/* ---------------- RENDER PICKS ---------------- */

function renderPickCard(p) {
  return `
    <article class="pick-card">
      <div class="pick-top">
        <div>
          <div class="competition">${escapeHtml(p.league)}</div>
          <h2>${escapeHtml(p.match)}</h2>
        </div>
        <div>${p.time_local}</div>
      </div>

      <div class="pick-tags">
        ${pickTypeBadge(p.pick_type)}
        ${confidenceBadge(p.confidence)}
        ${resultBadge(p.status)}
      </div>

      <div class="pick-main">
        <strong>${escapeHtml(p.pick)}</strong>
      </div>

      <div class="stats">
        <span>💰 ${p.odds}</span>
        <span>📊 ${p.confidence}</span>
        <span>${escapeHtml(p.bookmaker)}</span>
      </div>

      ${p.score_line ? `<div class="score">Resultado: ${p.score_line}</div>` : ""}

      <p class="tip">${escapeHtml(p.tipster_explanation)}</p>
    </article>
  `;
}

/* ---------------- HISTORIAL ---------------- */

function renderHistory(history) {
  if (!history || !history.days) return "";

  return `
    <section>
      <h2>Historial</h2>

      ${history.days.map(day => `
        <div class="history-day">
          <h3>${day.date}</h3>

          <div>
            ✔ ${day.stats.won} |
            ✖ ${day.stats.lost} |
            ⏳ ${day.stats.pending}
          </div>

          ${day.picks.map(p => `
            <div class="history-row">
              ${escapeHtml(p.match)} — ${escapeHtml(p.pick)}
              ${resultBadge(p.status)}
            </div>
          `).join("")}
        </div>
      `).join("")}
    </section>
  `;
}

/* ---------------- MAIN RENDER ---------------- */

function renderAll(data, history) {
  ALL_PICKS = data.picks || [];

  const leagues = [...new Set(ALL_PICKS.map(p => p.league))];

  const filtered = applyFilters(ALL_PICKS);

  app.innerHTML = `
    <h1>Top Picks</h1>

    ${renderFilters(leagues)}

    <div class="meta">
      Mostrando ${filtered.length} de ${ALL_PICKS.length}
    </div>

    <div class="grid">
      ${filtered.map(renderPickCard).join("")}
    </div>

    ${renderHistory(history)}
  `;

  document.getElementById("f-league").onchange = e => {
    CURRENT_FILTERS.league = e.target.value;
    renderAll(data, history);
  };

  document.getElementById("f-confidence").onchange = e => {
    CURRENT_FILTERS.confidence = e.target.value;
    renderAll(data, history);
  };

  document.getElementById("f-odds").onchange = e => {
    CURRENT_FILTERS.odds = e.target.value;
    renderAll(data, history);
  };
}

function resetFilters() {
  CURRENT_FILTERS = { league: "", confidence: "", odds: "" };
  load(true);
}

/* ---------------- LOAD ---------------- */

async function load(force = false) {
  try {
    const url = force
      ? `${BACKEND_URL}?force_refresh=true`
      : BACKEND_URL;

    const [data, history] = await Promise.all([
      fetch(url).then(r => r.json()),
      fetch(HISTORY_URL).then(r => r.json())
    ]);

    localStorage.setItem(CACHE_KEY, JSON.stringify({ data, history }));

    renderAll(data, history);

  } catch (e) {
    const cache = localStorage.getItem(CACHE_KEY);
    if (cache) {
      const parsed = JSON.parse(cache);
      renderAll(parsed.data, parsed.history);
      return;
    }

    app.innerHTML = "Error cargando";
  }
}

document.addEventListener("DOMContentLoaded", () => load(true));