const { app, BrowserWindow, dialog, shell, screen } = require("electron");
const fsp = require("fs/promises");
const path = require("path");
const { copyMissingFiles, pathExists } = require("./persistent-files");

app.setName("Marina Park");

const COMPACT_UI_SCALE = 0.92;

let mainWindow = null;
let serverController = null;
let updateTimer = null;

function syncWindowZoom() {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  const display = screen.getDisplayMatching(mainWindow.getBounds());
  const displayScale = Math.max(display.scaleFactor || 1, 0.25);
  const zoomFactor = Number((COMPACT_UI_SCALE / displayScale).toFixed(4));
  if (Math.abs(mainWindow.webContents.getZoomFactor() - zoomFactor) < 0.0001) return;

  mainWindow.webContents.setZoomFactor(zoomFactor);
}

function bundledCustomDefaultsPath() {
  return app.isPackaged
    ? path.join(process.resourcesPath, "custom-defaults")
    : path.join(__dirname, "custom-defaults");
}

async function legacyInstallCandidates(userDataDir) {
  const markerPath = path.join(userDataDir, "legacy-install-path.txt");
  const candidates = [process.cwd(), __dirname, path.dirname(process.execPath)];

  try {
    candidates.unshift((await fsp.readFile(markerPath, "utf8")).trim());
  } catch {
    // No installer migration marker is normal on a clean installation.
  }

  return {
    markerPath,
    candidates: [...new Set(candidates.filter(Boolean).map((candidate) => path.resolve(candidate)))]
  };
}

async function migrateLegacyFiles(userDataDir, dataDir, customDir) {
  const databasePath = path.join(dataDir, "marina-park.sqlite");
  if (await pathExists(databasePath)) return;

  const { markerPath, candidates } = await legacyInstallCandidates(userDataDir);
  for (const candidate of candidates) {
    const legacyDataDir = path.join(candidate, "data");
    if (!(await pathExists(path.join(legacyDataDir, "marina-park.sqlite")))) continue;

    await copyMissingFiles(legacyDataDir, dataDir);
    await copyMissingFiles(path.join(candidate, "custom"), customDir);
    await fsp.rm(markerPath, { force: true });
    return;
  }
}

async function chooseLegacyFolderIfNeeded(dataDir, customDir) {
  if (!app.isPackaged || (await pathExists(path.join(dataDir, "marina-park.sqlite")))) return;

  const answer = await dialog.showMessageBox({
    type: "question",
    title: "Date Marina Park",
    message: "Ai deja o instalare Marina Park cu date salvate?",
    detail: "Poți alege folderul vechi pentru a copia baza de date. Fișierele existente nu vor fi modificate.",
    buttons: ["Alege folderul vechi", "Pornește cu bază nouă"],
    defaultId: 0,
    cancelId: 1,
    noLink: true
  });
  if (answer.response !== 0) return;

  const selection = await dialog.showOpenDialog({ properties: ["openDirectory"] });
  if (selection.canceled || !selection.filePaths[0]) return;
  const selectedDir = selection.filePaths[0];
  const sourceDataDir = path.join(selectedDir, "data");
  if (!(await pathExists(path.join(sourceDataDir, "marina-park.sqlite")))) {
    await dialog.showMessageBox({
      type: "warning",
      title: "Folder invalid",
      message: "Folderul ales nu conține data\\marina-park.sqlite."
    });
    return;
  }

  await copyMissingFiles(sourceDataDir, dataDir);
  await copyMissingFiles(path.join(selectedDir, "custom"), customDir);
}

async function createWindow(url, customDir) {
  const applicationOrigin = new URL(url).origin;
  const workArea = screen.getPrimaryDisplay().workAreaSize;
  mainWindow = new BrowserWindow({
    width: Math.min(1500, workArea.width),
    height: Math.min(960, workArea.height),
    minWidth: Math.min(1100, workArea.width),
    minHeight: Math.min(700, workArea.height),
    show: false,
    backgroundColor: "#f4f6f8",
    icon: path.join(__dirname, "assets", "marina-park.ico"),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.setMenuBarVisibility(false);
  syncWindowZoom();
  mainWindow.on("move", syncWindowZoom);
  mainWindow.webContents.on("did-finish-load", syncWindowZoom);
  screen.on("display-metrics-changed", syncWindowZoom);
  mainWindow.once("ready-to-show", () => mainWindow?.show());
  mainWindow.webContents.setWindowOpenHandler(({ url: targetUrl }) => {
    if (/^https?:\/\//i.test(targetUrl)) void shell.openExternal(targetUrl);
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, targetUrl) => {
    if (new URL(targetUrl).origin === applicationOrigin) return;
    event.preventDefault();
    if (/^https?:\/\//i.test(targetUrl)) void shell.openExternal(targetUrl);
  });
  mainWindow.on("closed", () => {
    screen.removeListener("display-metrics-changed", syncWindowZoom);
    mainWindow = null;
  });

  await fsp.mkdir(customDir, { recursive: true });
  await mainWindow.loadURL(url);
}

function setupAutoUpdater() {
  if (!app.isPackaged) return;

  const { autoUpdater } = require("electron-updater");
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on("error", (error) => console.error("Auto-update failed:", error.message));
  autoUpdater.on("update-downloaded", async (info) => {
    const answer = await dialog.showMessageBox(mainWindow, {
      type: "info",
      title: "Actualizare Marina Park",
      message: `Versiunea ${info.version} este pregătită.`,
      detail: "Datele, backupurile și fișierele personalizate rămân neschimbate.",
      buttons: ["Repornește și instalează", "Instalează la închidere"],
      defaultId: 0,
      cancelId: 1,
      noLink: true
    });
    if (answer.response === 0) autoUpdater.quitAndInstall(false, true);
  });

  const check = () => autoUpdater.checkForUpdatesAndNotify().catch((error) => {
    console.error("Update check failed:", error.message);
  });
  setTimeout(check, 5000).unref?.();
  updateTimer = setInterval(check, 4 * 60 * 60 * 1000);
  updateTimer.unref?.();
}

async function startApplication() {
  const userDataDir = app.getPath("userData");
  const dataDir = path.join(userDataDir, "data");
  const customDir = path.join(userDataDir, "custom");
  const runtimeDir = path.join(userDataDir, "runtime");

  await fsp.mkdir(userDataDir, { recursive: true });
  await migrateLegacyFiles(userDataDir, dataDir, customDir);
  await chooseLegacyFolderIfNeeded(dataDir, customDir);
  await copyMissingFiles(bundledCustomDefaultsPath(), customDir);

  process.env.MARINA_APP_ROOT = __dirname;
  process.env.MARINA_DATA_DIR = dataDir;
  process.env.MARINA_RUNTIME_DIR = runtimeDir;

  serverController = require("./server");
  const { url } = await serverController.startServer({ host: "0.0.0.0", localHost: "127.0.0.1", port: 4173, portAttempts: 100 });
  await createWindow(url, customDir);
  setupAutoUpdater();
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });

  app.whenReady().then(startApplication).catch(async (error) => {
    console.error(error);
    await dialog.showMessageBox({
      type: "error",
      title: "Marina Park nu a pornit",
      message: error.message || String(error)
    });
    app.quit();
  });
}

app.on("window-all-closed", () => app.quit());
app.on("before-quit", () => {
  if (updateTimer) clearInterval(updateTimer);
  void serverController?.stopServer();
});
