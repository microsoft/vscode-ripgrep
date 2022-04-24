import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const rgPath = join(
  __dirname,
  "..",
  "bin",
  `rg${process.platform === "win32" ? ".exe" : ""}`
);
