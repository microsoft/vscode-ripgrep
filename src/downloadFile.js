import { createWriteStream } from "fs";
import { mkdir } from "fs/promises";
import got from "got";
import { dirname } from "path";
import pathExists from "path-exists";
import { pipeline } from "stream/promises";
import VError from "verror";

export const downloadFile = async (url, outFile) => {
  try {
    await mkdir(dirname(outFile), { recursive: true });
    await pipeline(got.stream(url), createWriteStream(outFile));
  } catch (error) {
    throw new VError(error, `Failed to download ${url}`);
  }
};

export const downloadFileOrUseCache = async (url, outFile) => {
  if (await pathExists(outFile)) {
    console.info(`File ${outFile} has been cached`);
    return;
  }
  await downloadFile(url, outFile);
};
