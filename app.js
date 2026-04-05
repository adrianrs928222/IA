const BASE_URL = "https://funcional-s4vd.onrender.com";
const BACKEND_URL = `${BASE_URL}/api/picks`;
const HISTORY_URL = `${BASE_URL}/api/history`;
const CACHE_KEY = "top-picks-cache-v30";

const app = document.getElementById("app");

let ALL_PICKS = [];
let CURRENT_FILTERS = {
  league: "",
  confidence: "",
  odds: "",
  type: ""
};

/* =========================================================
   HELPERS
========================================================= */

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeObject(value) {
  return value && typeof value === "object" ? value : {};
}

/* =========================================================
   BADGES
========================================================= */

function confidenceBadge(conf) {
  const n = safeNum(conf);

  if (n >= 78) return `<span class="badge badge-green">ALTA</span>`;
  if (n >= 68) return `<span class="badge badge-yellow">MEDIA</span>`;
  return `<span class="badge badge-red">BAJA</span>`;
}

function resultBadge(status) {
  if (status === "won") return `<span class="result-pill result-won">✔</span>`;
  if (status === "lost") return `<span class="result-pill result-lost">✖</span>`;
  return `<span class="result-pill result-pending">⏳</span>`;
}

function pickTypeBadge(type) {
  if (type === "winner") return `<span class="type-pill">Ganador</span>`;
  if (type === "btts_yes" || type === "btts") return `<span class="type-pill">BTTS</span>`;
  if (type === "over_2_5") return `<span class="type-pill">+2.5</span>`;
  return `<span class="type-pill">Pick</span>`;
}

/* =========================================================
   FORMAT
========================================================= */

function formatOdds(odds) {
  const n = safeNum(odds, null);
  if (n === null) return "-";
  return n.toFixed(2);
}

function oddsBucket(odds) {
  const n = safeNum(odds);

  if (n < 1.5) return "low";
  if (n <= 2.0) return "mid";
  return "high";
}

function readablePickType(type) {
  if (type === "winner") return "Ganador";
  if (type === "btts_yes" || type === "btts") return "Ambos marcan";
  if (type === "over_2_5") return "Más de 2.5 goles";
  return "Pick";
}

/* =========================================================
   CACHE
========================================================= */

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

function getCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

/* =========================================================
   FETCH
========================================================= */

async function fetchJson(url) {
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }

  return res.json();
}

/* =========================================================
   NORMALIZE
========================================================= */

function normalizeData(data) {
  const obj = normalizeObject(data);
  obj.picks = normalizeArray(obj.picks);
  return obj;
}

function normalizeHistory(history) {
  const obj = normalizeObject(history);
  obj.days = normalizeArray(obj.days);
  return obj;
}

/* =========================================================
   SORT / FILTER
========================================================= */

function sortPicks(picks) {
  return [...picks].sort((a, b) => {
    const confDiff = safeNum(b.confidence) - safeNum(a.confidence);
    if (confDiff !== 0) return confDiff;

    const oddsDiff = Math.abs(1.75 - safeNum(a.odds)) - Math.abs(1.75 - safeNum(b.odds));
    if (oddsDiff !== 0) return oddsDiff;

    return String(a.league || "").localeCompare(String(b.league || ""));
  });
}

function applyFilters(picks) {
  return picks.filter((p) => {
    if (CURRENT_FILTERS.league && p.league !== CURRENT_FILTERS.league) {
      return false;
    }

    if (CURRENT_FILTERS.confidence === "high" && safeNum(p.confidence) < 78) {
      return false;
    }

    if (CURRENT_FILTERS.confidence === "mid" && safeNum(p.confidence) < 68) {
      return false;
    }

    if (CURRENT_FILTERS.odds && oddsBucket(p.odds) !== CURRENT_FILTERS.odds) {
      return false;
    }

    if (CURRENT_FILTERS.type && p.pick_type !== CURRENT_FILTERS.type) {
      return false;
    }

    return true;
  });
}

/* =========================================================
   FILTERS UI
========================================================= */

function renderFilters(leagues) {
  return `
    <div class="filters">
      <select id="f-league">
        <option value="">Todas ligas</option>
        ${leagues.map(l => `
          <option value="${escapeHtml(l)}" ${CURRENT_FILTERS.league === l ? "selected" : ""}>
            ${escapeHtml(l)}
          </option>
        `).join("")}
      </select>

      <select id="f-confidence">
        <option value="">Confianza</option>
        <option value="high" ${CURRENT_FILTERS.confidence === "high" ? "selected" : ""}>Alta</option>
        <option value="mid" ${CURRENT_FILTERS.confidence === "mid" ? "selected" : ""}>Media+</option>
      </select>

      <select id="f-odds">
        <option value="">Cuotas</option>
        <option value="low" ${CURRENT_FILTERS.odds === "low" ? "selected" : ""}>&lt;1.5</option>
        <option value="mid" ${CURRENT_FILTERS.odds === "mid" ? "selected" : ""}>1.5 - 2.0</option>
        <option value="high" ${CURRENT_FILTERS.odds === "high" ? "selected" : ""}>&gt;2.0</option>
      </select>

      <select id="f-type">
        <option value="">Mercado</option>
        <option value="winner" ${CURRENT_FILTERS.type === "winner" ? "selected" : ""}>Ganador</option>
        <option value="btts_yes" ${CURRENT_FILTERS.type === "btts_yes" ? "selected" : ""}>Ambos marcan</option>
        <option value="over_2_5" ${CURRENT_FILTERS.type === "over_2_5" ? "selected" : ""}>Más de 2.5 goles</option>
      </select>

      <button id="btn-refresh">Refresh</button>
      <button id="btn-reset">Reset</button>
    </div>
  `;
}

/* =========================================================
   META
========================================================= */

function renderMetaBox(data, filteredCount, totalCount) {
  return `
    <div class="meta meta-box">
      <div><strong>Mostrando:</strong> ${filteredCount} de ${totalCount}</div>
      <div><strong>Generado:</strong> ${escapeHtml(data.generated_at || "-")}</div>
      <div><strong>Día cache:</strong> ${escapeHtml(data.cache_day || "-")}</div>
    </div>
  `;
}

/* =========================================================
   EXTRA INFO
========================================================= */

function renderMarketSnapshot(snapshot) {
  const s = normalizeObject(snapshot);

  const rows = [];

  if (s.home_odds != null) rows.push(`<span>1: ${escapeHtml(formatOdds(s.home_odds))}</span>`);
  if (s.draw_odds != null) rows.push(`<span>X: ${escapeHtml(formatOdds(s.draw_odds))}</span>`);
  if (s.away_odds != null) rows.push(`<span>2: ${escapeHtml(formatOdds(s.away_odds))}</span>`);
  if (s.btts_yes != null) rows.push(`<span>BTTS: ${escapeHtml(formatOdds(s.btts_yes))}</span>`);
  if (s.over_2_5 != null) rows.push(`<span>+2.5: ${escapeHtml(formatOdds(s.over_2_5))}</span>`);

  if (!rows.length) return "";

  return `
    <div class="market-snapshot">
      ${rows.join("")}
    </div>
  `;
}

/* =========================================================
   PICK CARD
========================================================= */

function renderPickCard(p) {
  const scoreLine = p.score_line
    ? `<div class="score">Resultado: ${escapeHtml(p.score_line)}</div>`
    : "";

  const explanation = p.tipster_explanation
    ? `<p class="tip">${escapeHtml(p.tipster_explanation)}</p>`
    : "";

  return `
    <article class="pick-card">
      <div class="pick-top">
        <div>
          <div class="competition">${escapeHtml(p.league || "")}</div>
          <h2>${escapeHtml(p.match || "")}</h2>
        </div>
        <div class="kickoff">${escapeHtml(p.time_local || "-")}</div>
      </div>

      <div class="pick-tags">
        ${pickTypeBadge(p.pick_type)}
        ${confidenceBadge(p.confidence)}
        ${resultBadge(p.status)}
      </div>

      <div class="pick-main">
        <strong>${escapeHtml(p.pick || "")}</strong>
      </div>

      <div class="stats">
        <span>💰 ${escapeHtml(formatOdds(p.odds))}</span>
        <span>📊 ${escapeHtml(String(p.confidence ?? "-"))}</span>
        <span>🏪 ${escapeHtml(p.bookmaker || "N/A")}</span>
      </div>

      ${renderMarketSnapshot(p.market_snapshot)}
      ${scoreLine}
      ${explanation}
    </article>
  `;
}

/* =========================================================
   HISTORY
========================================================= */

function renderHistory(history) {
  if (!history.days.length) {
    return `
      <section class="history-section">
        <h2>Historial</h2>
        <div class="history-empty">Sin historial todavía.</div>
      </section>
    `;
  }

  return `
    <section class="history-section">
      <h2>Historial</h2>

      ${history.days.map(day => `
        <div class="history-day">
          <h3>${escapeHtml(day.date || "")}</h3>

          <div class="history-stats">
            ✔ ${safeNum(day.stats?.won)} |
            ✖ ${safeNum(day.stats?.lost)} |
            ⏳ ${safeNum(day.stats?.pending)}
          </div>

          <div class="history-list">
            ${normalizeArray(day.picks).map(p => `
              <div class="history-row">
                <div class="history-left">
                  <strong>${escapeHtml(p.match || "")}</strong>
                  <span>${escapeHtml(p.pick || readablePickType(p.pick_type))}</span>
                  ${p.score_line ? `<small>(${escapeHtml(p.score_line)})</small>` : ""}
                </div>
                <div class="history-right">
                  ${resultBadge(p.status)}
                </div>
              </div>
            `).join("")}
          </div>
        </div>
      `).join("")}
    </section>
  `;
}

/* =========================================================
   EMPTY / ERROR / LOADING
========================================================= */

function renderLoading() {
  app.innerHTML = `<div class="loading">Cargando picks...</div>`;
}

function renderError(msg = "Error cargando datos.") {
  app.innerHTML = `<div class="error-box">${escapeHtml(msg)}</div>`;
}

/* =========================================================
   BIND EVENTS
========================================================= */

function bindEvents(data, history) {
  const leagueEl = document.getElementById("f-league");
  const confidenceEl = document.getElementById("f-confidence");
  const oddsEl = document.getElementById("f-odds");
  const typeEl = document.getElementById("f-type");
  const refreshBtn = document.getElementById("btn-refresh");
  const resetBtn = document.getElementById("btn-reset");

  if (leagueEl) {
    leagueEl.onchange = (e) => {
      CURRENT_FILTERS.league = e.target.value;
      renderAll(data, history);
    };
  }

  if (confidenceEl) {
    confidenceEl.onchange = (e) => {
      CURRENT_FILTERS.confidence = e.target.value;
      renderAll(data, history);
    };
  }

  if (oddsEl) {
    oddsEl.onchange = (e) => {
      CURRENT_FILTERS.odds = e.target.value;
      renderAll(data, history);
    };
  }

  if (typeEl) {
    typeEl.onchange = (e) => {
      CURRENT_FILTERS.type = e.target.value;
      renderAll(data, history);
    };
  }

  if (refreshBtn) {
    refreshBtn.onclick = () => {
      load(true);
    };
  }

  if (resetBtn) {
    resetBtn.onclick = () => {
      resetFilters();
    };
  }
}

/* =========================================================
   MAIN RENDER
========================================================= */

function renderAll(rawData, rawHistory) {
  const data = normalizeData(rawData);
  const history = normalizeHistory(rawHistory);

  ALL_PICKS = sortPicks(data.picks);

  const leagues = [...new Set(
    ALL_PICKS
      .map(p => p.league)
      .filter(Boolean)
  )].sort((a, b) => a.localeCompare(b));

  const filtered = applyFilters(ALL_PICKS);

  app.innerHTML = `
    <h1>Top Picks</h1>

    ${renderFilters(leagues)}
    ${renderMetaBox(data, filtered.length, ALL_PICKS.length)}

    <div class="grid">
      ${
        filtered.length
          ? filtered.map(renderPickCard).join("")
          : `<div class="empty-state">No hay picks con esos filtros.</div>`
      }
    </div>

    ${renderHistory(history)}
  `;

  bindEvents(data, history);
}

/* =========================================================
   RESET
========================================================= */

function resetFilters() {
  CURRENT_FILTERS = {
    league: "",
    confidence: "",
    odds: "",
    type: ""
  };
  load(false);
}

/* =========================================================
   LOAD
========================================================= */

async function load(force = false) {
  renderLoading();

  try {
    const url = force
      ? `${BACKEND_URL}?force_refresh=true`
      : BACKEND_URL;

    const [data, history] = await Promise.all([
      fetchJson(url),
      fetchJson(HISTORY_URL)
    ]);

    saveCache(data, history);
    renderAll(data, history);
  } catch (err) {
    const cache = getCache();

    if (cache?.data) {
      renderAll(cache.data, cache.history || { days: [] });
      return;
    }

    renderError("Error cargando picks e historial.");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  load(true);
});