// @ts-check
'use strict';

/**
 * Platform → ripgrep target mapping.
 * Source of truth used by:
 *   - build/prepare-binaries.js (download from ripgrep-prebuilt)
 *   - build/sync-packages.js    (generate per-platform npm packages)
 */

const VERSION = 'v15.0.1';
const MULTI_ARCH_VERSION = 'v13.0.0-4';

/** @type {Array<{ os: NodeJS.Platform; cpu: string; target: string; version: string }>} */
const platforms = [
    { os: 'darwin', cpu: 'x64',     target: 'x86_64-apple-darwin',           version: VERSION },
    { os: 'darwin', cpu: 'arm64',   target: 'aarch64-apple-darwin',          version: VERSION },
    { os: 'win32',  cpu: 'x64',     target: 'x86_64-pc-windows-msvc',        version: VERSION },
    { os: 'win32',  cpu: 'arm64',   target: 'aarch64-pc-windows-msvc',       version: VERSION },
    { os: 'win32',  cpu: 'ia32',    target: 'i686-pc-windows-msvc',          version: VERSION },
    { os: 'linux',  cpu: 'x64',     target: 'x86_64-unknown-linux-musl',     version: VERSION },
    { os: 'linux',  cpu: 'arm64',   target: 'aarch64-unknown-linux-musl',    version: VERSION },
    { os: 'linux',  cpu: 'arm',     target: 'arm-unknown-linux-gnueabihf',   version: MULTI_ARCH_VERSION },
    { os: 'linux',  cpu: 'ppc64',   target: 'powerpc64le-unknown-linux-gnu', version: MULTI_ARCH_VERSION },
    { os: 'linux',  cpu: 'riscv64', target: 'riscv64gc-unknown-linux-gnu',   version: VERSION },
    { os: 'linux',  cpu: 's390x',   target: 's390x-unknown-linux-gnu',       version: MULTI_ARCH_VERSION },
    { os: 'linux',  cpu: 'ia32',    target: 'i686-unknown-linux-musl',       version: VERSION },
];

/** @param {{ os: string; cpu: string }} p */
function packageNameFor(p) {
    return `@vscode/ripgrep-${p.os}-${p.cpu}`;
}

/** @param {{ os: string }} p */
function binaryNameFor(p) {
    return p.os === 'win32' ? 'rg.exe' : 'rg';
}

module.exports = { platforms, packageNameFor, binaryNameFor, VERSION, MULTI_ARCH_VERSION };

