# Version Bump Workflow

This monorepo publishes 13 packages in lockstep:

- `@vscode/ripgrep` — the JS wrapper (in [packages/ripgrep/](packages/ripgrep/))
- `@vscode/ripgrep-<os>-<cpu>` — 12 per-platform binary packages (in [packages/](packages/))

All packages share the same version, taken from the root [package.json](package.json).

## Bumping the wrapper version (no ripgrep upgrade)

Use this when you only want to ship a new wrapper revision (e.g. README fix, code change in [packages/ripgrep/lib/index.js](packages/ripgrep/lib/index.js)).

1. Edit `version` in the root [package.json](package.json), e.g. `1.18.0` → `1.18.1`.
2. Run:
   ```sh
   npm run sync-packages
   ```
   This rewrites all 13 `package.json` files (wrapper + 12 platforms) to the new version and refreshes the wrapper's `optionalDependencies`.
3. Commit the changes — every `packages/*/package.json` and the root `package.json` should be in the diff.
4. Push and run the publish pipeline ([build/pipeline.yml](build/pipeline.yml)) with `publishPackage: true`. All 13 packages publish at the same version.

## Bumping the ripgrep binary version

Use this when upgrading to a new upstream [ripgrep-prebuilt](https://github.com/microsoft/ripgrep-prebuilt) release.

1. Edit [build/platforms.js](build/platforms.js):
   - Update `VERSION` (and/or `MULTI_ARCH_VERSION` if applicable).
   - If a platform should pin to a different upstream version, change its `version` field directly.
2. Bump `version` in the root [package.json](package.json) (semver-major or -minor as appropriate, since the binary changed).
3. Refresh the lockfile with the new SHA256 hashes:
   ```sh
   npm run update-lock
   ```
   This downloads every platform's archive, computes its SHA256, and writes [binaries.lock.json](binaries.lock.json). Requires network access to GitHub Releases. Set `GITHUB_TOKEN` to avoid rate limits.
4. Sync the package manifests:
   ```sh
   npm run sync-packages
   ```
5. Commit [binaries.lock.json](binaries.lock.json), [build/platforms.js](build/platforms.js), the root [package.json](package.json), and every regenerated `packages/*/package.json`.
6. Run the publish pipeline.

## Adding a new platform

1. Add an entry to the `platforms` array in [build/platforms.js](build/platforms.js).
2. `npm run update-lock` to populate its SHA256.
3. `npm run sync-packages` to materialize `packages/ripgrep-<os>-<cpu>/`.
4. Add a matching entry to the `npmPackages` array in [build/pipeline.yml](build/pipeline.yml). Copy an existing platform block and substitute the package short name and `--target <triple>`.
5. Bump the root version and commit.

## What CI does

For each of the 13 entries in [build/pipeline.yml](build/pipeline.yml):

- **Wrapper (`ripgrep`)**: runs `sync-packages.js` and publishes [packages/ripgrep/](packages/ripgrep/). No binary download.
- **Platform (`ripgrep-<os>-<cpu>`)**: runs `sync-packages.js`, then `prepare-binaries.js --target <triple>` to download and SHA-verify just that platform's binary, then publishes the package.

`sync-packages.js` is idempotent — running it in CI guarantees published manifests match the committed root version even if a developer forgot to run it locally.

## Local validation before publishing

```sh
# Make sure all manifests are in sync with the root version
npm run sync-packages

# Download the binary for your host platform (example: Windows x64)
node build/prepare-binaries.js --target x86_64-pc-windows-msvc

# Install the workspace and verify the wrapper resolves to the sibling package.
# --force is needed because optional platform deps fail npm's os/cpu check
# for non-host platforms in workspace mode (this is harmless).
npm install --force

node -e "import('@vscode/ripgrep').then(m => console.log(m.rgPath))"
```

The printed path should be inside `packages/ripgrep-<your-os>-<your-cpu>/bin/`.
