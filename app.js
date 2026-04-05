const BACKEND_URL = "https://funcional-s4vd.onrender.com/top-picks-today";
const CACHE_KEY = "top-pronosticos-diarios-cache-v6";

const app = document.getElementById("app");

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function confidenceBadge(confidence) {
  const c = String(confidence || "").toLowerCase();

  if (c === "verde") return `<span class="badge badge-green">VERDE</span>`;
  if (c === "amarillo") return `<span class="badge badge-yellow">AMARILLO</span>`;
  return `<span class="badge badge-red">ROJO</span>`;
}

function pickTypeBadge(type) {
  const t = String(type || "").toLowerCase();

  if (t === "medio") return `<span class="type-pill type-medio">Media</span>`;
  if (t === "agresivo") return `<span class="type-pill type-agresivo">Alta</span>`;
  return `<span class="type-pill">Pick</span>`;
}

function marketBadge(marketGroup, pickText) {
  const market = String(marketGroup || "").toLowerCase();
  const pick = String(pickText || "").toLowerCase();

  if (market === "winner") return `<span class="type-pill type-medio">Ganador</span>`;
  if (market === "over_2_5") return `<span class="type-pill type-agresivo">Más de 2.5</span>`;
  if (market === "btts_yes") return `<span class="type-pill type-solido">Ambos marcan</span>`;

  if (pick.includes("ambos marcan")) return `<span class="type-pill type-solido">Ambos marcan</span>`;
  if (pick.includes("2.5")) return `<span class="type-pill type-agresivo">Más de 2.5</span>`;
  return `<span class="type-pill type-medio">Mercado</span>`;
}

function sourceBadge(sourceType) {
  const source = String(sourceType || "").toLowerCase();

  if (source === "real_odds") {
    return `<span class="source-pill source-real">Odds reales</span>`;
  }

  return `<span class="source-pill source-model">Modelo</span>`;
}

function sourceText(sourceType, bookmaker) {
  const source = String(sourceType || "").toLowerCase();
  if (source === "real_odds") return bookmaker || "Bookmaker";
  return "Modelo IA";
}

function getBestOdds(picks) {
  if (!Array.isArray(picks) || picks.length === 0) return "-";
  const max = Math.max(...picks.map(p => Number(p.odds || 0)));
  return max > 0 ? max.toFixed(2) : "-";
}

function getHighConfidenceCount(picks) {
  if (!Array.isArray(picks)) return 0;
  return picks.filter(p => String(p.confidence || "").toLowerCase() === "verde").length;
}

function getRealOddsCount(picks) {
  if (!Array.isArray(picks)) return 0;
  return picks.filter(p => String(p.source_type || "").toLowerCase() === "real_odds").length;
}

function formatCount(value) {
  return Number.isFinite(Number(value)) ? String(value) : "0";
}

function loadingView() {
  app.innerHTML = `
    <section class="hero">
      <div>
        <div class="eyebrow">PICKS DEL DÍA</div>
        <h1>Top Pronósticos Diarios</h1>
        <p>Solo partidos del día, solo prepartido y picks fijos hasta el siguiente día. El sistema prioriza cuotas medias y altas dentro de tus ligas objetivo.</p>
      </div>
      <button class="refresh-btn" disabled>Cargando...</button>
    </section>

    <section class="status-card">
      <div class="spinner"></div>
      <div>
        <h3>Consultando picks del día</h3>
        <p>Buscando partidos de hoy y filtrando solo picks válidos antes del inicio.</p>
      </div>
    </section>
  `;
}

function errorView(message) {
  app.innerHTML = `
    <section class="hero">
      <div>
        <div class="eyebrow">PICKS DEL DÍA</div>
        <h1>Top Pronósticos Diarios</h1>
        <p>Solo partidos del día, solo prepartido y picks fijos hasta el siguiente día. El sistema prioriza cuotas medias y altas dentro de tus ligas objetivo.</p>
      </div>
      <button class="refresh-btn" onclick="loadPicks(true)">Actualizar picks</button>
    </section>

    <section class="status-card error">
      <div>
        <h3>Error cargando datos</h3>
        <p>${escapeHtml(message)}</p>
      </div>
    </section>
  `;
}

function emptyView(data) {
  app.innerHTML = `
    <section class="hero">
      <div>
        <div class="eyebrow">PICKS DEL DÍA</div>
        <h1>Top Pronósticos Diarios</h1>
        <p>Solo partidos del día, solo prepartido y picks fijos hasta el siguiente día. El sistema prioriza cuotas medias y altas dentro de tus ligas objetivo.</p>
      </div>
      <button class="refresh-btn" onclick="loadPicks(true)">Actualizar picks</button>
    </section>

    <section class="summary-grid">
      <div class="summary-card">
        <span class="summary-label">Picks de hoy</span>
        <strong class="summary-value">0</strong>
      </div>
      <div class="summary-card">
        <span class="summary-label">Mejor cuota</span>
        <strong class="summary-value">-</strong>
      </div>
      <div class="summary-card">
        <span class="summary-label">Confianza alta</span>
        <strong class="summary-value">0</strong>
      </div>
      <div class="summary-card">
        <span class="summary-label">Odds reales</span>
        <strong class="summary-value">0</strong>
      </div>
    </section>

    <section class="status-card">
      <div>
        <h3>Hoy no hay picks válidos</h3>
        <p><strong>Fecha:</strong> ${escapeHtml(data.date || "-")}</p>
        <p><strong>Generado:</strong> ${escapeHtml(data.generated_at || "-")}</p>
        <p><strong>Fuente:</strong> ${escapeHtml(data.source || "-")}</p>
        <p><strong>Se mantiene hasta:</strong> ${escapeHtml(data.cached_until || "-")}</p>
      </div>
    </section>
  `;
}

function renderPickCard(pick) {
  return `
    <article class="pick-card">
      <div class="pick-top">
        <div>
          <div class="competition">${escapeHtml(pick.competition || "")}</div>
          <h2 class="match">${escapeHtml(pick.match || "")}</h2>
        </div>
        <div class="kickoff">
          <span>🕒</span>
          <strong>${escapeHtml(pick.starts_at || "--:--")}</strong>
        </div>
      </div>

      <div class="pick-tags">
        ${pickTypeBadge(pick.type)}
        ${marketBadge(pick.market_group, pick.pick)}
        ${confidenceBadge(pick.confidence)}
        ${sourceBadge(pick.source_type)}
      </div>

      <div class="pick-main-line">
        <span class="label">Pronóstico</span>
        <span class="value strong">${escapeHtml(pick.pick || "-")}</span>
      </div>

      <div class="stats-grid">
        <div class="stat-box">
          <span class="label">Cuota</span>
          <span class="value">${escapeHtml(pick.odds ?? "-")}</span>
        </div>

        <div class="stat-box">
          <span class="label">Prob. modelo</span>
          <span class="value">${escapeHtml(pick.model_probability ?? "-")}%</span>
        </div>

        <div class="stat-box">
          <span class="label">Prob. implícita</span>
          <span class="value">${escapeHtml(pick.implied_probability ?? "-")}%</span>
        </div>

        <div class="stat-box">
          <span class="label">Value</span>
          <span class="value">${Number(pick.value_edge) >= 0 ? "+" : ""}${escapeHtml(pick.value_edge ?? "-")}%</span>
        </div>
      </div>

      <div class="tipster-box">
        <h3>Análisis IA</h3>
        <p>${escapeHtml(pick.tipster_explanation || "Sin explicación disponible.")}</p>
      </div>

      <div class="pick-footer">
        <span><strong>Fuente:</strong> ${escapeHtml(sourceText(pick.source_type, pick.bookmaker))}</span>
        <span><strong>Mercado:</strong> ${escapeHtml(pick.market_name || "-")}</span>
      </div>
    </article>
  `;
}

function renderData(data) {
  const picks = Array.isArray(data.picks) ? data.picks : [];

  if (picks.length === 0) {
    emptyView(data);
    return;
  }

  const highConfidence = getHighConfidenceCount(picks);
  const bestOdds = getBestOdds(picks);
  const realOddsCount = getRealOddsCount(picks);

  app.innerHTML = `
    <section class="hero">
      <div>
        <div class="eyebrow">PICKS DEL DÍA</div>
        <h1>Top Pronósticos Diarios</h1>
        <p>Solo partidos de hoy, solo prepartido y picks bloqueados durante todo el día. Aunque pulses actualizar, los picks no cambian hasta la siguiente jornada.</p>
      </div>
      <button class="refresh-btn" onclick="loadPicks(true)">Actualizar picks</button>
    </section>

    <section class="meta-strip">
      <div><strong>Fecha:</strong> ${escapeHtml(data.date || "-")}</div>
      <div><strong>Generado:</strong> ${escapeHtml(data.generated_at || "-")}</div>
      <div><strong>Se mantiene hasta:</strong> ${escapeHtml(data.cached_until || "-")}</div>
    </section>

    <section class="summary-grid">
      <div class="summary-card">
        <span class="summary-label">Picks de hoy</span>
        <strong class="summary-value">${formatCount(data.count ?? picks.length)}</strong>
      </div>
      <div class="summary-card">
        <span class="summary-label">Mejor cuota</span>
        <strong class="summary-value">${escapeHtml(bestOdds)}</strong>
      </div>
      <div class="summary-card">
        <span class="summary-label">Confianza alta</span>
        <strong class="summary-value">${escapeHtml(highConfidence)}</strong>
      </div>
      <div class="summary-card">
        <span class="summary-label">Odds reales</span>
        <strong class="summary-value">${escapeHtml(realOddsCount)}</strong>
      </div>
    </section>

    <section class="status-ok">
      Picks diarios fijados correctamente. Solo se muestran partidos de hoy y nunca encuentros en juego.
    </section>

    <section class="cards-grid">
      ${picks.map(renderPickCard).join("")}
    </section>
  `;
}

async function loadPicks(forceRefresh = false) {
  loadingView();

  try {
    const url = forceRefresh
      ? `${BACKEND_URL}?refresh=1&ts=${Date.now()}`
      : BACKEND_URL;

    const response = await fetch(url, {
      method: "GET",
      headers: { "Accept": "application/json" },
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch (_) {}

    renderData(data);
  } catch (error) {
    console.error("Error cargando picks:", error);

    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        renderData(parsed);
        return;
      }
    } catch (_) {}

    errorView(error.message || "Error desconocido");
  }
}

window.loadPicks = loadPicks;
document.addEventListener("DOMContentLoaded", () => loadPicks(false));