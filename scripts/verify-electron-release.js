const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const outputDir = path.resolve(process.argv[2] || "dist-electron");
const expectedVersion = process.argv[3] || "";
const metadataPath = path.join(outputDir, "latest.yml");
const metadata = fs.readFileSync(metadataPath, "utf8");
const releaseVersion = metadata.match(/^version:\s*["']?([^\s"']+)/m)?.[1]?.trim();
const installerName = metadata.match(/^path:\s*(.+)$/m)?.[1]?.trim();
const expectedSha512 = metadata.match(/^sha512:\s*(.+)$/m)?.[1]?.trim();
const expectedSize = Number(metadata.match(/^\s+size:\s*(\d+)$/m)?.[1]);

if (!installerName || !expectedSha512 || !expectedSize) {
  throw new Error("latest.yml nu conține installerul, dimensiunea și SHA-512 necesare.");
}
if (expectedVersion && releaseVersion !== expectedVersion) {
  throw new Error(`Versiune release invalidă: ${releaseVersion || "lipsește"}, așteptat ${expectedVersion}.`);
}

const installerPath = path.join(outputDir, installerName);
const blockmapPath = `${installerPath}.blockmap`;
const installer = fs.readFileSync(installerPath);
const actualSha512 = crypto.createHash("sha512").update(installer).digest("base64");

if (installer.length !== expectedSize) {
  throw new Error(`Dimensiune installer invalidă: ${installer.length}, așteptat ${expectedSize}.`);
}
if (actualSha512 !== expectedSha512) {
  throw new Error("SHA-512 installer nu corespunde cu latest.yml.");
}
if (!fs.statSync(blockmapPath).isFile()) {
  throw new Error("Lipsește blockmap-ul pentru update diferențial.");
}

console.log(`Release verificat: ${installerName} (${installer.length} bytes)`);
