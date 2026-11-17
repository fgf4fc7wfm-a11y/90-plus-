const http = require("http");
const fs = require("fs");
const path = require("path");
const PORT = process.env.PORT || 3000;
const ROOT = path.join(__dirname, "public");
const API_BASE = "https://v3.football.api-sports.io";
const API_KEY = process.env.API_FOOTBALL_KEY || "";
const cache = new Map();
const CACHE_MS = 60 * 1000;
function send(res, status, data, type = "application/json; charset=utf-8") { res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store" }); res.end(type.startsWith("application/json") ? JSON.stringify(data) : data); }
async function api(endpoint, params = {}) {
  if (!API_KEY) throw new Error("Clé API absente. Ajoute-la dans le fichier .env.");
  const url = new URL(API_BASE + endpoint);
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") url.searchParams.set(k, v);
  const key = url.toString(), cached = cache.get(key);
  if (cached && Date.now() - cached.time < CACHE_MS) return cached.data;
  const response = await fetch(url, { headers: { "x-apisports-key": API_KEY } });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.errors?.requests || data?.message || `Erreur API (${response.status})`);
  if (data.errors && Object.keys(data.errors).length) throw new Error(JSON.stringify(data.errors));
  cache.set(key, { time: Date.now(), data }); return data;
}
function safePath(urlPath) { const pathname = decodeURIComponent(urlPath.split("?")[0]); const target = path.resolve(ROOT, "." + pathname); return target.startsWith(ROOT) ? target : path.join(ROOT, "index.html"); }
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname.startsWith("/api/")) {
    try {
      let data;
      if (url.pathname === "/api/status") { if (!API_KEY) return send(res, 200, { configured: false, message: "Clé API non configurée." }); data = await api("/status"); }
      else if (url.pathname === "/api/fixtures") { const date = url.searchParams.get("date") || new Date().toISOString().slice(0,10); data = await api("/fixtures", { date, timezone: "Europe/Paris" }); }
      else if (url.pathname === "/api/live") data = await api("/fixtures", { live: "all", timezone: "Europe/Paris" });
      else if (url.pathname === "/api/leagues") data = await api("/leagues", { current: "true" });
      else if (url.pathname === "/api/standings") { const league = url.searchParams.get("league"), season = url.searchParams.get("season"); if (!league || !season) return send(res, 400, { error: "Il manque la compétition ou la saison." }); data = await api("/standings", { league, season }); }
      else if (url.pathname === "/api/teams") { const search = url.searchParams.get("search"); if (!search || search.length < 3) return send(res, 400, { error: "Entre au moins 3 lettres." }); data = await api("/teams", { search }); }
      else return send(res, 404, { error: "Route API inconnue." });
      return send(res, 200, data);
    } catch (e) { return send(res, 500, { error: e.message || "Erreur serveur." }); }
  }
  const file = safePath(url.pathname === "/" ? "/index.html" : url.pathname);
  fs.readFile(file, (err, content) => { if (err) return send(res, 404, "Page introuvable", "text/plain; charset=utf-8"); const ext = path.extname(file); const types = { ".html":"text/html; charset=utf-8", ".css":"text/css; charset=utf-8", ".js":"text/javascript; charset=utf-8", ".svg":"image/svg+xml" }; send(res, 200, content, types[ext] || "application/octet-stream"); });
});
server.listen(PORT, () => console.log(`90+ prêt sur http://localhost:${PORT}`));
