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
    refreshBtn.addEventListener("click", () => loadPicks(true));
  }

  if (reloadHistoryBtn) {
    reloadHistoryBtn.addEventListener("click", () => loadHistory(state.historyPage));
  }

  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      state.selectedTab = btn.dataset.tab || "premium";
      updateTabButtons();
      renderMainSections();
    });
  });
}

async function initApp() {
  setStatus("Cargando Tipster Tips Pro...");

  await Promise.allSettled([
    loadPicks(false),
    loadHistory(1),
    loadOdds(),
  ]);

  setStatus("Modelo actualizado");
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

    const payload = await apiGet(
      `/api/picks?force_refresh=${forceRefresh ? "true" : "false"}`
    );

    state.payload = payload || {};

    if (!Array.isArray(state.payload.match_catalog)) {
      state.payload.match_catalog = [];
    }

    if (!state.payload.groups) {
      state.payload.groups = {
        premium: [],
        strong: [],
        medium: [],
        risky: [],
      };
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
    const payload = await apiGet(
      `/api/history?page=${page}&page_size=${state.historyPageSize}`
    );

    state.history = payload || {};
    state.historyPage = payload?.page || 1;

    renderHistory();
  } catch (error) {
    console.error("Error loading history:", error);
    renderHistoryError("No se pudo cargar el historial.");
  }
}

async function loadOdds() {
  try {
    const payload = await apiGet("/api/odds");
    state.odds = payload || {};
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
  renderPremiumSingle();
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
      ? "Actualizando picks..."
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
  if (el) el.textContent = message;
}

function updateTabButtons() {
  document.querySelectorAll("[data-tab]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === state.selectedTab);
  });
}
function renderHeaderStats() {
  const payload = state.payload || {};
  const stats = payload.dashboard_stats || {};
  const groups = payload.groups || {};

  setText("statHits", stats.hits || "0/0");
  setText("statEffectiveness", formatPercent(stats.effectiveness));
  setText("statProfit", "Pro");
  setText("statPending", String(stats.pending ?? 0));
  setText("statTotalPicks", String(payload.count ?? stats.total_picks ?? 0));

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

  if (!picks.length || picks.length < 3) {
    comboWrap.innerHTML = `
      <div class="panel">
        <div class="panel-head">
          <h2>Combinada del día</h2>
        </div>
        <p>No hay 3 partidos válidos entre hoy y mañana para formar combinada.</p>
      </div>
    `;
    return;
  }

  comboWrap.innerHTML = `
    <div class="panel combo-panel">
      <div class="panel-head">
        <h2>Combinada del día</h2>
        <span class="badge">3 partidos</span>
      </div>

      <div class="combo-summary">
        <div class="metric-chip">
          <span class="metric-label">Cuota total</span>
          <strong>${combo.estimated_total_odds ? formatOdds(combo.estimated_total_odds) : "--"}</strong>
        </div>

        <div class="metric-chip">
          <span class="metric-label">Nivel de confianza</span>
          <strong>${formatPercent(combo.confidence)}</strong>
        </div>
      </div>

      <div class="pick-list">
        ${picks.map(renderPickCard).join("")}
      </div>
    </div>
  `;
}

function renderPremiumSingle() {
  const existing = document.getElementById("premiumSingleSection");
  if (existing) existing.remove();

  const premium = state.payload?.premium_single;
  const comboSection = document.getElementById("comboOfDay");

  if (!comboSection || !premium) return;

  const section = document.createElement("section");
  section.id = "premiumSingleSection";
  section.innerHTML = `
    <div class="panel">
      <div class="panel-head">
        <h2>Pick Premium</h2>
        <span class="badge">Mejor pick individual</span>
      </div>

      <div class="pick-list">
        ${renderPickCard(premium)}
      </div>
    </div>
  `;

  comboSection.insertAdjacentElement("afterend", section);
}

function renderMainSections() {
  const wrap = document.getElementById("mainContent");
  if (!wrap) return;

  const groups = state.payload?.groups || {};
  let picks = [];

  if (state.selectedTab === "premium") picks = groups.premium || [];
  if (state.selectedTab === "strong") picks = groups.strong || [];
  if (state.selectedTab === "medium") picks = groups.medium || [];
  if (state.selectedTab === "risky") picks = groups.risky || [];

  const titleMap = {
    premium: "Premium Picks",
    strong: "Picks fuertes",
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
        <h2>Mercados por partido</h2>
        <p>No hay partidos cargados ahora mismo.</p>
      </section>
    `;
    return;
  }

  const tabs = catalog
    .map((item, index) => `
      <button class="match-tab ${index === state.selectedMatchIndex ? "active" : ""}" data-match-index="${index}">
        <span>${escapeHtml(item.match || "Partido")}</span>
        <small>${escapeHtml(item.time_local || "--")}</small>
      </button>
    `)
    .join("");

  const selected = catalog[state.selectedMatchIndex] || catalog[0];
  const markets = Array.isArray(selected?.markets) ? selected.markets : [];

  wrap.innerHTML = `
    <section class="panel">
      <div class="panel-head">
        <h2>Mercados por partido</h2>
        <span class="badge">${catalog.length} partidos</span>
      </div>

      <div class="match-tabs">${tabs}</div>

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

  document.querySelectorAll("[data-match-index]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.selectedMatchIndex = Number(btn.dataset.matchIndex || 0);
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
              <button id="prevHistoryPage" ${history.page <= 1 ? "disabled" : ""}>
                Anterior
              </button>

              <span>Página ${history.page || 1} / ${history.total_pages || 1}</span>

              <button id="nextHistoryPage" ${history.page >= history.total_pages ? "disabled" : ""}>
                Siguiente
              </button>
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
  el.innerHTML = `
    <span>
      Mercados de cuotas indexados:
      <strong>${count}</strong>
    </span>
  `;
}

function renderOddsInfoError() {
  const el = document.getElementById("oddsInfo");
  if (!el) return;

  el.innerHTML = `
    <span>
      Mercados de cuotas indexados:
      <strong>0</strong>
    </span>
  `;
}

function renderMetaInfo() {
  const el = document.getElementById("metaInfo");
  if (!el) return;

  const payload = state.payload || {};

  el.innerHTML = `
    <div class="meta-grid">
      <div>
        <span>Generado:</span>
        <strong>${formatDateTime(payload.generated_at)}</strong>
      </div>

      <div>
        <span>Lookahead:</span>
        <strong>${payload.lookahead_hours ?? "--"}h</strong>
      </div>

      <div>
        <span>Picks:</span>
        <strong>${payload.count ?? 0}</strong>
      </div>
    </div>
  `;
}

function renderPickCard(pick) {
  if (pick.pick_type === "bet_builder") {
    return `
      <article class="betslip-card ${escapeHtml(pick.tier || "medium")}">
        <div class="betslip-top">
          <div class="betslip-top-left">
            <span class="betslip-label">Crear apuesta</span>

            <h3>${escapeHtml(pick.match || "Partido")}</h3>

            <div class="builder-title-text">
              ${escapeHtml(pick.pick || "Crear apuesta")}
            </div>

            <div class="betslip-meta">
              <span>${escapeHtml(pick.league || "--")}</span>
              <span>${escapeHtml(pick.time_local || "--")}</span>
              <span>Tipster Tips Pro</span>
            </div>
          </div>

          <div class="betslip-top-right">
            <span class="tier-badge tier-${escapeHtml(pick.tier || "medium")}">
              ${escapeHtml(formatTierLabel(pick.tier))}
            </span>

            <span class="status-badge ${statusClass(pick.status)}">
              ${escapeHtml(formatStatusLabel(pick.status))}
            </span>
          </div>
        </div>

        <div class="betslip-body">
          <div class="bet-selection-box">
            <span class="bet-selection-label">Selecciones</span>

            <div class="builder-legs">
              ${(pick.selections || []).map(renderBuilderLeg).join("")}
            </div>

            ${renderCardsSummary(pick)}
          </div>

          <div class="bet-stats-grid bet-stats-grid-clean">
            <div class="bet-stat">
              <span>Cuota total</span>
              <strong>${pick.odds_estimate ? formatOdds(pick.odds_estimate) : "--"}</strong>
            </div>

            <div class="bet-stat">
              <span>Nivel de confianza</span>
              <strong>${formatPercent(pick.confidence)}</strong>
            </div>
          </div>

          <p class="betslip-explainer">
            ${escapeHtml(pick.tipster_explanation || "")}
          </p>
        </div>
      </article>
    `;
  }

  return `
    <article class="betslip-card ${escapeHtml(pick.tier || "medium")}">
      <div class="betslip-top">
        <div class="betslip-top-left">
          <span class="betslip-label">Apuesta simple</span>

          <h3>${escapeHtml(pick.match || "Partido")}</h3>

          <div class="betslip-meta">
            <span>${escapeHtml(pick.league || "--")}</span>
            <span>${escapeHtml(pick.time_local || "--")}</span>
            <span>${escapeHtml(formatPickTypeLabel(pick.pick_type))}</span>
          </div>
        </div>

        <div class="betslip-top-right">
          <span class="tier-badge tier-${escapeHtml(pick.tier || "medium")}">
            ${escapeHtml(formatTierLabel(pick.tier))}
          </span>

          <span class="status-badge ${statusClass(pick.status)}">
            ${escapeHtml(formatStatusLabel(pick.status))}
          </span>
        </div>
      </div>

      <div class="betslip-body">
        <div class="bet-selection-box">
          <span class="bet-selection-label">Selección</span>

          <div class="bet-selection-value">
            ${escapeHtml(pick.pick || "--")}
          </div>
        </div>

        <div class="bet-stats-grid bet-stats-grid-clean">
          <div class="bet-stat">
            <span>${oddsLabel(pick.odds_source)}</span>
            <strong>${pick.odds_estimate ? formatOdds(pick.odds_estimate) : "--"}</strong>
          </div>

          <div class="bet-stat">
            <span>Nivel de confianza</span>
            <strong>${formatPercent(pick.confidence)}</strong>
          </div>
        </div>

        <p class="betslip-explainer">
          ${escapeHtml(pick.tipster_explanation || "Sin explicación disponible.")}
        </p>
      </div>
    </article>
  `;
}

function renderBuilderLeg(selection) {
  const text = String(selection || "");
  const isCards = text.toLowerCase().includes("tarjeta");
  const numberMatch = text.match(/([0-9]+(\.[0-9]+)?)/);
  const cardsNumber = numberMatch ? numberMatch[1] : "?";

  if (isCards) {
    return `
      <div class="builder-leg cards-leg">
        <div class="cards-icon-wrap">
          <div class="yellow-card-icon"></div>
          <span class="cards-number">${escapeHtml(cardsNumber)}</span>
        </div>

        <div class="cards-text">
          ${escapeHtml(text)}
        </div>
      </div>
    `;
  }

  return `
    <div class="builder-leg">
      ${escapeHtml(text)}
    </div>
  `;
}
function renderCardsSummary(pick) {
  const cards = pick.cards || {};
  const home = pick.home_team || "";
  const away = pick.away_team || "";

  if (!home || !away) return "";

  const homeCards = cards[home];
  const awayCards = cards[away];

  if (homeCards === undefined && awayCards === undefined) return "";

  return `
    <div class="cards-summary-box">
      <span class="cards-summary-title">Tarjetas estimadas</span>

      <div class="cards-summary-grid">
        <div class="cards-team-row">
          <div class="yellow-card-icon"></div>

          <div>
            <span class="cards-team-name">${escapeHtml(home)}</span>
            <strong>${homeCards ?? "--"}</strong>
          </div>
        </div>

        <div class="cards-team-row">
          <div class="yellow-card-icon"></div>

          <div>
            <span class="cards-team-name">${escapeHtml(away)}</span>
            <strong>${awayCards ?? "--"}</strong>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderMarketCard(market) {
  return `
    <article class="bet-market-card tier-${escapeHtml(market.tier || "medium")}">
      <div class="bet-market-card-top">
        <div>
          <span class="betslip-label">Mercado</span>
          <h4>${escapeHtml(formatPickTypeLabel(market.pick_type))}</h4>
        </div>

        <span class="mini-badge">
          ${escapeHtml(formatTierLabel(market.tier))}
        </span>
      </div>

      <div class="bet-selection-box compact">
        <span class="bet-selection-label">Selección</span>

        <div class="bet-selection-value">
          ${escapeHtml(market.pick || "--")}
        </div>
      </div>

      <div class="bet-stats-grid bet-stats-grid-clean">
        <div class="bet-stat">
          <span>${oddsLabel(market.odds_source)}</span>
          <strong>${market.odds_estimate ? formatOdds(market.odds_estimate) : "--"}</strong>
        </div>

        <div class="bet-stat">
          <span>Nivel de confianza</span>
          <strong>${formatPercent(market.confidence)}</strong>
        </div>
      </div>

      <p class="betslip-explainer">
        ${escapeHtml(market.tipster_explanation || "Sin explicación disponible.")}
      </p>
    </article>
  `;
}

function renderHistoryCard(item) {
  const isBuilder = item.pick_type === "bet_builder";

  return `
    <article class="history-card ${statusClass(item.status)}">
      <div class="history-card-top">
        <h4>${escapeHtml(item.match || "--")}</h4>
        <span>${escapeHtml(item.history_date || "--")}</span>
      </div>

      <div class="history-meta">
        <span>${escapeHtml(item.league || "--")}</span>
        <span>${escapeHtml(item.time_local || "--")}</span>
        <span>${escapeHtml(formatPickTypeLabel(item.pick_type))}</span>
      </div>

      <div class="history-main">
        ${
          isBuilder
            ? `
              <strong>Crear apuesta</strong>

              <div class="builder-legs" style="margin-top:10px;">
                ${(item.selections || []).map(renderBuilderLeg).join("")}
              </div>

              ${renderCardsSummary(item)}
            `
            : `<strong>${escapeHtml(item.pick || "--")}</strong>`
        }
      </div>

      <div class="history-footer">
        <span>Estado: ${escapeHtml(formatStatusLabel(item.status))}</span>
        <span>Marcador: ${escapeHtml(item.score_line || "--")}</span>
        <span>Cuota: ${item.odds_estimate ? formatOdds(item.odds_estimate) : "--"}</span>
        <span>Confianza: ${formatPercent(item.confidence)}</span>
      </div>
    </article>
  `;
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function formatPercent(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "--";
  }

  return `${Number(value).toFixed(0)}%`;
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

function formatStatusLabel(status) {
  if (status === "won") return "Ganado";
  if (status === "lost") return "Fallado";
  return "Pendiente";
}

function formatTierLabel(tier) {
  const labels = {
    premium: "Premium",
    strong: "Fuerte",
    medium: "Medio",
    risky: "Riesgo",
  };

  return labels[tier] || tier || "--";
}

function oddsLabel(oddsSource) {
  return oddsSource === "real" ? "Cuota real" : "Cuota estimada";
}

function formatPickTypeLabel(pickType) {
  const labels = {
    bet_builder: "Crear apuesta",
    winner: "Ganador",
    double_chance: "Ganador o empate",
    over_2_5: "Más de 2.5 goles",
    under_2_5: "Menos de 2.5 goles",
    under_3_5: "Menos de 3.5 goles",
    btts_yes: "Ambos marcan: Sí",
    btts_no: "Ambos marcan: No",
    team_cards: "Tarjetas de equipo",
    team_score_first_half: "Equipo marcará en 1ª parte",
    team_score_second_half: "Equipo marcará en 2ª parte",
  };

  return labels[pickType] || pickType || "--";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}