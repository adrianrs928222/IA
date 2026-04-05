const BASE_URL = "https://funcional-s4vd.onrender.com";
const PICKS_URL = `${BASE_URL}/api/picks`;
const HISTORY_URL = `${BASE_URL}/api/history`;
const CACHE_KEY = "top-picks-pro-cache-v4";

const app = document.getElementById("app");

let ALL_PICKS = [];
let CURRENT_DATA = {};
let CURRENT_HISTORY = { days: [] };

let FILTERS = {
  league: "",
  confidence: "",
  type: ""
};

/* =========================================================
   HELPERS
========================================================= */

function esc(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function n(v, fallback = 0) {
  const x = Number(v);
  return Number.isFinite(x) ? x : fallback;
}

function arr(v) {
  return Array.isArray(v) ? v : [];
}

function obj(v) {
  return v && typeof v === "object" ? v : {};
}

function saveCache(data, history) {
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        ts: Date.now(),
        data,
        history
      })
    );
  } catch (_) {}
}

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

function normalizeData(data) {
  const d = obj(data);
  d.picks = arr(d.picks);
  d.combo_of_day = obj(d.combo_of_day);
  return d;
}

function normalizeHistory(history) {
  const h = obj(history);
  h.days = arr(h.days);
  return h;
}

/* =========================================================
   BADGES / LABELS
========================================================= */

function confidenceBadge(conf) {
  const value = n(conf);

  if (value >= 84) return `<span class="b green">TOP</span>`;
  if (value >= 76) return `<span class="b yellow">MEDIA</span>`;
  return `<span class="b red">RISK</span>`;
}

function resultBadge(status) {
  if (status === "won") return `<span class="r win">✔</span>`;
  if (status === "lost") return `<span class="r lost">✖</span>`;
  return `<span class="r pend">⏳</span>`;
}

function typeBadge(type) {
  if (type === "winner") return `<span class="t">Ganador</span>`;
  if (type === "btts_yes") return `<span class="t">BTTS</span>`;
  if (type === "over_2_5") return `<span class="t">+2.5</span>`;
  return `<span class="t">Pick</span>`;
}

function oddsBandBadge(band) {
  if (band === "normal") return `<span class="t">Cuota normal</span>`;
  if (band === "media") return `<span class="t">Cuota media</span>`;
  if (band === "alta") return `<span class="t">Cuota alta</span>`;
  return "";
}

function readablePickType(type) {
  if (type === "winner") return "Ganador";
  if (type === "btts_yes") return "Ambos marcan";
  if (type === "over_2_5") return "Más de 2.5 goles";
  return "Pick";
}

/* =========================================================
   FILTER / SORT
========================================================= */

function sortPicks(picks) {
  return [...picks].sort((a, b) => {
    const byConfidence = n(b.confidence) - n(a.confidence);
    if (byConfidence !== 0) return byConfidence;

    const byOdds = n(b.odds_estimate) - n(a.odds_estimate);
    if (byOdds !== 0) return byOdds;

    return String(a.match || "").localeCompare(String(b.match || ""));
  });
}

function applyFilters(picks) {
  return picks.filter((p) => {
    if (FILTERS.league && p.league !== FILTERS.league) return false;
    if (FILTERS.confidence === "high" && n(p.confidence) < 84) return false;
    if (FILTERS.confidence === "mid" && n(p.confidence) < 76) return false;
    if (FILTERS.type && p.pick_type !== FILTERS.type) return false;
    return true;
  });
}

/* =========================================================
   UI BLOCKS
========================================================= */

function renderFilters(leagues) {
  return `
    <div class="filters">
      <select id="f-league">
        <option value="">Todas las ligas</option>
        ${leagues.map(l => `
          <option value="${esc(l)}" ${FILTERS.league === l ? "selected" : ""}>
            ${esc(l)}
          </option>
        `).join("")}
      </select>

      <select id="f-confidence">
        <option value="">Confianza</option>
        <option value="high" ${FILTERS.confidence === "high" ? "selected" : ""}>Alta</option>
        <option value="mid" ${FILTERS.confidence === "mid" ? "selected" : ""}>Media+</option>
      </select>

      <select id="f-type">
        <option value="">Mercado</option>
        <option value="winner" ${FILTERS.type === "winner" ? "selected" : ""}>Ganador</option>
        <option value="btts_yes" ${FILTERS.type === "btts_yes" ? "selected" : ""}>BTTS</option>
        <option value="over_2_5" ${FILTERS.type === "over_2_5" ? "selected" : ""}>+2.5</option>
      </select>

      <button id="btn-refresh">Refresh</button>
    </div>
  `;
}

function renderMeta(data, filteredCount, totalCount) {
  return `
    <div class="meta">
      Mostrando ${filteredCount} de ${totalCount}
      ${data.generated_at ? ` · Actualizado: ${esc(data.generated_at)}` : ""}
      ${data.cache_day ? ` · Día: ${esc(data.cache_day)}` : ""}
      ${data.lookahead_hours ? ` · Ventana: ${esc(data.lookahead_hours)}h` : ""}
    </div>
  `;
}

function renderSummaryRow(label, value) {
  return `
    <div class="stats">
      <span><strong>${esc(label)}:</strong> ${esc(value)}</span>
    </div>
  `;
}

/* =========================================================
   COMBO OF DAY
========================================================= */

function renderComboPick(p) {
  return `
    <div class="history-row">
      <div class="history-row-left">
        <strong>${esc(p.match || "")}</strong>
        <span>${esc(p.pick || readablePickType(p.pick_type))}</span>
        <small>${esc(p.league || "")} · Confianza ${esc(p.confidence)} · Cuota est. ${esc(p.odds_estimate)}</small>
      </div>
      <div class="history-row-right">
        ${oddsBandBadge(p.odds_band)}
      </div>
    </div>
  `;
}

function renderCombo(combo) {
  const c = obj(combo);
  const picks = arr(c.picks);

  if (!picks.length) return "";

  return `
    <section class="history">
      <h2>Combi del día</h2>

      <div class="day">
        <div class="day-stats">
          <span>Picks: ${esc(c.size)}</span>
          <span>Cuota est.: ${esc(c.estimated_total_odds)}</span>
          <span>Confianza: ${esc(c.confidence)}</span>
        </div>

        <div class="history-list">
          ${picks.map(renderComboPick).join("")}
        </div>
      </div>
    </section>
  `;
}

/* =========================================================
   PICK CARD
========================================================= */

function renderCardsBlock(cards, homeTeam, awayTeam) {
  const c = obj(cards);
  const homeCards = c[homeTeam];
  const awayCards = c[awayTeam];

  if (homeCards == null && awayCards == null) return "";

  return `
    <div class="stats">
      <span>🟨 ${esc(homeTeam)}: ${esc(homeCards ?? "-")}</span>
      <span>🟨 ${esc(awayTeam)}: ${esc(awayCards ?? "-")}</span>
    </div>
  `;
}

function renderPickCard(p) {
  return `
    <article class="card">
      <div class="top">
        <div>
          <div class="league">${esc(p.league || "")}</div>
          <h2>${esc(p.match || "")}</h2>
        </div>
        <div>${esc(p.time_local || "-")}</div>
      </div>

      <div class="tags">
        ${typeBadge(p.pick_type)}
        ${confidenceBadge(p.confidence)}
        ${oddsBandBadge(p.odds_band)}
        ${resultBadge(p.status)}
      </div>

      <div class="pick">${esc(p.pick || "")}</div>

      ${renderSummaryRow("Ganador", p.pick_winner || "-")}
      ${renderSummaryRow("BTTS", p.btts || "-")}
      ${renderSummaryRow("Over 2.5", p.over_2_5 || "-")}
      ${renderSummaryRow("Cuota estimada", p.odds_estimate || "-")}
      ${renderCardsBlock(p.cards, p.home_team, p.away_team)}

      ${p.score_line ? `<div class="score">Resultado: ${esc(p.score_line)}</div>` : ""}

      <p class="tip">${esc(p.tipster_explanation || "")}</p>
    </article>
  `;
}

/* =========================================================
   HISTORY PRO
========================================================= */

function renderHistoryRow(p) {
  const pickText = p.pick || readablePickType(p.pick_type);

  return `
    <div class="history-row">
      <div class="history-row-left">
        <strong>${esc(p.match || "")}</strong>
        <span>${esc(pickText)}</span>
        <small>
          ${esc(p.league || "")}
          ${p.score_line ? ` · Marcador: ${esc(p.score_line)}` : ""}
          ${p.odds_estimate ? ` · Cuota est.: ${esc(p.odds_estimate)}` : ""}
        </small>
      </div>

      <div class="history-row-right">
        ${resultBadge(p.status)}
      </div>
    </div>
  `;
}

function renderHistoryDay(day) {
  const stats = obj(day.stats);
  const picks = arr(day.picks);

  return `
    <div class="day">
      <h3>${esc(day.date || "")}</h3>

      <div class="day-stats">
        <span>✔ ${n(stats.won)}</span>
        <span>✖ ${n(stats.lost)}</span>
        <span>⏳ ${n(stats.pending)}</span>
      </div>

      <div class="history-list">
        ${picks.length
          ? picks.map(renderHistoryRow).join("")
          : `<div class="empty-state">Sin picks en este día.</div>`
        }
      </div>
    </div>
  `;
}

function renderHistory(history) {
  const days = arr(history.days);

  return `
    <section class="history">
      <h2>Historial</h2>

      ${days.length
        ? days.map(renderHistoryDay).join("")
        : `<div class="empty-state">Todavía no hay historial.</div>`
      }
    </section>
  `;
}

/* =========================================================
   MAIN RENDER
========================================================= */

function renderAll(rawData, rawHistory) {
  const data = normalizeData(rawData);
  const history = normalizeHistory(rawHistory);

  CURRENT_DATA = data;
  CURRENT_HISTORY = history;

  ALL_PICKS = sortPicks(data.picks);

  const leagues = [...new Set(ALL_PICKS.map(p => p.league).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));

  const filtered = applyFilters(ALL_PICKS);

  app.innerHTML = `
    ${renderFilters(leagues)}
    ${renderMeta(data, filtered.length, ALL_PICKS.length)}
    ${renderCombo(data.combo_of_day)}

    <div class="grid">
      ${filtered.length
        ? filtered.map(renderPickCard).join("")
        : `<div class="empty-state">No hay picks con esos filtros.</div>`
      }
    </div>

    ${renderHistory(history)}
  `;

  bindEvents();
}

/* =========================================================
   EVENTS
========================================================= */

function resetFilters() {
  FILTERS = {
    league: "",
    confidence: "",
    type: ""
  };
}

function bindEvents() {
  const leagueEl = document.getElementById("f-league");
  const confidenceEl = document.getElementById("f-confidence");
  const typeEl = document.getElementById("f-type");
  const refreshBtn = document.getElementById("btn-refresh");

  if (leagueEl) {
    leagueEl.onchange = (e) => {
      FILTERS.league = e.target.value;
      renderAll(CURRENT_DATA, CURRENT_HISTORY);
    };
  }

  if (confidenceEl) {
    confidenceEl.onchange = (e) => {
      FILTERS.confidence = e.target.value;
      renderAll(CURRENT_DATA, CURRENT_HISTORY);
    };
  }

  if (typeEl) {
    typeEl.onchange = (e) => {
      FILTERS.type = e.target.value;
      renderAll(CURRENT_DATA, CURRENT_HISTORY);
    };
  }

  if (refreshBtn) {
    refreshBtn.onclick = () => {
      resetFilters();
      load(true);
    };
  }
}

/* =========================================================
   LOAD
========================================================= */

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function renderLoading() {
  app.innerHTML = `<div class="loading">Cargando picks...</div>`;
}

function renderError() {
  app.innerHTML = `<div class="error-box">Error cargando datos.</div>`;
}

async function load(force = false) {
  renderLoading();

  try {
    const picksUrl = force ? `${PICKS_URL}?force_refresh=true` : PICKS_URL;

    const [data, history] = await Promise.all([
      fetchJson(picksUrl),
      fetchJson(HISTORY_URL).catch(() => ({ days: [] }))
    ]);

    saveCache(data, history);
    renderAll(data, history);
  } catch (_) {
    const cache = readCache();

    if (cache?.data) {
      renderAll(cache.data, cache.history || { days: [] });
      return;
    }

    renderError();
  }
}

document.addEventListener("DOMContentLoaded", () => {
  load(true);
});