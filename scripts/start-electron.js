const { spawn } = require("node:child_process");

const electronPath = require("electron").trim();
const electron = spawn(electronPath, ["."], { stdio: "inherit" });

electron.on("error", (error) => {
  console.error(`Electron failed to start: ${error.message}`);
  process.exitCode = 1;
});

electron.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exitCode = code ?? 1;
});
