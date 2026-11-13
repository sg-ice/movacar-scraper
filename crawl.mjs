// Movacar 1-Euro-Finder – automatischer Suchlauf (GitHub Actions)
// Öffnet index.html in einem unsichtbaren Chromium, startet "Jetzt aktualisieren"
// und schreibt den Datenstand nach movacar_daten.json. Die Suchlogik ist damit
// exakt dieselbe wie auf der Webseite.
import { chromium } from "playwright";
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const OUT = path.join(ROOT, "movacar_daten.json");
const TIMEOUT_MIN = Number(process.env.CRAWL_TIMEOUT_MIN || 50);
const COUNTRY = process.env.CRAWL_COUNTRY || "INT"; // INT = alle Länder außer DE
const API = "https://crowd-api-production-615013621295.europe-west1.run.app";
const API_OVERRIDE = process.env.MOVACAR_API_OVERRIDE || ""; // nur für Tests
const GEO_OVERRIDE = process.env.GEO_API_OVERRIDE || "";     // nur für Tests

// Minimaler Webserver für index.html und den bisherigen Datenstand
const TYPES = { ".html": "text/html; charset=utf-8", ".json": "application/json" };
const server = http.createServer(async (req, res) => {
  const name = decodeURIComponent(new URL(req.url, "http://x").pathname).replace(/^\/+/, "") || "index.html";
  if (!["index.html", "movacar_daten.json"].includes(name)) { res.writeHead(404).end(); return; }
  try {
    const body = await fs.readFile(path.join(ROOT, name));
    res.writeHead(200, { "content-type": TYPES[path.extname(name)] || "application/octet-stream" }).end(body);
  } catch { res.writeHead(404).end(); }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;

let previousCount = 0;
try { previousCount = JSON.parse(await fs.readFile(OUT, "utf8")).offers?.items?.length || 0; } catch {}

const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
const page = await browser.newPage();
page.on("pageerror", (e) => console.error("Seitenfehler:", e.message));
// Kartenbibliothek und Kacheln werden für den Lauf nicht gebraucht
await page.route(/unpkg\.com|tile\.openstreetmap\.org/, (r) => r.abort());
async function forward(route, base, target) {
  try {
    const resp = await fetch(target + route.request().url().slice(base.length));
    await route.fulfill({ status: resp.status, body: Buffer.from(await resp.arrayBuffer()),
      headers: { "content-type": "application/json", "access-control-allow-origin": "*" } });
  } catch { await route.abort().catch(() => {}); }
}
if (API_OVERRIDE) await page.route(API + "/**", (r) => forward(r, API, API_OVERRIDE));
if (GEO_OVERRIDE) await page.route("https://geocoding-api.open-meteo.com/**", (r) => forward(r, "https://geocoding-api.open-meteo.com", GEO_OVERRIDE));

const t0 = Date.now();
await page.goto(`http://127.0.0.1:${port}/index.html`);
await page.waitForFunction(() => typeof run === "function" && typeof buildSnapshot === "function");
await page.waitForTimeout(1500); // bisherigen Datenstand laden lassen

await page.evaluate((cc) => {
  const sel = document.getElementById("sCountry");
  sel.value = cc; sel.dispatchEvent(new Event("change"));
  document.getElementById("sReturns").checked = true;
  return run();
}, COUNTRY).catch(() => {});

process.on("unhandledRejection", (e) => { console.error("Abbruch:", e?.message || e); process.exit(1); });
await page.waitForFunction(() => {
  const s = document.getElementById("status").textContent;
  return s.startsWith("Fertig") || s.startsWith("Fehler") || s.startsWith("Abgebrochen");
}, null, { timeout: TIMEOUT_MIN * 60e3, polling: 2000 });

const status = await page.textContent("#status");
const errors = await page.$$eval("#log .err", (els) => els.map((e) => e.textContent).slice(0, 20));
const snap = await page.evaluate(() => buildSnapshot());
await browser.close();
server.close();

const count = snap.offers?.items?.length || 0;
const minutes = ((Date.now() - t0) / 60e3).toFixed(1);
console.log(`Status: ${status}`);
console.log(`Dauer: ${minutes} min, Angebote: ${count} (vorher ${previousCount})`);
if (errors.length) console.log("Fehler im Protokoll:\n  " + errors.join("\n  "));

// Schutz: keinen guten Datenstand durch einen kaputten Lauf überschreiben
if (!status.startsWith("Fertig")) { console.error("Lauf nicht vollständig – Datenstand bleibt unverändert."); process.exit(1); }
if (count === 0 && previousCount > 0) { console.error("0 Angebote – vermutlich blockiert oder API geändert. Datenstand bleibt unverändert."); process.exit(1); }

await fs.writeFile(OUT, JSON.stringify(snap));
console.log(`Geschrieben: movacar_daten.json (${(JSON.stringify(snap).length / 1024).toFixed(0)} KB)`);
