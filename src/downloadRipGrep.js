import { execa } from "execa";
import extractZip from "extract-zip";
import { createWriteStream } from "fs";
import { mkdir, rename } from "fs/promises";
import got from "got";
import * as os from "os";
import { dirname, join } from "path";
import { pathExists } from "path-exists";
import { pipeline } from "stream/promises";
import { temporaryFile } from "tempy";
import { fileURLToPath } from "url";
import VError from "verror";
import { xdgCache } from "xdg-basedir";

const __dirname = dirname(fileURLToPath(import.meta.url));

const VERSION = process.env.RIPGREP_VERSION || "v13.0.0-4";
console.log({ VERSION });
const BIN_PATH = join(__dirname, "../bin");

const getTarget = () => {
  const arch = process.env.npm_config_arch || os.arch();
  const platform = process.env.platform || os.platform();
  switch (platform) {
    case "darwin":
      switch (arch) {
        case "arm64":
          return "aarch64-apple-darwin.tar.gz";
        default:
          return "x86_64-apple-darwin.tar.gz";
      }
    case "win32":
      switch (arch) {
        case "x64":
          return "x86_64-pc-windows-msvc.zip";
        case "arm":
          return "aarch64-pc-windows-msvc.zip";
        default:
          return "i686-pc-windows-msvc.zip";
      }
    case "linux":
      switch (arch) {
        case "x64":
          return "x86_64-unknown-linux-musl.tar.gz";
        case "arm":
        case "armv7l":
          return "arm-unknown-linux-gnueabihf.tar.gz";
        case "arm64":
          return "aarch64-unknown-linux-gnu.tar.gz";
        case "ppc64":
          return "powerpc64le-unknown-linux-gnu.tar.gz";
        case "s390x":
          return "s390x-unknown-linux-gnu.tar.gz";
        default:
          return "i686-unknown-linux-musl.tar.gz";
      }
    default:
      throw new VError("Unknown platform: " + platform);
  }
};

export const downloadFile = async (url, outFile) => {
  try {
    const tmpFile = temporaryFile();
    await pipeline(got.stream(url), createWriteStream(tmpFile));
    await mkdir(dirname(outFile), { recursive: true });
    await rename(tmpFile, outFile);
  } catch (error) {
    throw new VError(error, `Failed to download "${url}"`);
  }
};

/**
 * @param {string} inFile
 * @param {string} outDir
 */
const unzip = async (inFile, outDir) => {
  try {
    await mkdir(outDir, { recursive: true });
    await extractZip(inFile, { dir: outDir });
  } catch (error) {
    throw new VError(error, `Failed to unzip "${inFile}"`);
  }
};

/**
 * @param {string} inFile
 * @param {string} outDir
 */
const untarGz = async (inFile, outDir) => {
  try {
    await mkdir(outDir, { recursive: true });
    await execa("tar", ["xvf", inFile, "-C", outDir]);
  } catch (error) {
    throw new VError(error, `Failed to extract "${inFile}"`);
  }
};

export const downloadRipGrep = async () => {
  const target = getTarget();
  const url = `https://github.com/microsoft/ripgrep-prebuilt/releases/download/${VERSION}/ripgrep-${VERSION}-${target}`;
  const downloadPath = `${xdgCache}/vscode-ripgrep/ripgrep-${VERSION}-${target}`;
  if (!(await pathExists(downloadPath))) {
    await downloadFile(url, downloadPath);
  } else {
    console.info(`File ${downloadPath} has been cached`);
  }
  if (downloadPath.endsWith(".tar.gz")) {
    await untarGz(downloadPath, BIN_PATH);
  } else if (downloadPath.endsWith(".zip")) {
    await unzip(downloadPath, BIN_PATH);
  } else {
    throw new VError(`Invalid downloadPath ${downloadPath}`);
  }
};
