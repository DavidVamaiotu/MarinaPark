const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fsp = require("node:fs/promises");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

function listen(server, port = 0) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolve(server.address().port));
  });
}

function close(server) {
  return new Promise((resolve) => server.close(resolve));
}

test("server increments the requested port when it is already occupied", async (context) => {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), "marina-port-test-"));
  const blocker = net.createServer();
  const occupiedPort = await listen(blocker);
  context.after(async () => {
    if (blocker.listening) await close(blocker);
    await fsp.rm(root, { recursive: true, force: true });
  });

  const script = `
    const { startServer, stopServer } = require("./server");
    startServer({ host: "127.0.0.1", port: Number(process.env.TEST_PORT), portAttempts: 2 })
      .then(async ({ port }) => {
        process.stdout.write("ACTIVE_PORT=" + port + "\\n");
        await stopServer();
      })
      .catch((error) => {
        console.error(error);
        process.exitCode = 1;
      });
  `;
  const child = spawn(process.execPath, ["--no-warnings", "-e", script], {
    cwd: path.resolve(__dirname, ".."),
    env: {
      ...process.env,
      TEST_PORT: String(occupiedPort),
      MARINA_DATA_DIR: path.join(root, "data"),
      MARINA_RUNTIME_DIR: path.join(root, "runtime")
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk; });
  child.stderr.on("data", (chunk) => { output += chunk; });
  const exitCode = await new Promise((resolve) => child.once("exit", resolve));

  assert.equal(exitCode, 0, output);
  assert.match(output, new RegExp(`ACTIVE_PORT=${occupiedPort + 1}\\b`));
});
