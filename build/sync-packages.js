// @ts-check
'use strict';

/**
 * Materializes per-platform package directories under `packages/`.
 *
 * Source of truth:
 *   - `package.json` (root) — canonical version
 *   - `build/platforms.js` — list of supported platforms
 *
 * For each platform p:
 *   - Ensures `packages/ripgrep-<os>-<cpu>/package.json` exists with correct fields.
 *   - Ensures README.md and LICENSE are copied in.
 *
 * Also updates `packages/ripgrep/package.json` `optionalDependencies` and version.
 *
 * Idempotent. Run after editing `build/platforms.js` or bumping the root version.
 */

const fs = require('fs');
const path = require('path');
const { platforms, packageNameFor } = require('./platforms');

const ROOT = path.join(__dirname, '..');
const PACKAGES_DIR = path.join(ROOT, 'packages');
const ROOT_PKG = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const VERSION = ROOT_PKG.version;
const LICENSE = fs.readFileSync(path.join(ROOT, 'LICENSE'), 'utf8');

/**
 * @param {string} target
 * @param {string} content
 */
function writeIfChanged(target, content) {
    if (fs.existsSync(target) && fs.readFileSync(target, 'utf8') === content) {
        return false;
    }
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
    return true;
}

function syncPlatformPackages() {
    let changed = 0;
    for (const p of platforms) {
        const name = packageNameFor(p);
        const shortName = name.replace('@vscode/', '');
        const pkgDir = path.join(PACKAGES_DIR, shortName);

        const pkgJson = {
            name,
            version: VERSION,
            description: `ripgrep binary for ${p.os}-${p.cpu}. Used by @vscode/ripgrep.`,
            repository: {
                type: 'git',
                url: 'https://github.com/microsoft/vscode-ripgrep',
            },
            license: 'MIT',
            os: [p.os],
            cpu: [p.cpu],
            files: ['bin/'],
        };
        const json = JSON.stringify(pkgJson, null, 2) + '\n';
        if (writeIfChanged(path.join(pkgDir, 'package.json'), json)) changed++;

        const readme = `# ${name}\n\nRipgrep binary for \`${p.os}-${p.cpu}\` (${p.target}).\n\n` +
            `This package is an internal dependency of [\`@vscode/ripgrep\`](https://www.npmjs.com/package/@vscode/ripgrep) ` +
            `and should not be installed directly.\n`;
        if (writeIfChanged(path.join(pkgDir, 'README.md'), readme)) changed++;
        if (writeIfChanged(path.join(pkgDir, 'LICENSE'), LICENSE)) changed++;
    }
    return changed;
}

function syncWrapperPackage() {
    const wrapperPkgPath = path.join(PACKAGES_DIR, 'ripgrep', 'package.json');
    const wrapperPkg = JSON.parse(fs.readFileSync(wrapperPkgPath, 'utf8'));
    wrapperPkg.version = VERSION;
    /** @type {Record<string, string>} */
    const optionalDeps = {};
    for (const p of platforms) {
        optionalDeps[packageNameFor(p)] = VERSION;
    }
    wrapperPkg.optionalDependencies = optionalDeps;
    const json = JSON.stringify(wrapperPkg, null, 2) + '\n';
    return writeIfChanged(wrapperPkgPath, json) ? 1 : 0;
}

function main() {
    const platformChanges = syncPlatformPackages();
    const wrapperChanges = syncWrapperPackage();
    const total = platformChanges + wrapperChanges;
    if (total === 0) {
        console.log('All package manifests up to date.');
    } else {
        console.log(`Updated ${total} file(s) across packages/`);
    }
}

main();
