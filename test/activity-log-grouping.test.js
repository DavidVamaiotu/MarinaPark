const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const projectRoot = path.resolve(__dirname, "..");

function functionSource(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} exists`);
  const bodyStart = source.indexOf("{", start);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`Could not read ${name}`);
}

test("client actions use one person identity for the whole day", () => {
  const source = fs.readFileSync(path.join(projectRoot, "activity.js"), "utf8");
  const sessionKeySource = functionSource(source, "sessionKey");
  const dailyClientKeySource = functionSource(source, "dailyClientKey");
  const dailyClientKey = new Function(
    "entityLabel",
    `${sessionKeySource}; ${dailyClientKeySource}; return dailyClientKey;`
  )(() => "Client");

  const expected = "person:person-1";
  assert.equal(dailyClientKey({ data: { personId: "person-1" } }), expected);
  assert.equal(dailyClientKey({ data: { editSession: { personId: "person-1" } } }), expected);
  assert.equal(dailyClientKey({ data: { current: { personId: "person-1" } } }), expected);
  assert.equal(dailyClientKey({ data: { previous: { personId: "person-1" } } }), expected);
  assert.equal(dailyClientKey({ data: { stay: { personId: "person-1" } } }), expected);
  assert.equal(
    dailyClientKey(
      { entityType: "client", entityKey: "stay-1", data: {} },
      new Map([["client:stay-1", "person-1"]])
    ),
    expected
  );
});

test("opening a client does not create an activity entry", () => {
  const source = fs.readFileSync(path.join(projectRoot, "app.js"), "utf8");
  const openBookingModalSource = functionSource(source, "openBookingModal");
  assert.doesNotMatch(openBookingModalSource, /eventType:\s*"open"/);
});
