const assert = require("node:assert/strict");
const fsp = require("fs/promises");
const os = require("os");
const path = require("path");
const test = require("node:test");
const { copyMissingFiles } = require("../persistent-files");

test("adds missing custom files without replacing existing files", async (context) => {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), "marina-custom-test-"));
  context.after(() => fsp.rm(root, { recursive: true, force: true }));
  const source = path.join(root, "source");
  const destination = path.join(root, "destination");

  await fsp.mkdir(path.join(source, "nested"), { recursive: true });
  await fsp.mkdir(destination, { recursive: true });
  await fsp.writeFile(path.join(source, "existing.txt"), "release content");
  await fsp.writeFile(path.join(source, "new.txt"), "new content");
  await fsp.writeFile(path.join(source, "nested", "nested.txt"), "nested content");
  await fsp.writeFile(path.join(destination, "existing.txt"), "user content");

  await copyMissingFiles(source, destination);

  assert.equal(await fsp.readFile(path.join(destination, "existing.txt"), "utf8"), "user content");
  assert.equal(await fsp.readFile(path.join(destination, "new.txt"), "utf8"), "new content");
  assert.equal(await fsp.readFile(path.join(destination, "nested", "nested.txt"), "utf8"), "nested content");
});
