const BACKEND_URL = "https://funcional-s4vd.onrender.com/top-picks-today";
const CACHE_KEY = "top-pronosticos-diarios-cache-v2";

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

  if (c === "verde") {
    return `<span class="badge badge-green">VERDE</span>`;
  }
  if (c === "amarillo") {
    return `<span class="badge badge-yellow">AMARILLO</span>`;
  }
  return `<span class="badge badge-red">ROJO</span>`;
}

function pickTypeBadge(type) {
  const t = String(type || "").toLowerCase();

  if (t === "solido") {
    return `<span class="type-pill type-solido">Sólido</span>`;
  }
  if (t === "medio") {
    return `<span class="type-pill type-medio">Medio</span>`;
  }
  if (t === "agresivo") {
    return `<span class="type-pill type-agresivo">Agresivo</span>`;
  }
  return `<span class="type-pill">Pick</span>`;
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

function formatCount(value) {
  return Number.isFinite(Number(value)) ? String(value) : "0";
}

function loadingView() {
  app.innerHTML = `
    <section class="hero">
      <div>
        <div class="eyebrow">PRONÓSTICOS DIARIOS</div>
        <h1>Top Pronósticos Diarios</h1>
        <p>Pronósticos deportivos con IA. Picks diarios con análisis IA, cuotas reales, value y estrategia tipster.</p>
      </div>
      <button class="refresh-btn" disabled>Cargando...</button>
    </section>

    <section class="status-card">
      <div class="spinner"></div>
      <div>
        <h3>Consultando backend</h3>
        <p>Buscando picks reales en las mejores competiciones y próximos partidos de la semana.</p>
      </div>
    </section>
  `;
}

function errorView(message) {
  app.innerHTML = `
    <section class="hero">
      <div>
        <div class="eyebrow">PRONÓSTICOS DIARIOS</div>
        <h1>Top Pronósticos Diarios</h1>
        <p>Pronósticos deportivos con IA. Picks diarios con análisis IA, cuotas reales, value y estrategia tipster.</p>
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
        <div class="eyebrow">PRONÓSTICOS DIARIOS</div>
        <h1>Top Pronósticos Diarios</h1>
        <p>Pronósticos deportivos con IA. Picks diarios con análisis IA, cuotas reales, value y estrategia tipster.</p>
      </div>
      <button class="refresh-btn" onclick="loadPicks(true)">Actualizar picks</button>
    </section>

    <section class="summary-grid">
      <div class="summary-card">
        <span class="summary-label">Picks del día</span>
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
    </section>

    <section class="status-card">
      <div>
        <h3>No hay picks válidos ahora mismo</h3>
        <p><strong>Fecha:</strong> ${escapeHtml(data.date || "-")}</p>
        <p><strong>Generado a las:</strong> ${escapeHtml(data.generated_at || "-")}</p>
        <p><strong>Fuente:</strong> ${escapeHtml(data.source || "-")}</p>
        <p><strong>Próxima renovación:</strong> ${escapeHtml(data.cached_until || "-")}</p>
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
        ${confidenceBadge(pick.confidence)}
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
          <span class="value">+${escapeHtml(pick.value_edge ?? "-")}%</span>
        </div>
      </div>

      <div class="tipster-box">
        <h3>Análisis IA</h3>
        <p>${escapeHtml(pick.tipster_explanation || "Sin explicación disponible.")}</p>
      </div>

      <div class="pick-footer">
        <span><strong>Bookmaker:</strong> ${escapeHtml(pick.bookmaker || "N/D")}</span>
        <span><strong>Tipo:</strong> ${escapeHtml(pick.type || "-")}</span>
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

  app.innerHTML = `
    <section class="hero">
      <div>
        <div class="eyebrow">PRONÓSTICOS DIARIOS</div>
        <h1>Top Pronósticos Diarios</h1>
        <p>Pronósticos deportivos con IA. Picks diarios con análisis IA, cuotas reales, value y estrategia tipster.</p>
      </div>
      <button class="refresh-btn" onclick="loadPicks(true)">Actualizar picks</button>
    </section>

    <section class="meta-strip">
      <div><strong>Fecha:</strong> ${escapeHtml(data.date || "-")}</div>
      <div><strong>Generado:</strong> ${escapeHtml(data.generated_at || "-")}</div>
      <div><strong>Renueva:</strong> cada 24h</div>
    </section>

    <section class="summary-grid">
      <div class="summary-card">
        <span class="summary-label">Picks del día</span>
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
    </section>

    <section class="status-ok">
      Picks actualizados correctamente. Próxima renovación automática en 24 horas.
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
      ? `${BACKEND_URL}?ts=${Date.now()}`
      : BACKEND_URL;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Accept": "application/json"
      },
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