const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");

async function pathExists(targetPath) {
  try {
    await fsp.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function copyMissingFiles(sourceDir, destinationDir) {
  if (!(await pathExists(sourceDir))) return;
  await fsp.mkdir(destinationDir, { recursive: true });

  for (const entry of await fsp.readdir(sourceDir, { withFileTypes: true })) {
    const sourcePath = path.join(sourceDir, entry.name);
    const destinationPath = path.join(destinationDir, entry.name);
    if (entry.isDirectory()) {
      await copyMissingFiles(sourcePath, destinationPath);
    } else if (entry.isFile() && !(await pathExists(destinationPath))) {
      try {
        await fsp.copyFile(sourcePath, destinationPath, fs.constants.COPYFILE_EXCL);
      } catch (error) {
        if (error.code !== "EEXIST") throw error;
      }
    }
  }
}

module.exports = { copyMissingFiles, pathExists };
