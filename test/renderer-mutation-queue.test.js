const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

function queueHarness() {
  const source = fs.readFileSync(path.resolve(__dirname, "..", "app.js"), "utf8");
  const start = source.indexOf("function enqueueMutation(");
  const end = source.indexOf("function handleMutationFailure(", start);
  assert.ok(start >= 0 && end > start, "mutation queue source is available");
  const context = vm.createContext({ Promise });
  vm.runInContext(
    `
      let mutationQueuePromise = Promise.resolve();
      let mutationQueueEpoch = 0;
      let localMutationSequence = 0;
      let mutationQueueBlocked = false;
      let lastDatabaseSavedAt = "2026-09-05T10:00:00.000Z";
      ${source.slice(start, end)}
      globalThis.queueApi = {
        enqueueMutation,
        state: () => ({ lastDatabaseSavedAt, localMutationSequence, mutationQueueBlocked }),
      };
    `,
    context,
  );
  return context.queueApi;
}

test("same-window mutations advance only newer queued drafts", async () => {
  const queue = queueHarness();
  const bases = [];
  const first = queue.enqueueMutation(async (baseSavedAt) => {
    bases.push(baseSavedAt);
    await Promise.resolve();
    return { savedAt: "2026-09-05T10:00:00.001Z" };
  });
  const second = queue.enqueueMutation(async (baseSavedAt) => {
    bases.push(baseSavedAt);
    return { savedAt: "2026-09-05T10:00:00.002Z" };
  });
  await Promise.all([first, second]);
  assert.deepEqual(bases, [
    "2026-09-05T10:00:00.000Z",
    "2026-09-05T10:00:00.001Z",
  ]);

  let staleBase = "";
  await queue.enqueueMutation(
    async (baseSavedAt) => {
      staleBase = baseSavedAt;
      return { savedAt: "2026-09-05T10:00:00.003Z" };
    },
    {
      baseSavedAt: "2026-09-05T10:00:00.000Z",
      allowLocalAdvance: false,
    },
  );
  assert.equal(staleBase, "2026-09-05T10:00:00.000Z");
});

test("a stale conflict stops dependent queued mutations", async () => {
  const queue = queueHarness();
  let dependentRan = false;
  const conflict = queue.enqueueMutation(async () => {
    const error = new Error("stale");
    error.code = "STALE_DATA";
    throw error;
  });
  const dependent = queue.enqueueMutation(async () => {
    dependentRan = true;
  });
  await assert.rejects(conflict, { code: "STALE_DATA" });
  await assert.rejects(dependent, { code: "MUTATION_QUEUE_STOPPED" });
  assert.equal(dependentRan, false);
  assert.equal(queue.state().mutationQueueBlocked, true);
});
