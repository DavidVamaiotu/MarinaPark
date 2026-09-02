const { app, BrowserWindow, dialog, safeStorage, shell, screen } = require("electron");
const fsp = require("fs/promises");
const fsSync = require("fs");
const { execFileSync } = require("child_process");
const path = require("path");
const { copyMissingFiles, pathExists } = require("./persistent-files");

app.setName("Marina Park");
if (process.platform === "linux") app.commandLine.appendSwitch("password-store", "gnome-libsecret");

const COMPACT_UI_SCALE = 0.92;

let mainWindow = null;
let serverController = null;
let updateTimer = null;
const marinaOAuthProtocol = "ro.marinapark.booking.desktop";
const pendingOAuthUrls = [];

function oauthUrlFromArgs(args = []) {
  return args.find((value) => String(value).startsWith(`${marinaOAuthProtocol}://`)) || null;
}

function registerDesktopOAuthProtocol() {
  try {
    if (app.isPackaged) app.setAsDefaultProtocolClient(marinaOAuthProtocol);
    else app.setAsDefaultProtocolClient(marinaOAuthProtocol, process.execPath, [path.resolve(__dirname), "%u"]);
  } catch (error) {
    console.error("Marina OAuth protocol registration failed:", error.message);
  }
  if (process.platform !== "linux") return;
  try {
    const applicationsDirectory = path.join(app.getPath("home"), ".local", "share", "applications");
    const desktopFile = path.join(applicationsDirectory, "marina-park-oauth.desktop");
    const projectArgument = app.isPackaged ? "" : ` ${JSON.stringify(__dirname)}`;
    const contents = [
      "[Desktop Entry]",
      "Type=Application",
      "Name=Marina Park OAuth",
      "NoDisplay=true",
      `Exec=${JSON.stringify(process.execPath)}${projectArgument} %u`,
      "Terminal=false",
      `MimeType=x-scheme-handler/${marinaOAuthProtocol};`,
      "Categories=Office;",
      ""
    ].join("\n");
    fsSync.mkdirSync(applicationsDirectory, { recursive: true });
    const temporaryFile = `${desktopFile}.${process.pid}.tmp`;
    fsSync.writeFileSync(temporaryFile, contents, { mode: 0o644 });
    fsSync.renameSync(temporaryFile, desktopFile);
    try { execFileSync("update-desktop-database", [applicationsDirectory], { stdio: "ignore" }); } catch {}
    try { execFileSync("xdg-mime", ["default", path.basename(desktopFile), `x-scheme-handler/${marinaOAuthProtocol}`], { stdio: "ignore" }); } catch {}
  } catch (error) {
    console.error("Marina OAuth Linux protocol registration failed:", error.message);
  }
}

function createMarinaOAuthStorage(userDataDir) {
  const tokenPath = path.join(userDataDir, "marina-oauth-refresh-token.bin");
  const ensureSecureStorage = () => {
    if (!safeStorage.isEncryptionAvailable() || safeStorage.getSelectedStorageBackend?.() === "basic_text") {
      const error = new Error("Conectarea Marina necesită stocarea securizată a sistemului.");
      error.code = "marina_secure_storage_unavailable";
      throw error;
    }
  };
  return {
    hasRefreshTokenSync() {
      try {
        ensureSecureStorage();
        return Boolean(safeStorage.decryptString(fsSync.readFileSync(tokenPath)));
      } catch {
        return false;
      }
    },
    async getRefreshToken() {
      ensureSecureStorage();
      try {
        return safeStorage.decryptString(await fsp.readFile(tokenPath));
      } catch {
        return "";
      }
    },
    async setRefreshToken(value) {
      ensureSecureStorage();
      await fsp.writeFile(tokenPath, safeStorage.encryptString(String(value || "")), { mode: 0o600 });
      await fsp.chmod(tokenPath, 0o600);
    },
    async clearRefreshToken() {
      await fsp.rm(tokenPath, { force: true });
    }
  };
}

function focusMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

async function handleOAuthUrl(url) {
  if (!url) return;
  if (!serverController) {
    pendingOAuthUrls.push(url);
    return;
  }
  try {
    await serverController.handleMarinaOAuthCallback(url);
    focusMainWindow();
  } catch (error) {
    console.error("Marina OAuth callback failed:", error.code || error.message);
    focusMainWindow();
  }
}

function syncWindowZoom() {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  const display = screen.getDisplayMatching(mainWindow.getBounds());
  const displayScale = Math.max(display.scaleFactor || 1, 0.25);
  const zoomFactor = Number((COMPACT_UI_SCALE / displayScale).toFixed(4));
  if (Math.abs(mainWindow.webContents.getZoomFactor() - zoomFactor) < 0.0001) return;

  mainWindow.webContents.setZoomFactor(zoomFactor);
}

async function captureMainWindowJpeg() {
  if (!mainWindow || mainWindow.isDestroyed() || mainWindow.webContents.isDestroyed()) {
    throw new Error("Fereastra Marina Park nu este disponibilă");
  }
  const image = await mainWindow.webContents.capturePage();
  if (image.isEmpty()) throw new Error("Fereastra Marina Park nu poate fi capturată momentan");
  const bounds = mainWindow.getContentBounds();
  const pointer = screen.getCursorScreenPoint();
  const pointerVisible =
    bounds.width > 0 && bounds.height > 0 &&
    pointer.x >= bounds.x && pointer.x < bounds.x + bounds.width && pointer.y >= bounds.y && pointer.y < bounds.y + bounds.height;
  return {
    frame: image.toJPEG(68),
    pointer: {
      visible: pointerVisible,
      x: pointerVisible ? Math.max(0, Math.min(1, (pointer.x - bounds.x) / bounds.width)) : 0,
      y: pointerVisible ? Math.max(0, Math.min(1, (pointer.y - bounds.y) / bounds.height)) : 0,
      width: bounds.width > 0 ? 18 / bounds.width : 0,
      height: bounds.height > 0 ? 26 / bounds.height : 0
    }
  };
}

async function renderHtmlToPdf(html) {
  const reportWindow = new BrowserWindow({
    show: false,
    backgroundColor: "#ffffff",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false
    }
  });

  try {
    const reportUrl = `data:text/html;base64,${Buffer.from(String(html || ""), "utf8").toString("base64")}`;
    await reportWindow.loadURL(reportUrl);
    await reportWindow.webContents.executeJavaScript("document.fonts.ready");
    return await reportWindow.webContents.printToPDF({
      pageSize: "A4",
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: "<div></div>",
      footerTemplate: `
        <div style="width:100%; padding:0 12mm; color:#667085; font:9px Arial, sans-serif; text-align:right;">
          Pagina <span class="pageNumber"></span> din <span class="totalPages"></span>
        </div>`,
      margins: { top: 0.5, bottom: 0.55, left: 0.5, right: 0.5 }
    });
  } finally {
    if (!reportWindow.isDestroyed()) reportWindow.destroy();
  }
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

  registerDesktopOAuthProtocol();
  serverController = require("./server");
  serverController.setMarinaOAuthStorage(createMarinaOAuthStorage(userDataDir));
  const { url } = await serverController.startServer({ host: "0.0.0.0", localHost: "127.0.0.1", port: 4173, portAttempts: 100 });
  await createWindow(url, customDir);
  for (const oauthUrl of pendingOAuthUrls.splice(0)) await handleOAuthUrl(oauthUrl);
  serverController.setLiveScreenCaptureProvider(captureMainWindowJpeg);
  serverController.setPdfRenderProvider(renderHtmlToPdf);
  setupAutoUpdater();
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on("open-url", (event, url) => {
    event.preventDefault();
    void handleOAuthUrl(url);
  });
  app.on("second-instance", (_event, commandLine) => {
    void handleOAuthUrl(oauthUrlFromArgs(commandLine));
    focusMainWindow();
  });
  const initialOAuthUrl = oauthUrlFromArgs(process.argv);
  if (initialOAuthUrl) pendingOAuthUrls.push(initialOAuthUrl);

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
  serverController?.setLiveScreenCaptureProvider(null);
  void serverController?.stopServer();
});
