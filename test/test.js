import { spawn } from "child_process";
import { mkdtemp, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { rgPath } from "../src/index.js";

const getTmpDir = () => {
  return mkdtemp(join(tmpdir(), "foo-"));
};

test("rgPath", async () => {
  const tmpDir = await getTmpDir();
  await writeFile(`${tmpDir}/sample-file.txt`, "sample text");
  const childProcess = spawn(rgPath, ["sample", "."], {
    stdio: "pipe",
    cwd: tmpDir,
  });
  let result = "";
  childProcess.stdout.on("data", (data) => {
    result += data.toString();
  });
  await new Promise((resolve, reject) => {
    childProcess.once("error", reject);
    childProcess.once("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject();
      }
    });
  });
  expect(result).toContain("sample-file.txt:sample text\n");
});
