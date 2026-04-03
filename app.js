const BACKEND_URL = "https://funcional-s4vd.onrender.com/top-picks-today";

const app = document.getElementById("app");

function badgeClass(confidence) {
  const c = (confidence || "").toLowerCase();
  if (c === "verde") return "badge badge-green";
  if (c === "amarillo") return "badge badge-yellow";
  return "badge badge-red";
}

function typeLabel(type) {
  const t = (type || "").toLowerCase();
  if (t === "solido") return "Sólido";
  if (t === "medio") return "Medio";
  if (t === "agresivo") return "Agresivo";
  return "Pick";
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function loadingView() {
  app.innerHTML = `
    <section class="hero">
      <h1>Top 3 Picks del Día</h1>
      <p>Analizando cuotas reales, valor y próximos partidos de la semana…</p>
    </section>

    <section class="status-card">
      <div class="spinner"></div>
      <div>
        <h3>Cargando picks</h3>
        <p>Consultando backend y buscando oportunidades con valor real.</p>
      </div>
    </section>
  `;
}

function errorView(message) {
  app.innerHTML = `
    <section class="hero">
      <h1>Top 3 Picks del Día</h1>
      <p>No se pudieron cargar los pronósticos.</p>
    </section>

    <section class="status-card error">
      <div>
        <h3>Error cargando datos</h3>
        <p>${escapeHtml(message)}</p>
        <button class="refresh-btn" onclick="loadPicks()">Reintentar</button>
      </div>
    </section>
  `;
}

function emptyView(meta) {
  app.innerHTML = `
    <section class="hero">
      <h1>Top 3 Picks del Día</h1>
      <p>No hay picks válidos ahora mismo. Puede que no haya suficientes partidos con valor.</p>
    </section>

    <section class="status-card">
      <div>
        <h3>Sin picks disponibles</h3>
        <p><strong>Fecha:</strong> ${escapeHtml(meta.date || "-")}</p>
        <p><strong>Generado a las:</strong> ${escapeHtml(meta.generated_at || "-")}</p>
        <p><strong>Fuente:</strong> ${escapeHtml(meta.source || "-")}</p>
        <button class="refresh-btn" onclick="loadPicks()">Actualizar</button>
      </div>
    </section>
  `;
}

function pickCard(pick) {
  const confidence = pick.confidence || "rojo";
  const type = pick.type || "pick";

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
        <span class="type-pill type-${escapeHtml(type)}">${typeLabel(type)}</span>
        <span class="${badgeClass(confidence)}">${escapeHtml(confidence.toUpperCase())}</span>
      </div>

      <div class="pick-main">
        <div class="pick-line">
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
      </div>

      <div class="tipster-box">
        <h3>Análisis tipster</h3>
        <p>${escapeHtml(pick.tipster_explanation || "Sin explicación disponible.")}</p>
      </div>

      <div class="pick-footer">
        <span><strong>Casa:</strong> ${escapeHtml(pick.bookmaker || "N/D")}</span>
        <span><strong>Fixture ID:</strong> ${escapeHtml(pick.fixture_id ?? "-")}</span>
      </div>
    </article>
  `;
}

function renderData(data) {
  const picks = Array.isArray(data.picks) ? data.picks : [];

  if (!picks.length) {
    emptyView(data);
    return;
  }

  app.innerHTML = `
    <section class="hero">
      <div>
        <h1>Top 3 Picks del Día</h1>
        <p>Ganador local o visitante con cuotas reales, value y análisis tipster.</p>
      </div>
      <button class="refresh-btn" onclick="loadPicks()">Actualizar</button>
    </section>

    <section class="meta-strip">
      <div><strong>Fecha:</strong> ${escapeHtml(data.date || "-")}</div>
      <div><strong>Generado:</strong> ${escapeHtml(data.generated_at || "-")}</div>
      <div><strong>Fuente:</strong> ${escapeHtml(data.source || "-")}</div>
    </section>

    <section class="cards-grid">
      ${picks.map(pickCard).join("")}
    </section>
  `;
}

async function loadPicks() {
  loadingView();

  try {
    const response = await fetch(BACKEND_URL, {
      method: "GET",
      headers: {
        "Accept": "application/json"
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    try {
      const cacheKey = `top-picks-${data.date || "today"}`;
      localStorage.setItem(cacheKey, JSON.stringify(data));
    } catch (_) {}

    renderData(data);
  } catch (error) {
    console.error("Error cargando picks:", error);

    // fallback a caché local si existe
    try {
      const keys = Object.keys(localStorage).filter(k => k.startsWith("top-picks-")).sort().reverse();
      if (keys.length > 0) {
        const cached = JSON.parse(localStorage.getItem(keys[0]));
        renderData(cached);
        return;
      }
    } catch (_) {}

    errorView(error.message || "Error desconocido");
  }
}

window.loadPicks = loadPicks;
document.addEventListener("DOMContentLoaded", loadPicks);