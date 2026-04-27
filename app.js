const API_BASE =
  window.location.hostname.includes("github.io")
    ? "https://funcional-s4vd.onrender.com"
    : window.location.origin;

const state = {
  loading: false,
  refreshing: false,
  payload: null,
};

document.addEventListener("DOMContentLoaded", () => {
  initApp();
});

async function initApp() {
  bindEvents();
  setStatus("Cargando modelo predictivo...");
  await loadPicks(false);
  setStatus("Modelo actualizado");
}

function bindEvents() {
  const refreshBtn = document.getElementById("refreshBtn");

  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => {
      loadPicks(true);
    });
  }
}

async function apiGet(path) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json();
}

async function loadPicks(forceRefresh = false) {
  try {
    state.loading = !forceRefresh;
    state.refreshing = forceRefresh;

    renderLoadingState();

    const payload = await apiGet(
      `/api/picks?force_refresh=${forceRefresh ? "true" : "false"}`
    );

    state.payload = normalizePayload(payload);

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

function normalizePayload(payload) {
  const safe = payload || {};

  if (!Array.isArray(safe.picks)) {
    safe.picks = [];
  }

  if (!safe.combo_of_day) {
    safe.combo_of_day = {
      size: 0,
      estimated_total_odds: null,
      confidence: 0,
      picks: [],
    };
  }

  if (!Array.isArray(safe.combo_of_day.picks)) {
    safe.combo_of_day.picks = [];
  }

  if (!safe.groups) {
    safe.groups = {
      premium: safe.picks,
      strong: [],
      medium: [],
      risky: [],
    };
  }

  safe.groups.premium = safe.picks;
  safe.groups.strong = [];
  safe.groups.medium = [];
  safe.groups.risky = [];

  return safe;
}

function renderAll() {
  renderHeaderStats();
  renderComboOfDay();
  renderPremiumSingle();
  renderPremiumPicks();
  renderMetaInfo();
}

function renderLoadingState() {
  const loader = document.getElementById("loader");
  const refreshBtn = document.getElementById("refreshBtn");

  if (loader) {
    loader.style.display = state.loading || state.refreshing ? "flex" : "none";
    loader.textContent = state.refreshing
      ? "Actualizando picks premium..."
      : "Cargando picks premium...";
  }

  if (refreshBtn) {
    refreshBtn.disabled = state.loading || state.refreshing;
    refreshBtn.textContent = state.refreshing ? "Actualizando..." : "Actualizar";
  }
}

function setStatus(message) {
  const el = document.getElementById("statusText");

  if (el) {
    el.textContent = message;
  }
}
function renderHeaderStats() {
  const payload = state.payload || {};
  const stats = payload.dashboard_stats || {};
  const picks = payload.picks || [];

  setText("statHits", stats.hits || "0/0");
  setText("statEffectiveness", formatPercent(stats.effectiveness || 0));
  setText("statProfit", "Pro");
  setText("statPending", String(stats.pending ?? picks.length));
  setText("statTotalPicks", String(payload.count ?? picks.length));

  setText("countPremium", String(picks.length));
  setText("countStrong", "0");
  setText("countMedium", "0");
  setText("countRisky", "0");
}

function renderComboOfDay() {
  const comboWrap = document.getElementById("comboOfDay");

  if (!comboWrap) return;

  const combo = state.payload?.combo_of_day || {};
  const picks = Array.isArray(combo.picks) ? combo.picks : [];

  if (!picks.length || picks.length < 3) {
    comboWrap.innerHTML = `
      <section class="panel combo-panel">
        <div class="panel-head">
          <div>
            <span class="section-kicker">Premium combo</span>
            <h2>Combinada del día</h2>
          </div>
          <span class="badge">Hoy / mañana</span>
        </div>

        <div class="empty-state">
          <strong>No hay combinada suficiente ahora mismo.</strong>
          <p>El modelo necesita 3 partidos premium válidos de hoy o mañana.</p>
        </div>
      </section>
    `;
    return;
  }

  comboWrap.innerHTML = `
    <section class="panel combo-panel">
      <div class="panel-head">
        <div>
          <span class="section-kicker">Premium combo</span>
          <h2>Combinada del día</h2>
        </div>
        <span class="badge">3 partidos</span>
      </div>

      <div class="combo-summary">
        <div class="metric-chip">
          <span class="metric-label">Cuota total</span>
          <strong>${combo.estimated_total_odds ? formatOdds(combo.estimated_total_odds) : "--"}</strong>
        </div>

        <div class="metric-chip">
          <span class="metric-label">Confianza</span>
          <strong>${formatPercent(combo.confidence)}</strong>
        </div>

        <div class="metric-chip">
          <span class="metric-label">Ventana</span>
          <strong>Hoy / mañana</strong>
        </div>
      </div>

      <div class="pick-list">
        ${picks.map(renderPickCard).join("")}
      </div>
    </section>
  `;
}

function renderPremiumSingle() {
  const existing = document.getElementById("premiumSingleSection");

  if (existing) {
    existing.remove();
  }

  const premium = state.payload?.premium_single;
  const comboSection = document.getElementById("comboOfDay");

  if (!comboSection || !premium) return;

  const section = document.createElement("section");
  section.id = "premiumSingleSection";

  section.innerHTML = `
    <div class="panel premium-single-panel">
      <div class="panel-head">
        <div>
          <span class="section-kicker">Pick destacado</span>
          <h2>Pick Premium</h2>
        </div>
        <span class="badge">Mejor individual</span>
      </div>

      <div class="pick-list">
        ${renderPickCard(premium)}
      </div>
    </div>
  `;

  comboSection.insertAdjacentElement("afterend", section);
}

function renderPremiumPicks() {
  const wrap = document.getElementById("mainContent");

  if (!wrap) return;

  const picks = state.payload?.picks || [];

  wrap.innerHTML = `
    <section class="panel">
      <div class="panel-head">
        <div>
          <span class="section-kicker">Modelo premium</span>
          <h2>Picks Premium</h2>
        </div>
        <span class="badge">${picks.length}/10</span>
      </div>

      ${
        picks.length
          ? `<div class="pick-list">${picks.map(renderPickCard).join("")}</div>`
          : `
            <div class="empty-state">
              <strong>No hay picks premium disponibles.</strong>
              <p>No hay suficientes partidos válidos de hoy o mañana.</p>
            </div>
          `
      }
    </section>
  `;
}
function renderPickCard(pick) {
  const selections = Array.isArray(pick.selections) ? pick.selections : [];

  return `
    <article class="betslip-card premium">
      <div class="betslip-top">
        <div class="betslip-top-left">
          <span class="betslip-label">Crear apuesta premium</span>

          <h3>${escapeHtml(pick.match || "Partido")}</h3>

          <div class="betslip-meta">
            <span>${escapeHtml(pick.league || "--")}</span>
            <span>${escapeHtml(pick.time_local || "--")}</span>
            <span>Cuota máx. 2.50</span>
          </div>
        </div>

        <div class="betslip-top-right">
          <span class="tier-badge tier-premium">Premium</span>
          <span class="status-badge pending">Pendiente</span>
        </div>
      </div>

      <div class="betslip-body">
        <div class="bet-selection-box">
          <span class="bet-selection-label">Selecciones</span>

          <div class="builder-legs">
            ${
              selections.length
                ? selections.map(renderBuilderLeg).join("")
                : `<div class="builder-leg">${escapeHtml(pick.pick || "--")}</div>`
            }
          </div>
        </div>

        <div class="bet-stats-grid bet-stats-grid-clean">
          <div class="bet-stat">
            <span>Cuota estimada</span>
            <strong>${pick.odds_estimate ? formatOdds(pick.odds_estimate) : "--"}</strong>
          </div>

          <div class="bet-stat">
            <span>Nivel de confianza</span>
            <strong>${formatPercent(pick.confidence)}</strong>
          </div>
        </div>

        <p class="betslip-explainer">
          ${escapeHtml(pick.tipster_explanation || "Pick generado por el modelo premium.")}
        </p>
      </div>
    </article>
  `;
}

function renderBuilderLeg(selection) {
  const text = String(selection || "");
  const lower = text.toLowerCase();

  const isCards =
    lower.includes("tarjeta") ||
    lower.includes("tarjetas");

  const isGoals =
    lower.includes("goles") ||
    lower.includes("marcan");

  const isWinner =
    lower.startsWith("gana") ||
    lower.startsWith("1x") ||
    lower.startsWith("x2");

  let icon = "✓";

  if (isCards) {
    icon = "🟨";
  } else if (isGoals) {
    icon = "⚽";
  } else if (isWinner) {
    icon = "🏆";
  }

  return `
    <div class="builder-leg ${isCards ? "cards-leg" : ""}">
      <span class="leg-icon">${icon}</span>
      <span class="leg-text">${escapeHtml(text)}</span>
    </div>
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
        <span>Ventana:</span>
        <strong>Hoy / mañana</strong>
      </div>

      <div>
        <span>Picks:</span>
        <strong>${payload.count ?? 0}</strong>
      </div>
    </div>
  `;
}

function renderError(message) {
  const main = document.getElementById("mainContent");

  if (!main) return;

  main.innerHTML = `
    <section class="panel error-panel">
      <div class="panel-head">
        <h2>Error</h2>
      </div>
      <p>${escapeHtml(message)}</p>
    </section>
  `;
}
function setText(id, value) {
  const el = document.getElementById(id);

  if (el) {
    el.textContent = value;
  }
}

function formatPercent(value) {
  if (
    value === null ||
    value === undefined ||
    Number.isNaN(Number(value))
  ) {
    return "--";
  }

  return `${Number(value).toFixed(0)}%`;
}

function formatOdds(value) {
  if (
    value === null ||
    value === undefined ||
    Number.isNaN(Number(value))
  ) {
    return "--";
  }

  return Number(value).toFixed(2);
}

function formatDateTime(value) {
  if (!value) {
    return "--";
  }

  try {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

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

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatPickTypeLabel(pickType) {
  const labels = {
    bet_builder: "Crear apuesta",
    winner: "Ganador",
    double_chance: "Ganador o empate",
    over_2_5: "Más de 2.5 goles",
    under_3_5: "Menos de 3.5 goles",
    btts_yes: "Ambos marcan: Sí",
    btts_no: "Ambos marcan: No",
    team_cards_1_5: "Tarjetas equipo +1.5",
    both_teams_card_1_plus: "Ambos equipos 1+ tarjeta",
    both_teams_card_2_plus: "Ambos equipos 2+ tarjetas",
  };

  return labels[pickType] || pickType || "--";
}

function formatTierLabel(tier) {
  return "Premium";
}

function formatStatusLabel(status) {
  if (status === "won") return "Ganado";
  if (status === "lost") return "Fallado";
  return "Pendiente";
}

function statusClass(status) {
  if (status === "won") return "won";
  if (status === "lost") return "lost";
  return "pending";
}
function getPickMarketSummary(pick) {
  const selections = Array.isArray(pick.selections) ? pick.selections : [];

  const hasWinner = selections.some((s) => {
    const text = String(s).toLowerCase();
    return text.startsWith("gana") || text.startsWith("1x") || text.startsWith("x2");
  });

  const hasGoals = selections.some((s) => {
    const text = String(s).toLowerCase();
    return text.includes("goles") || text.includes("marcan");
  });

  const hasCards = selections.some((s) => {
    const text = String(s).toLowerCase();
    return text.includes("tarjeta") || text.includes("tarjetas");
  });

  const parts = [];

  if (hasWinner) parts.push("Resultado");
  if (hasGoals) parts.push("Goles");
  if (hasCards) parts.push("Tarjetas");

  return parts.length ? parts.join(" + ") : "Premium";
}