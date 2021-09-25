import { spawn } from "child_process";
import { mkdirSync, writeFileSync } from "fs";
import { rgPath } from "../src/index.js";

mkdirSync("/tmp/myFolder", { recursive: true });
writeFileSync(`/tmp/myFolder/sample-file.txt`, "sample text");

spawn(rgPath, ["sample", "."], {
  stdio: "inherit",
  cwd: "/tmp/myFolder",
});
