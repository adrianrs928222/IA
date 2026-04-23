const API_BASE =
  window.location.hostname.includes("github.io")
    ? "https://funcional-s4vd.onrender.com"
    : window.location.origin;

const state = {
  loading: false,
  refreshing: false,
  payload: null,
  history: null,
  odds: null,
  historyPage: 1,
  historyPageSize: 12,
  selectedTab: "premium",
  selectedMatchIndex: 0,
};

document.addEventListener("DOMContentLoaded", () => {
  bindEvents();
  initApp();
});

function bindEvents() {
  const refreshBtn = document.getElementById("refreshBtn");
  const reloadHistoryBtn = document.getElementById("reloadHistoryBtn");
  const tabButtons = document.querySelectorAll("[data-tab]");

  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => {
      loadPicks(true);
    });
  }

  if (reloadHistoryBtn) {
    reloadHistoryBtn.addEventListener("click", () => {
      loadHistory(state.historyPage);
    });
  }

  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.tab || "premium";
      state.selectedTab = tab;
      updateTabButtons();
      renderMainSections();
    });
  });
}

async function initApp() {
  setStatus("Cargando picks y datos del panel...");
  await Promise.all([
    loadPicks(false),
    loadHistory(1),
    loadOdds(),
  ]);
  setStatus("Datos cargados");
}

async function apiGet(path) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }

  return res.json();
}

async function loadPicks(forceRefresh = false) {
  try {
    state.loading = !forceRefresh;
    state.refreshing = forceRefresh;

    renderLoadingState();

    const payload = await apiGet(`/api/picks?force_refresh=${forceRefresh ? "true" : "false"}`);
    state.payload = payload;

    if (!Array.isArray(state.payload?.match_catalog)) {
      state.payload.match_catalog = [];
    }

    if (state.selectedMatchIndex >= state.payload.match_catalog.length) {
      state.selectedMatchIndex = 0;
    }

    renderAll();
  } catch (error) {
    console.error("Error loading picks:", error);
    renderError("No se pudieron cargar los picks.");
  } finally {
    state.loading = false;
    state.refreshing = false;
    renderLoadingState();
  }
}

async function loadHistory(page = 1) {
  try {
    const payload = await apiGet(`/api/history?page=${page}&page_size=${state.historyPageSize}`);
    state.history = payload;
    state.historyPage = payload.page || 1;
    renderHistory();
  } catch (error) {
    console.error("Error loading history:", error);
    renderHistoryError("No se pudo cargar el historial.");
  }
}

async function loadOdds() {
  try {
    const payload = await apiGet(`/api/odds`);
    state.odds = payload;
    renderOddsInfo();
  } catch (error) {
    console.error("Error loading odds:", error);
    renderOddsInfoError();
  }
}

function renderAll() {
  updateTabButtons();
  renderHeaderStats();
  renderComboOfDay();
  renderMainSections();
  renderMatchCatalog();
  renderMetaInfo();
}
function renderLoadingState() {
  const loader = document.getElementById("loader");
  const refreshBtn = document.getElementById("refreshBtn");

  if (loader) {
    loader.style.display = state.loading || state.refreshing ? "flex" : "none";
    loader.textContent = state.refreshing
      ? "Actualizando picks reales..."
      : "Cargando picks...";
  }

  if (refreshBtn) {
    refreshBtn.disabled = state.loading || state.refreshing;
    refreshBtn.textContent = state.refreshing ? "Actualizando..." : "Actualizar";
  }
}

function renderError(message) {
  const main = document.getElementById("mainContent");
  if (!main) return;

  main.innerHTML = `
    <section class="panel error-panel">
      <h2>Error</h2>
      <p>${escapeHtml(message)}</p>
    </section>
  `;
}

function setStatus(message) {
  const el = document.getElementById("statusText");
  if (el) {
    el.textContent = message;
  }
}

function updateTabButtons() {
  const tabButtons = document.querySelectorAll("[data-tab]");
  tabButtons.forEach((btn) => {
    const isActive = btn.dataset.tab === state.selectedTab;
    btn.classList.toggle("active", isActive);
  });
}

function renderHeaderStats() {
  const payload = state.payload || {};
  const stats = payload.dashboard_stats || {};
  const groups = payload.groups || {};

  setText("statHits", stats.hits || "0/0");
  setText("statEffectiveness", formatPercent(stats.effectiveness));
  setText("statProfit", formatUnits(stats.profit));
  setText("statPending", String(stats.pending ?? 0));
  setText("statTotalPicks", String(stats.total_picks ?? payload.count ?? 0));

  setText("countPremium", String((groups.premium || []).length));
  setText("countStrong", String((groups.strong || []).length));
  setText("countMedium", String((groups.medium || []).length));
  setText("countRisky", String((groups.risky || []).length));
}

function renderComboOfDay() {
  const comboWrap = document.getElementById("comboOfDay");
  if (!comboWrap) return;

  const combo = state.payload?.combo_of_day || {};
  const picks = Array.isArray(combo.picks) ? combo.picks : [];

  if (!picks.length) {
    comboWrap.innerHTML = `
      <div class="panel">
        <h2>Combinada del día</h2>
        <p>No hay combinada suficiente hoy. El modelo ha preferido no forzar una combinación artificial.</p>
      </div>
    `;
    return;
  }

  comboWrap.innerHTML = `
    <div class="panel combo-panel">
      <div class="panel-head">
        <h2>Combinada del día</h2>
        <span class="badge">${escapeHtml(String(combo.size || picks.length))} selecciones</span>
      </div>

      <div class="combo-summary">
        <div class="metric-chip">
          <span class="metric-label">Cuota estimada</span>
          <strong>${combo.estimated_total_odds ? formatOdds(combo.estimated_total_odds) : "--"}</strong>
        </div>
        <div class="metric-chip">
          <span class="metric-label">Confianza media</span>
          <strong>${formatPercent(combo.confidence)}</strong>
        </div>
      </div>

      <div class="pick-list">
        ${picks.map(renderPickCard).join("")}
      </div>
    </div>
  `;
}

function renderMainSections() {
  const wrap = document.getElementById("mainContent");
  if (!wrap) return;

  const payload = state.payload || {};
  const groups = payload.groups || {};
  let picks = [];

  if (state.selectedTab === "premium") picks = groups.premium || [];
  if (state.selectedTab === "strong") picks = groups.strong || [];
  if (state.selectedTab === "medium") picks = groups.medium || [];
  if (state.selectedTab === "risky") picks = groups.risky || [];

  const titleMap = {
    premium: "Premium Picks",
    strong: "Strong Picks",
    medium: "Picks medios",
    risky: "Picks de riesgo",
  };

  wrap.innerHTML = `
    <section class="panel">
      <div class="panel-head">
        <h2>${titleMap[state.selectedTab] || "Picks"}</h2>
        <span class="badge">${picks.length}</span>
      </div>

      ${
        picks.length
          ? `<div class="pick-list">${picks.map(renderPickCard).join("")}</div>`
          : `<p>No hay picks en esta categoría ahora mismo.</p>`
      }
    </section>
  `;
}
function renderMatchCatalog() {
  const wrap = document.getElementById("matchCatalog");
  if (!wrap) return;

  const catalog = state.payload?.match_catalog || [];

  if (!catalog.length) {
    wrap.innerHTML = `
      <section class="panel">
        <h2>Catálogo de mercados</h2>
        <p>No hay partidos cargados ahora mismo.</p>
      </section>
    `;
    return;
  }

  const tabs = catalog
    .map((item, index) => {
      const active = index === state.selectedMatchIndex ? "active" : "";
      return `
        <button class="match-tab ${active}" data-match-index="${index}">
          <span>${escapeHtml(item.match || "Partido")}</span>
          <small>${escapeHtml(item.time_local || "--")}</small>
        </button>
      `;
    })
    .join("");

  const selected = catalog[state.selectedMatchIndex] || catalog[0];
  const markets = Array.isArray(selected?.markets) ? selected.markets : [];

  wrap.innerHTML = `
    <section class="panel">
      <div class="panel-head">
        <h2>Catálogo de mercados por partido</h2>
        <span class="badge">${catalog.length} partidos</span>
      </div>

      <div class="match-tabs">
        ${tabs}
      </div>

      <div class="match-detail">
        <div class="match-detail-head">
          <h3>${escapeHtml(selected.match || "Partido")}</h3>
          <div class="match-meta-inline">
            <span>${escapeHtml(selected.league || "--")}</span>
            <span>${escapeHtml(selected.time_local || "--")}</span>
            <span>${escapeHtml(selected.source || "--")}</span>
          </div>
        </div>

        <div class="market-grid">
          ${markets.map(renderMarketCard).join("")}
        </div>
      </div>
    </section>
  `;

  bindMatchTabEvents();
}

function bindMatchTabEvents() {
  document.querySelectorAll("[data-match-index]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const nextIndex = Number(btn.dataset.matchIndex || 0);
      state.selectedMatchIndex = nextIndex;
      renderMatchCatalog();
    });
  });
}

function renderHistory() {
  const wrap = document.getElementById("historySection");
  if (!wrap) return;

  const history = state.history || {};
  const items = Array.isArray(history.items) ? history.items : [];

  wrap.innerHTML = `
    <section class="panel">
      <div class="panel-head">
        <h2>Historial</h2>
        <span class="badge">${history.total_items || 0}</span>
      </div>

      ${
        items.length
          ? `
          <div class="history-list">
            ${items.map(renderHistoryCard).join("")}
          </div>

          <div class="pagination">
            <button id="prevHistoryPage" ${history.page <= 1 ? "disabled" : ""}>Anterior</button>
            <span>Página ${history.page || 1} / ${history.total_pages || 1}</span>
            <button id="nextHistoryPage" ${history.page >= history.total_pages ? "disabled" : ""}>Siguiente</button>
          </div>
        `
          : `<p>No hay historial todavía.</p>`
      }
    </section>
  `;

  const prevBtn = document.getElementById("prevHistoryPage");
  const nextBtn = document.getElementById("nextHistoryPage");

  if (prevBtn) {
    prevBtn.addEventListener("click", () => {
      if ((history.page || 1) > 1) {
        loadHistory((history.page || 1) - 1);
      }
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      if ((history.page || 1) < (history.total_pages || 1)) {
        loadHistory((history.page || 1) + 1);
      }
    });
  }
}

function renderHistoryError(message) {
  const wrap = document.getElementById("historySection");
  if (!wrap) return;

  wrap.innerHTML = `
    <section class="panel error-panel">
      <h2>Historial</h2>
      <p>${escapeHtml(message)}</p>
    </section>
  `;
}

function renderOddsInfo() {
  const el = document.getElementById("oddsInfo");
  if (!el) return;

  const count = state.odds?.count ?? 0;
  el.innerHTML = `<span>Mercados de cuotas indexados: <strong>${count}</strong></span>`;
}

function renderOddsInfoError() {
  const el = document.getElementById("oddsInfo");
  if (!el) return;
  el.innerHTML = `<span>Mercados de cuotas indexados: <strong>0</strong></span>`;
}

function renderMetaInfo() {
  const el = document.getElementById("metaInfo");
  if (!el) return;

  const payload = state.payload || {};
  el.innerHTML = `
    <div class="meta-grid">
      <div><span>Generado:</span> <strong>${formatDateTime(payload.generated_at)}</strong></div>
      <div><span>Lookahead:</span> <strong>${payload.lookahead_hours ?? "--"}h</strong></div>
      <div><span>Picks:</span> <strong>${payload.count ?? 0}</strong></div>
    </div>
  `;
}
function renderPickCard(pick) {
  const tier = pick.tier || "medium";
  const valueEdge = pick.value_edge;
  const oddsText = pick.odds_estimate ? formatOdds(pick.odds_estimate) : "--";
  const edgeText = valueEdge === null || valueEdge === undefined ? "--" : `${valueEdge}%`;
  const bookmaker = pick.bookmaker || "Modelo";
  const resultClass = statusClass(pick.status);

  return `
    <article class="pick-card ${tier}">
      <div class="pick-card-top">
        <div>
          <h3>${escapeHtml(pick.match || "Partido")}</h3>
          <div class="pick-meta">
            <span>${escapeHtml(pick.league || "--")}</span>
            <span>${escapeHtml(pick.time_local || "--")}</span>
            <span>${escapeHtml(pick.pick_type || "--")}</span>
          </div>
        </div>
        <div class="pick-badges">
          <span class="tier-badge tier-${escapeHtml(tier)}">${escapeHtml(tier)}</span>
          <span class="status-badge ${resultClass}">${escapeHtml(pick.status || "pending")}</span>
        </div>
      </div>

      <div class="pick-main">
        <div class="pick-selection">${escapeHtml(pick.pick || "--")}</div>
        <div class="pick-explainer">${escapeHtml(pick.tipster_explanation || "Sin explicación disponible.")}</div>
      </div>

      <div class="pick-metrics">
        <div class="metric-box">
          <span>Confianza</span>
          <strong>${formatPercent(pick.confidence)}</strong>
        </div>
        <div class="metric-box">
          <span>Cuota</span>
          <strong>${oddsText}</strong>
        </div>
        <div class="metric-box">
          <span>Stake</span>
          <strong>${pick.stake ?? 0}</strong>
        </div>
        <div class="metric-box">
          <span>Edge</span>
          <strong>${edgeText}</strong>
        </div>
      </div>

      <div class="pick-footer">
        <span>Bookmaker: ${escapeHtml(bookmaker)}</span>
        <span>Fuente cuota: ${escapeHtml(pick.odds_source || "--")}</span>
        <span>Combo: ${pick.recommended_for_combo ? "Sí" : "No"}</span>
      </div>
    </article>
  `;
}

function renderMarketCard(market) {
  const edgeText =
    market.value_edge === null || market.value_edge === undefined
      ? "--"
      : `${market.value_edge}%`;

  return `
    <article class="market-card tier-${escapeHtml(market.tier || "medium")}">
      <div class="market-head">
        <h4>${escapeHtml(market.pick || "--")}</h4>
        <span class="mini-badge">${escapeHtml(market.pick_type || "--")}</span>
      </div>

      <div class="market-grid-inner">
        <div><span>Confianza</span><strong>${formatPercent(market.confidence)}</strong></div>
        <div><span>Cuota</span><strong>${market.odds_estimate ? formatOdds(market.odds_estimate) : "--"}</strong></div>
        <div><span>Stake</span><strong>${market.stake ?? 0}</strong></div>
        <div><span>Edge</span><strong>${edgeText}</strong></div>
      </div>

      <div class="market-flags">
        <span>Tier: ${escapeHtml(market.tier || "--")}</span>
        <span>Trackable: ${market.trackable ? "Sí" : "No"}</span>
        <span>Combo: ${market.recommended_for_combo ? "Sí" : "No"}</span>
      </div>

      <p class="market-text">${escapeHtml(market.tipster_explanation || "Sin explicación disponible.")}</p>
    </article>
  `;
}

function renderHistoryCard(item) {
  const resultClass = statusClass(item.status);

  return `
    <article class="history-card ${resultClass}">
      <div class="history-card-top">
        <h4>${escapeHtml(item.match || "--")}</h4>
        <span>${escapeHtml(item.history_date || "--")}</span>
      </div>

      <div class="history-meta">
        <span>${escapeHtml(item.league || "--")}</span>
        <span>${escapeHtml(item.time_local || "--")}</span>
        <span>${escapeHtml(item.pick_type || "--")}</span>
      </div>

      <div class="history-main">
        <strong>${escapeHtml(item.pick || "--")}</strong>
      </div>

      <div class="history-footer">
        <span>Estado: ${escapeHtml(item.status || "pending")}</span>
        <span>Marcador: ${escapeHtml(item.score_line || "--")}</span>
        <span>Cuota: ${item.odds_estimate ? formatOdds(item.odds_estimate) : "--"}</span>
      </div>
    </article>
  `;
}
function setText(id, value) {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = value;
  }
}

function formatPercent(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "--";
  }
  return `${Number(value).toFixed(0)}%`;
}

function formatUnits(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "--";
  }
  const num = Number(value);
  return `${num > 0 ? "+" : ""}${num.toFixed(2)}u`;
}

function formatOdds(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "--";
  }
  return Number(value).toFixed(2);
}

function formatDateTime(value) {
  if (!value) return "--";

  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;

    return date.toLocaleString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

function statusClass(status) {
  if (status === "won") return "won";
  if (status === "lost") return "lost";
  return "pending";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}