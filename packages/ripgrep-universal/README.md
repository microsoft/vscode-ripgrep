# @vscode/ripgrep-universal

A single npm package bundling [ripgrep](https://github.com/BurntSushi/ripgrep) binaries for **every supported platform**.

Use this package instead of [`@vscode/ripgrep`](https://www.npmjs.com/package/@vscode/ripgrep) when you need every platform's binary available from a single install — for example, when repackaging a Node application into cross-platform artifacts (VSIX, archives, installers) from one build host.

The tarball is large (~60 MB) because it ships 12 binaries. For normal application use, prefer `@vscode/ripgrep`, which installs only the binary for the current platform via `optionalDependencies`.

## Usage

```js
import { rgPath, binPathFor } from '@vscode/ripgrep-universal';

// Path to the binary for the current platform/arch.
console.log(rgPath);

// Path to any platform's binary (useful for cross-platform packaging).
const winPath = binPathFor({ os: 'win32', arch: 'x64' });
const linuxArmPath = binPathFor({ os: 'linux', arch: 'arm64' });
```

## Layout

Binaries are placed under `bin/<os>-<arch>/<rg|rg.exe>`.
