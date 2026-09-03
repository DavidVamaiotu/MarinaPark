const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");

test("SAGA bar export asks for exactly one XML or PDF format", () => {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

  assert.match(html, /name="format" type="radio" value="xml" required/);
  assert.match(html, /name="format" type="radio" value="pdf" required/);
  assert.match(
    app,
    /const endpoint =\s*format === "pdf" \? "\/api\/saga\/bar-sales\.pdf" : "\/api\/saga\/bar-sales";/,
  );
  assert.match(app, /setSagaExportBusy\(true, format\)/);
  assert.match(app, /error\?\.name === "AbortError"/);
});

test("PDF report contains readable sales columns, totals, wrapping, and pagination support", () => {
  const server = fs.readFileSync(path.join(root, "server.js"), "utf8");
  const electron = fs.readFileSync(path.join(root, "electron-main.js"), "utf8");

  assert.match(server, /Produse vândute/);
  assert.match(server, /Produs \/ cod articol/);
  assert.match(server, /Cantitate totală/);
  assert.match(server, /Preț unitar/);
  assert.match(server, /Valoare totală/);
  assert.match(server, /WHERE method <> 'voucher'/);
  assert.match(server, /Vânzările achitate cu voucher nu sunt incluse/);
  assert.match(server, /overflow-wrap: anywhere/);
  assert.match(server, /thead \{ display: table-header-group; \}/);
  const xmlBuilder = server.match(
    /function buildSagaBarSalesXml\(options = \{\}\) \{[\s\S]*?\n\}\n\nfunction htmlEscape/,
  )?.[0];
  const pdfBuilder = server.match(
    /async function buildSagaBarSalesPdf\(options = \{\}\) \{[\s\S]*?\n\}/,
  )?.[0];
  assert.ok(xmlBuilder);
  assert.ok(pdfBuilder);
  assert.doesNotMatch(xmlBuilder, /markBarExportLinesExported/);
  assert.doesNotMatch(pdfBuilder, /markBarExportLinesExported/);
  assert.match(electron, /displayHeaderFooter: true/);
  assert.match(electron, /class="pageNumber"/);
  assert.match(electron, /class="totalPages"/);
});

test("existing SAGA XML route and content type remain unchanged", () => {
  const server = fs.readFileSync(path.join(root, "server.js"), "utf8");

  assert.match(
    server,
    /buildSagaBarSalesXml\(\s*Object\.fromEntries\(url\.searchParams\.entries\(\)\),?\s*\)/,
  );
  assert.match(server, /"Content-Type": "application\/xml; charset=utf-8"/);
  assert.match(server, /response\.end\(result\.xml\)/);
});
