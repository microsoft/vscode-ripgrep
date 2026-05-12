# vscode-ripgrep

This is an npm module for using [ripgrep](https://github.com/BurntSushi/ripgrep) in a Node project. It's used by VS Code.

## How it works

- Ripgrep is built in [microsoft/ripgrep-prebuilt](https://github.com/microsoft/ripgrep-prebuilt) and published as release assets for each tag.
- At publish time, the binaries for every supported platform are downloaded by `build/prepare-binaries.js`, verified against `binaries.lock.json` (SHA256), and placed under `bin/<target>/rg[.exe]`. They ship inside the npm tarball.
- At runtime, `lib/index.js` resolves `rgPath` from `process.platform`/`process.arch` to the correct `bin/<target>/<binary>`.
- There is no `postinstall` step and no runtime network access.

### Usage example

```js
const { rgPath } = require('@vscode/ripgrep');

// child_process.spawn(rgPath, ...)
```

### Published packages

This monorepo publishes three kinds of npm packages:

- **`@vscode/ripgrep`** — the normal entry point. Pure JS wrapper; pulls in the per-platform binary package for the current platform via `optionalDependencies`. Use this for almost everything.
- **`@vscode/ripgrep-<os>-<cpu>`** — the per-platform binary packages (e.g. `@vscode/ripgrep-linux-x64`). Installed transitively by `@vscode/ripgrep`. Not meant to be depended on directly.
- **`@vscode/ripgrep-universal`** — a single tarball bundling **every** platform's binary. Use this when you need access to all platforms' binaries from one install — for example, when repackaging an app into cross-platform artifacts from one build host. Exports `rgPath` (current platform) and `binPathFor({ os, arch })` (any platform). Tarball is large (~60 MB).

### Updating ripgrep

1. Edit the `VERSION` (or `MULTI_ARCH_VERSION`) constant in `lib/platforms.js`.
2. Run `npm run update-lock`. This re-downloads every platform's archive and rewrites `binaries.lock.json` with the fresh SHA256 hashes.
3. Commit the updated `lib/platforms.js` and `binaries.lock.json`.

### Building locally

- `npm run prepare-binaries` — downloads any missing binaries and verifies them against `binaries.lock.json`. Fails on hash mismatch.
- `npm run prepare-binaries -- --force` — forces a clean re-download (still verifies).
- `npm run update-lock` — refreshes `binaries.lock.json` after a version bump.

Set `GITHUB_TOKEN` to avoid GitHub's anonymous API rate limit during downloads.

