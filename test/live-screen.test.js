const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fsp = require("node:fs/promises");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const rootDir = path.resolve(__dirname, "..");

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test("Live Screen captures only when a frame is requested", async (context) => {
  const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), "marina-live-screen-test-"));
  const script = `
    const { setLiveScreenCaptureProvider, startServer, stopServer } = require("./server");
    let captureCount = 0;
    setLiveScreenCaptureProvider(async () => {
      captureCount += 1;
      process.stdout.write("CAPTURE_COUNT=" + captureCount + "\\n");
      return {
        frame: Buffer.from("JPEG_FRAME_" + captureCount),
        pointer: { visible: true, x: 0.25, y: 0.5, width: 0.02, height: 0.04 }
      };
    });
    process.on("message", async (message) => {
      if (message !== "stop") return;
      await stopServer();
      process.exit(0);
    });
    startServer({ host: "127.0.0.1", port: 0 })
      .then(({ port }) => process.stdout.write("ACTIVE_PORT=" + port + "\\n"))
      .catch((error) => {
        console.error(error);
        process.exit(1);
      });
  `;
  const child = spawn(process.execPath, ["--no-warnings", "-e", script], {
    cwd: rootDir,
    env: {
      ...process.env,
      MARINA_DATA_DIR: path.join(tempDir, "data"),
      MARINA_RUNTIME_DIR: path.join(tempDir, "runtime")
    },
    stdio: ["ignore", "pipe", "pipe", "ipc"]
  });

  let output = "";
  let captureCount = 0;
  let resolvePort;
  let rejectPort;
  const portPromise = new Promise((resolve, reject) => {
    resolvePort = resolve;
    rejectPort = reject;
  });
  const collectOutput = (chunk) => {
    output += chunk;
    const portMatch = output.match(/ACTIVE_PORT=(\d+)/);
    if (portMatch) resolvePort(Number(portMatch[1]));
    const captures = [...output.matchAll(/CAPTURE_COUNT=(\d+)/g)];
    captureCount = captures.length ? Number(captures.at(-1)[1]) : 0;
  };
  child.stdout.on("data", collectOutput);
  child.stderr.on("data", collectOutput);
  child.once("close", (code) => {
    if (!/ACTIVE_PORT=/.test(output)) rejectPort(new Error(`Live Screen test server exited with ${code}: ${output}`));
  });

  context.after(async () => {
    if (child.exitCode === null) {
      child.send("stop");
      await Promise.race([new Promise((resolve) => child.once("exit", resolve)), wait(2000)]);
    }
    if (child.exitCode === null) child.kill();
    await fsp.rm(tempDir, { recursive: true, force: true });
  });

  const port = await Promise.race([
    portPromise,
    wait(5000).then(() => { throw new Error(`Timed out starting Live Screen test server: ${output}`); })
  ]);
  const baseUrl = `http://127.0.0.1:${port}`;

  const pageResponse = await fetch(`${baseUrl}/screen`);
  assert.equal(pageResponse.status, 200);
  assert.match(await pageResponse.text(), /<h1>Live Screen<\/h1>/);

  await wait(400);
  assert.equal(captureCount, 0, "opening the server must not start capture work");

  const frameResponse = await fetch(`${baseUrl}/api/live-screen/frame`);
  assert.equal(frameResponse.status, 200);
  assert.equal(frameResponse.headers.get("content-type"), "image/jpeg");
  assert.equal(frameResponse.headers.get("x-live-screen-pointer-visible"), "1");
  assert.equal(frameResponse.headers.get("x-live-screen-pointer-x"), "0.250000");
  assert.equal(frameResponse.headers.get("x-live-screen-pointer-y"), "0.500000");
  assert.equal(frameResponse.headers.get("x-live-screen-pointer-width"), "0.020000");
  assert.equal(frameResponse.headers.get("x-live-screen-pointer-height"), "0.040000");
  assert.equal(await frameResponse.text(), "JPEG_FRAME_1");
  assert.equal(captureCount, 1);

  await wait(500);
  assert.equal(captureCount, 1, "the server must not run a background capture loop");
});

test("Live Screen client stops polling when hidden or closed and has no control channel", () => {
  const screenSource = fs.readFileSync(path.join(rootDir, "screen.js"), "utf8");
  const screenMarkup = fs.readFileSync(path.join(rootDir, "screen.html"), "utf8");
  const electronSource = fs.readFileSync(path.join(rootDir, "electron-main.js"), "utf8");

  assert.match(screenSource, /visibilitychange/);
  assert.match(screenSource, /pagehide/);
  assert.match(screenSource, /frameRequest\?\.abort\(\)/);
  assert.doesNotMatch(screenSource, /setInterval\s*\(/);
  assert.doesNotMatch(screenSource, /pin|session|cookie|login/i);
  assert.doesNotMatch(screenMarkup, /pin|password|login/i);
  assert.doesNotMatch(screenSource, /WebSocket|RTCPeerConnection|mousemove|keydown|pointermove/);
  assert.match(screenSource, /X-Live-Screen-Pointer-Visible/);
  assert.match(screenSource, /setAttribute\("x"/);
  assert.doesNotMatch(screenSource, /screenPointer\.style\.(?:left|top|width|height)/);
  assert.match(screenMarkup, /id="screenPointer"/);
  assert.match(electronSource, /mainWindow\.webContents\.capturePage\(\)/);
  assert.match(electronSource, /screen\.getCursorScreenPoint\(\)/);
  assert.doesNotMatch(electronSource, /desktopCapturer/);

  for (const filename of ["electron-builder.yml", "scripts/New-MarinaParkRelease.ps1"]) {
    const releaseSource = fs.readFileSync(path.join(rootDir, filename), "utf8");
    assert.match(releaseSource, /screen\.html/);
    assert.match(releaseSource, /screen\.css/);
    assert.match(releaseSource, /screen\.js/);
  }
});
