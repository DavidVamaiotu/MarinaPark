const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const source = fs.readFileSync(path.resolve(__dirname, "..", "app.js"), "utf8");

function functionSource(name, nextName) {
  const start = source.indexOf(`function ${name}(`);
  const end = source.indexOf(`function ${nextName}(`, start);
  assert.ok(start >= 0, `${name} exists`);
  assert.ok(end > start, `${name} has a readable boundary`);
  return source.slice(start, end);
}

test("unpaid client reservations are blocked before deletion confirmation", () => {
  const deleteClientSource = functionSource("deleteClient", "timelineDateFromPointer");
  const paidGuard = deleteClientSource.indexOf("if (!isStayFullyPaid(stay))");
  const confirmation = deleteClientSource.indexOf("window.appDialog.confirm");

  assert.ok(paidGuard >= 0, "client deletion checks the shared paid marker");
  assert.ok(paidGuard < confirmation, "the paid check runs before deletion confirmation");
  assert.match(deleteClientSource, /Rezervarea trebuie marcată ca plătită înainte de ștergere\./);
});

test("the paid deletion guard does not affect stationing deletion", () => {
  const deleteStationingSource = functionSource("deleteStationing", "refreshIcons");
  assert.doesNotMatch(deleteStationingSource, /isStayFullyPaid|marcată ca plătită/);
});
