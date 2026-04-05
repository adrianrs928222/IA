const BASE_URL = "https://funcional-s4vd.onrender.com";
const PICKS_URL = `${BASE_URL}/api/picks`;
const HISTORY_URL = `${BASE_URL}/api/history`;
const CACHE_KEY = "top-picks-pro-cache-v2";

const app = document.getElementById("app");

let ALL_PICKS = [];
let FILTERS = {
  league: "",
  confidence: "",
  type: ""
};

/* =========================
   HELPERS
========================= */

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
  return d;
}

function normalizeHistory(history) {
  const h = obj(history);
  h.days = arr(h.days);
  return h;
}

/* =========================
   BADGES
========================= */

function confidenceBadge(conf) {
  const value = n(conf);

  if (value >= 80) return `<span class="b green">ALTA</span>`;
  if (value >= 70) return `<span class="b yellow">MEDIA</span>`;
  return `<span class="b red">BAJA</span>`;
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

function readablePickType(type) {
  if (type === "winner") return "Ganador";
  if (type === "btts_yes") return "Ambos marcan";
  if (type === "over_2_5") return "Más de 2.5 goles";
  return "Pick";
}

/* =========================
   SORT / FILTER
========================= */

function sortPicks(picks) {
  return [...picks].sort((a, b) => {
    const byConfidence = n(b.confidence) - n(a.confidence);
    if (byConfidence !== 0) return byConfidence;

    const byLeague = String(a.league || "").localeCompare(String(b.league || ""));
    if (byLeague !== 0) return byLeague;

    return String(a.match || "").localeCompare(String(b.match || ""));
  });
}

function applyFilters(picks) {
  return picks.filter((p) => {
    if (FILTERS.league && p.league !== FILTERS.league) return false;
    if (FILTERS.confidence === "high" && n(p.confidence) < 80) return false;
    if (FILTERS.confidence === "mid" && n(p.confidence) < 70) return false;
    if (FILTERS.type && p.pick_type !== FILTERS.type) return false;
    return true;
  });
}

/* =========================
   UI PIECES
========================= */

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
    </div>
  `;
}

function renderMarketSnapshot(snapshot) {
  const s = obj(snapshot);
  const items = [];

  if (s.home_odds != null) items.push(`<span>1: ${esc(s.home_odds)}</span>`);
  if (s.draw_odds != null) items.push(`<span>X: ${esc(s.draw_odds)}</span>`);
  if (s.away_odds != null) items.push(`<span>2: ${esc(s.away_odds)}</span>`);
  if (s.btts_yes != null) items.push(`<span>BTTS: ${esc(s.btts_yes)}</span>`);
  if (s.over_2_5 != null) items.push(`<span>+2.5: ${esc(s.over_2_5)}</span>`);

  if (!items.length) return "";

  return `<div class="stats">${items.join(" ")}</div>`;
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
        ${resultBadge(p.status)}
      </div>

      <div class="pick">${esc(p.pick || "")}</div>

      ${renderMarketSnapshot(p.market_snapshot)}

      ${p.score_line ? `<div class="score">Resultado: ${esc(p.score_line)}</div>` : ""}

      <p class="tip">${esc(p.tipster_explanation || "")}</p>
    </article>
  `;
}

/* =========================
   HISTORIAL PRO
========================= */

function renderHistoryRow(p) {
  const market = p.pick || readablePickType(p.pick_type);

  return `
    <div class="history-row">
      <div class="history-row-left">
        <strong>${esc(p.match || "")}</strong>
        <span>${esc(market)}</span>
        ${p.score_line ? `<small>Marcador: ${esc(p.score_line)}</small>` : ""}
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

/* =========================
   MAIN RENDER
========================= */

function renderAll(rawData, rawHistory) {
  const data = normalizeData(rawData);
  const history = normalizeHistory(rawHistory);

  ALL_PICKS = sortPicks(data.picks);
  const leagues = [...new Set(ALL_PICKS.map(p => p.league).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));

  const filtered = applyFilters(ALL_PICKS);

  app.innerHTML = `
    ${renderFilters(leagues)}
    ${renderMeta(data, filtered.length, ALL_PICKS.length)}

    <div class="grid">
      ${filtered.length
        ? filtered.map(renderPickCard).join("")
        : `<div class="empty-state">No hay picks con esos filtros.</div>`
      }
    </div>

    ${renderHistory(history)}
  `;

  bindEvents(data, history);
}

/* =========================
   EVENTS
========================= */

function resetFilters() {
  FILTERS = {
    league: "",
    confidence: "",
    type: ""
  };
}

function bindEvents(data, history) {
  const leagueEl = document.getElementById("f-league");
  const confidenceEl = document.getElementById("f-confidence");
  const typeEl = document.getElementById("f-type");
  const refreshBtn = document.getElementById("btn-refresh");

  if (leagueEl) {
    leagueEl.onchange = (e) => {
      FILTERS.league = e.target.value;
      renderAll(data, history);
    };
  }

  if (confidenceEl) {
    confidenceEl.onchange = (e) => {
      FILTERS.confidence = e.target.value;
      renderAll(data, history);
    };
  }

  if (typeEl) {
    typeEl.onchange = (e) => {
      FILTERS.type = e.target.value;
      renderAll(data, history);
    };
  }

  if (refreshBtn) {
    refreshBtn.onclick = () => {
      resetFilters();
      load(true);
    };
  }
}

/* =========================
   LOAD
========================= */

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