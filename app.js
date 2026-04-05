const BASE_URL = "https://funcional-s4vd.onrender.com";
const BACKEND_URL = `${BASE_URL}/api/picks`;
const HISTORY_URL = `${BASE_URL}/api/history`;
const CACHE_KEY = "top-picks-cache-v25";

const app = document.getElementById("app");

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function confidenceBadge(conf) {
  const n = Number(conf || 0);
  if (n >= 75) return `<span class="badge badge-green">ALTA</span>`;
  if (n >= 65) return `<span class="badge badge-yellow">MEDIA</span>`;
  return `<span class="badge badge-red">NORMAL</span>`;
}

function pickTypeBadge(type) {
  if (type === "winner") return `<span class="type-pill">Ganador</span>`;
  if (type === "double_chance") return `<span class="type-pill">Doble oportunidad</span>`;
  if (type === "draw_no_bet") return `<span class="type-pill">Empate no apuesta</span>`;
  return `<span class="type-pill">Pick</span>`;
}

function resultBadge(status) {
  if (status === "won") return `<span class="result-pill result-won">✔ Acertada</span>`;
  if (status === "lost") return `<span class="result-pill result-lost">✖ Perdida</span>`;
  return `<span class="result-pill result-pending">⏳ Pendiente</span>`;
}

function loading() {
  app.innerHTML = `<div style="padding:40px;text-align:center">Cargando picks...</div>`;
}

function error(msg) {
  app.innerHTML = `<div style="padding:40px;color:red">Error: ${escapeHtml(msg)}</div>`;
}

function renderPick(p) {
  return `
    <div class="card">
      <h3>${escapeHtml(p.match)}</h3>
      <div>${escapeHtml(p.league)}</div>
      <div>🕒 ${escapeHtml(p.time_local)}</div>

      <div style="margin-top:10px">
        ${pickTypeBadge(p.pick_type)}
        ${confidenceBadge(p.confidence)}
        ${resultBadge(p.status)}
      </div>

      <div style="margin-top:10px;font-size:18px">
        <strong>${escapeHtml(p.pick)}</strong>
      </div>

      <div>Cuota: ${p.odds}</div>
      <div>Bookmaker: ${escapeHtml(p.bookmaker)}</div>

      ${p.score_line ? `<div>Resultado: ${p.score_line}</div>` : ""}

      <p style="margin-top:10px;font-size:13px">
        ${escapeHtml(p.tipster_explanation)}
      </p>
    </div>
  `;
}

function renderHistory(history) {
  if (!history || !history.days) return "";

  return `
    <h2>Historial</h2>
    ${history.days.map(day => `
      <div class="day">
        <h3>${day.date}</h3>
        <div>Aciertos: ${day.stats.won} | Fallos: ${day.stats.lost}</div>

        ${day.picks.map(p => `
          <div class="row">
            ${escapeHtml(p.match)} — ${escapeHtml(p.pick)}
            ${resultBadge(p.status)}
          </div>
        `).join("")}
      </div>
    `).join("")}
  `;
}

function render(data, history) {
  const picks = data.picks || [];

  app.innerHTML = `
    <h1>Top Picks</h1>

    <div>
      Fecha: ${escapeHtml(data.cache_day)} |
      Generado: ${escapeHtml(data.generated_at)}
    </div>

    <div class="grid">
      ${picks.map(renderPick).join("")}
    </div>

    ${renderHistory(history)}
  `;
}

async function load(force = false) {
  loading();

  try {
    const url = force
      ? `${BACKEND_URL}?force_refresh=true&ts=${Date.now()}`
      : BACKEND_URL;

    const [data, history] = await Promise.all([
      fetch(url).then(r => r.json()),
      fetch(HISTORY_URL).then(r => r.json())
    ]);

    localStorage.setItem(CACHE_KEY, JSON.stringify({ data, history }));

    render(data, history);

  } catch (e) {
    const cache = localStorage.getItem(CACHE_KEY);
    if (cache) {
      const parsed = JSON.parse(cache);
      render(parsed.data, parsed.history);
      return;
    }
    error(e.message);
  }
}

document.addEventListener("DOMContentLoaded", () => load(true));
window.reload = () => load(true);