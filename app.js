const API_URL = "https://funcional-s4vd.onrender.com";

const state = {
  picks: [],
  combo: null,
  groups: { alta: [], media: [], intermedia: [] },
  stats: {
    hits: "0/0",
    effectiveness: 0,
    profit: 0,
    total_picks: 0,
    pending: 0,
  },
  history: {
    items: [],
    page: 1,
    total_pages: 1,
    total_items: 0,
  },
  leagueFilter: "all",
  riskFilter: "all",
  loading: false,
};

// ==============================
// HELPERS
// ==============================

function safe(v, fallback = "-") {
  return v === null || v === undefined || v === "" ? fallback : v;
}

function formatOdds(v) {
  if (v === null || v === undefined || v === "") return "-";
  const n = Number(v);
  if (Number.isNaN(n)) return "-";
  return n.toFixed(2);
}

function formatProfit(v) {
  const n = Number(v || 0);
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}u`;
}

function pickTypeLabel(type) {
  switch (type) {
    case "winner":
      return "Ganador";
    case "double_chance":
      return "Doble oportunidad";
    case "over_2_5":
      return "+2.5 goles";
    case "under_2_5":
      return "-2.5 goles";
    case "under_3_5":
      return "-3.5 goles";
    case "btts_yes":
      return "BTTS Sí";
    case "btts_no":
      return "BTTS No";
    case "team_cards":
      return "Tarjetas";
    default:
      return "Pick";
  }
}

function confidenceLabel(confidence) {
  if (confidence >= 80) return "Confianza alta";
  if (confidence >= 72) return "Confianza media";
  return "Confianza intermedia";
}

function confidenceClass(confidence) {
  if (confidence >= 80) return "alta";
  if (confidence >= 72) return "media";
  return "intermedia";
}

function statusLabel(status) {
  if (status === "won") return "Acertado";
  if (status === "lost") return "Perdido";
  return "Pendiente";
}

function statusClass(status) {
  if (status === "won") return "won";
  if (status === "lost") return "lost";
  return "pending";
}

function riskAllowed(pick) {
  if (state.riskFilter === "all") return true;
  if (state.riskFilter === "safe") return pick.confidence >= 78;
  if (state.riskFilter === "medium") return pick.confidence >= 72 && pick.confidence < 78;
  if (state.riskFilter === "aggressive") return pick.confidence < 72;
  return true;
}

function leagueAllowed(pick) {
  if (state.leagueFilter === "all") return true;
  return pick.league === state.leagueFilter;
}

function filterPicks(picks) {
  return (picks || []).filter((p) => leagueAllowed(p) && riskAllowed(p));
}

// ==============================
// FETCH
// ==============================

async function fetchJSON(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return await res.json();
}

async function fetchPicks(forceRefresh = true) {
  const url = forceRefresh
    ? `${API_URL}/api/picks?force_refresh=true`
    : `${API_URL}/api/picks`;

  return fetchJSON(url);
}

async function fetchHistory(page = 1) {
  return fetchJSON(`${API_URL}/api/history?page=${page}&page_size=12`);
}

async function loadAll(forceRefresh = true) {
  try {
    state.loading = true;
    renderLoading();

    const [picksData, historyData] = await Promise.all([
      fetchPicks(forceRefresh),
      fetchHistory(state.history.page || 1),
    ]);

    state.picks = picksData.picks || [];
    state.combo = picksData.combo_of_day || null;
    state.groups = picksData.groups || { alta: [], media: [], intermedia: [] };
    state.stats = picksData.dashboard_stats || {
      hits: "0/0",
      effectiveness: 0,
      profit: 0,
      total_picks: 0,
      pending: 0,
    };

    state.history = historyData || {
      items: [],
      page: 1,
      total_pages: 1,
      total_items: 0,
    };

    state.loading = false;
    renderAll();
  } catch (err) {
    console.error(err);
    state.loading = false;
    renderError("Error cargando datos");
  }
}

async function goHistoryPage(page) {
  try {
    const historyData = await fetchHistory(page);
    state.history = historyData;
    renderHistory();
  } catch (err) {
    console.error(err);
  }
}

// ==============================
// ROOT / STRUCTURE
// ==============================

function ensureLayout() {
  const app = document.getElementById("app");
  if (!app) return null;

  if (!document.getElementById("topbar")) {
    app.innerHTML = `
      <div class="page-wrap">
        <section class="topbar" id="topbar">
          <div class="brand">
            <div class="brand-logo">TP</div>
            <div>
              <div class="brand-kicker">TOP PICKS</div>
              <h1>Pro Premium</h1>
              <p>Picks inteligentes, confianza real y análisis tipster.</p>
            </div>
          </div>

          <div class="top-nav">
            <span>⚽ Fútbol</span>
            <span>🔥 Combi del día</span>
            <span>📜 Historial</span>
            <span>💎 Premium</span>
          </div>
        </section>

        <section class="hero-boxes">
          <div class="hero-box">
            <div class="hero-title">COBERTURA</div>
            <div class="hero-value">LaLiga · Segunda · Champions</div>
          </div>
          <div class="hero-box">
            <div class="hero-title">MODO</div>
            <div class="hero-value">Tipster Pro</div>
          </div>
          <div class="hero-box">
            <div class="hero-title">ACTUALIZACIÓN</div>
            <div class="hero-value">Automática</div>
          </div>
          <div class="hero-box">
            <div class="hero-title">CONFIANZA</div>
            <div class="hero-value">0%-100%</div>
          </div>
        </section>

        <section class="filters" id="filters"></section>

        <section class="meta-bar" id="metaBar"></section>

        <section class="section-block">
          <h2>Resumen</h2>
          <div class="stats-grid" id="stats"></div>
        </section>

        <section class="section-block">
          <div id="combo"></div>
        </section>

        <section class="section-block">
          <h2>Picks</h2>
          <div class="cards-grid" id="picks"></div>
        </section>

        <section class="section-block">
          <h2>Historial</h2>
          <div id="history"></div>
        </section>
      </div>
    `;
  }

  return app;
}

// ==============================
// RENDER GENERAL
// ==============================

function renderLoading() {
  ensureLayout();
  const picksEl = document.getElementById("picks");
  if (picksEl) {
    picksEl.innerHTML = `<div class="empty-box">Cargando picks...</div>`;
  }
}

function renderError(message) {
  ensureLayout();
  const picksEl = document.getElementById("picks");
  if (picksEl) {
    picksEl.innerHTML = `<div class="empty-box">${message}</div>`;
  }
}

function renderAll() {
  ensureLayout();
  renderFilters();
  renderMetaBar();
  renderStats();
  renderCombo();
  renderPicks();
  renderHistory();
}

// ==============================
// FILTERS
// ==============================

function renderFilters() {
  const el = document.getElementById("filters");
  if (!el) return;

  el.innerHTML = `
    <select id="leagueFilter">
      <option value="all">Todas las ligas</option>
      <option value="LaLiga">LaLiga</option>
      <option value="Segunda División">Segunda División</option>
      <option value="Champions League">Champions League</option>
    </select>

    <select id="riskFilter">
      <option value="all">Todos los riesgos</option>
      <option value="safe">Seguros</option>
      <option value="medium">Medios</option>
      <option value="aggressive">Agresivos</option>
    </select>

    <button id="refreshBtn">Refresh</button>
  `;

  const leagueSelect = document.getElementById("leagueFilter");
  const riskSelect = document.getElementById("riskFilter");
  const refreshBtn = document.getElementById("refreshBtn");

  leagueSelect.value = state.leagueFilter;
  riskSelect.value = state.riskFilter;

  leagueSelect.onchange = (e) => {
    state.leagueFilter = e.target.value;
    renderPicks();
  };

  riskSelect.onchange = (e) => {
    state.riskFilter = e.target.value;
    renderPicks();
  };

  refreshBtn.onclick = () => loadAll(true);
}

// ==============================
// META BAR
// ==============================

function renderMetaBar() {
  const el = document.getElementById("metaBar");
  if (!el) return;

  el.innerHTML = `
    ⚡ Picks: ${state.picks.length} · Actualizado automáticamente · Ventana: 168h
  `;
}

// ==============================
// STATS
// ==============================

function renderStats() {
  const el = document.getElementById("stats");
  if (!el) return;

  el.innerHTML = `
    <div class="stat-card">
      <div class="stat-label">ACIERTOS</div>
      <div class="stat-value">${safe(state.stats.hits, "0/0")}</div>
    </div>

    <div class="stat-card">
      <div class="stat-label">EFECTIVIDAD</div>
      <div class="stat-value">${safe(state.stats.effectiveness, 0)}%</div>
    </div>

    <div class="stat-card">
      <div class="stat-label">BENEFICIO</div>
      <div class="stat-value">${formatProfit(state.stats.profit)}</div>
    </div>

    <div class="stat-card">
      <div class="stat-label">PICKS</div>
      <div class="stat-value">${safe(state.stats.total_picks, 0)}</div>
    </div>
  `;
}

// ==============================
// COMBO
// ==============================

function comboItemHTML(p) {
  return `
    <div class="combo-item">
      <div class="combo-match">${safe(p.match)}</div>
      <div class="combo-pick">${safe(p.pick)}</div>
      <div class="combo-meta-line">
        <span>💰 ${formatOdds(p.odds_estimate)}</span>
        <span>🎯 ${safe(p.confidence, 0)}%</span>
        <span>🏷 ${pickTypeLabel(p.pick_type)}</span>
      </div>
    </div>
  `;
}

function renderCombo() {
  const el = document.getElementById("combo");
  if (!el) return;

  if (!state.combo || !state.combo.picks || !state.combo.picks.length) {
    el.innerHTML = `<div class="empty-box">No hay combinada disponible.</div>`;
    return;
  }

  el.innerHTML = `
    <div class="combo-box">
      <h2>🔥 Combi del día</h2>

      <div class="combo-summary">
        <span class="pill">Picks: ${safe(state.combo.size, state.combo.picks.length)}</span>
        <span class="pill">Cuota: ${formatOdds(state.combo.estimated_total_odds)}</span>
        <span class="pill">Confianza media: ${safe(state.combo.confidence, 0)}%</span>
      </div>

      <div class="combo-list">
        ${state.combo.picks.map(comboItemHTML).join("")}
      </div>
    </div>
  `;
}

// ==============================
// PICK CARD
// ==============================

function extraTagsHTML(p) {
  let html = "";

  if (p.btts) {
    html += `<span class="mini-pill">BTTS: ${p.btts}</span>`;
  }

  if (p.over_2_5) {
    html += `<span class="mini-pill">Over/Under: ${p.over_2_5}</span>`;
  }

  if (p.cards_team) {
    html += `<span class="mini-pill">Tarjetas: ${p.cards_team} +${p.cards_line}</span>`;
  }

  if (p.bookmaker) {
    html += `<span class="mini-pill">Casa: ${p.bookmaker}</span>`;
  }

  return html;
}

function valueBoxHTML(p) {
  if (
    p.model_confidence === null ||
    p.model_confidence === undefined ||
    p.book_confidence === null ||
    p.book_confidence === undefined ||
    p.value_edge === null ||
    p.value_edge === undefined
  ) {
    return "";
  }

  const edgeSign = Number(p.value_edge) > 0 ? "+" : "";

  return `
    <div class="value-box">
      <div>Nuestra confianza: ${p.model_confidence}%</div>
      <div>Confianza del mercado: ${p.book_confidence}%</div>
      <div>Ventaja: ${edgeSign}${p.value_edge}%</div>
    </div>
  `;
}

function pickCardHTML(p) {
  return `
    <div class="pick-card">
      <div class="pick-top">
        <div>
          <div class="pick-league">${safe(p.league)}</div>
          <div class="pick-match">${safe(p.match)}</div>
        </div>
        <div class="pick-time-box">
          <div>${safe(p.time_local)}</div>
        </div>
      </div>

      <div class="pick-badges">
        <span class="badge neutral">${pickTypeLabel(p.pick_type)}</span>
        <span class="badge ${confidenceClass(p.confidence)}">${confidenceLabel(p.confidence)}</span>
        <span class="badge ${statusClass(p.status)}">${statusLabel(p.status)}</span>
        <span class="badge percent">${safe(p.confidence, 0)}%</span>
      </div>

      <div class="pick-main">
        ${safe(p.pick)}
      </div>

      <div class="pick-meta">
        <span>💰 Cuota: ${formatOdds(p.odds_estimate)}</span>
        <span>🎯 Stake: ${safe(p.stake, 0)}/5</span>
      </div>

      <div class="pick-tags">
        ${extraTagsHTML(p)}
      </div>

      ${valueBoxHTML(p)}

      ${
        p.score_line
          ? `<div class="score-line">Marcador: ${p.score_line}</div>`
          : ""
      }

      <div class="pick-explanation">
        ${safe(p.tipster_explanation, "")}
      </div>
    </div>
  `;
}

function renderPicks() {
  const el = document.getElementById("picks");
  if (!el) return;

  const filtered = filterPicks(state.picks);

  if (!filtered.length) {
    el.innerHTML = `<div class="empty-box">No hay picks con esos filtros.</div>`;
    return;
  }

  el.innerHTML = filtered.map(pickCardHTML).join("");
}

// ==============================
// HISTORY
// ==============================

function historyCardHTML(p) {
  return `
    <div class="history-card">
      <div class="history-left">
        <div class="history-match">${safe(p.match)}</div>
        <div class="history-sub">${safe(p.pick)} · ${safe(p.league)} · ${safe(p.time_local)}</div>
        <div class="history-sub">
          Cuota: ${formatOdds(p.odds_estimate)} · Stake: ${safe(p.stake, 0)}/5 · ${safe(p.history_date)}
        </div>
        ${
          p.score_line
            ? `<div class="history-sub">Marcador: ${p.score_line}</div>`
            : ""
        }
      </div>
      <div class="history-right">
        <span class="badge ${statusClass(p.status)}">${statusLabel(p.status)}</span>
      </div>
    </div>
  `;
}

function renderHistoryPagination() {
  const totalPages = state.history.total_pages || 1;
  const current = state.history.page || 1;

  if (totalPages <= 1) return "";

  let buttons = "";

  const prevDisabled = current <= 1 ? "disabled" : "";
  const nextDisabled = current >= totalPages ? "disabled" : "";

  buttons += `<button ${prevDisabled} onclick="window.__goHistory(${current - 1})">←</button>`;

  for (let i = 1; i <= totalPages; i++) {
    if (i === current) {
      buttons += `<button class="active" onclick="window.__goHistory(${i})">${i}</button>`;
    } else {
      buttons += `<button onclick="window.__goHistory(${i})">${i}</button>`;
    }
  }

  buttons += `<button ${nextDisabled} onclick="window.__goHistory(${current + 1})">→</button>`;

  return `<div class="pagination">${buttons}</div>`;
}

function renderHistory() {
  const el = document.getElementById("history");
  if (!el) return;

  const items = state.history.items || [];

  if (!items.length) {
    el.innerHTML = `<div class="empty-box">No hay historial todavía.</div>`;
    return;
  }

  el.innerHTML = `
    <div class="history-list">
      ${items.map(historyCardHTML).join("")}
    </div>
    ${renderHistoryPagination()}
  `;
}

window.__goHistory = function (page) {
  if (page < 1 || page > (state.history.total_pages || 1)) return;
  state.history.page = page;
  goHistoryPage(page);
};

// ==============================
// INIT
// ==============================

document.addEventListener("DOMContentLoaded", () => {
  ensureLayout();
  loadAll(true);
});