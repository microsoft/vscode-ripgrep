import { execa } from "execa";
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
  const { stdout } = await execa(rgPath, ["sample", "."], { cwd: tmpDir });
  expect(stdout).toContain("sample-file.txt:sample text");
});
