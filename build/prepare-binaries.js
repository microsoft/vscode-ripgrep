// @ts-check
'use strict';

/**
 * Build script: downloads, verifies, and extracts ripgrep binaries into the
 * per-platform packages under `packages/ripgrep-<os>-<cpu>/bin/`.
 *
 * Each `packages/ripgrep-<os>-<cpu>` is its own npm package and is published
 * separately. CI typically runs this script once per platform package using
 * `--target <triple>` so each pipeline only downloads its own binary.
 *
 * Usage:
 *   node build/prepare-binaries.js                    # all platforms
 *   node build/prepare-binaries.js --target <triple>  # single platform
 *   node build/prepare-binaries.js --force            # re-download even if present
 *   node build/prepare-binaries.js --update-lock      # refresh binaries.lock.json
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');
const { execSync } = require('child_process');
const { platforms, packageNameFor, binaryNameFor } = require('./platforms');

const REPO = 'microsoft/ripgrep-prebuilt';
const ROOT = path.join(__dirname, '..');
const PACKAGES_DIR = path.join(ROOT, 'packages');
const LOCK_PATH = path.join(ROOT, 'binaries.lock.json');

const argv = process.argv.slice(2);
const FORCE = argv.includes('--force');
const UPDATE_LOCK = argv.includes('--update-lock');
const targetIdx = argv.indexOf('--target');
const ONLY_TARGET = targetIdx !== -1 ? argv[targetIdx + 1] : undefined;

/**
 * @param {string} url
 * @param {string} dest
 * @param {Record<string, string>} headers
 * @returns {Promise<void>}
 */
function downloadToFile(url, dest, headers) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'user-agent': 'vscode-ripgrep', ...headers } }, res => {
            const { statusCode, headers: resHeaders } = res;
            const location = /** @type {string | undefined} */ (resHeaders.location);
            if ((statusCode === 301 || statusCode === 302) && location) {
                res.resume();
                return downloadToFile(location, dest, headers).then(resolve, reject);
            }
            if (statusCode !== 200) {
                res.resume();
                return reject(new Error(`HTTP ${statusCode} for ${url}`));
            }
            const out = fs.createWriteStream(dest);
            res.pipe(out);
            out.on('finish', () => out.close(() => resolve()));
            out.on('error', reject);
        }).on('error', reject);
    });
}

/**
 * @param {string} filePath
 * @returns {Promise<string>}
 */
function sha256OfFile(filePath) {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha256');
        const stream = fs.createReadStream(filePath);
        stream.on('data', d => hash.update(d));
        stream.on('end', () => resolve(hash.digest('hex')));
        stream.on('error', reject);
    });
}

/**
 * @returns {Record<string, { version: string; sha256: string }>}
 */
function readLockfile() {
    if (!fs.existsSync(LOCK_PATH)) {
        return {};
    }
    return JSON.parse(fs.readFileSync(LOCK_PATH, 'utf8'));
}

/**
 * @param {Record<string, { version: string; sha256: string }>} lock
 */
function writeLockfile(lock) {
    const sorted = Object.fromEntries(Object.keys(lock).sort().map(k => [k, lock[k]]));
    fs.writeFileSync(LOCK_PATH, JSON.stringify(sorted, null, 2) + '\n');
}

async function main() {
    const selected = ONLY_TARGET
        ? platforms.filter(p => p.target === ONLY_TARGET)
        : platforms;

    if (ONLY_TARGET && selected.length === 0) {
        console.error(`Unknown --target ${ONLY_TARGET}. Known targets:`);
        for (const p of platforms) console.error(`  ${p.target}`);
        process.exit(1);
    }

    const token = process.env.GITHUB_TOKEN;
    /** @type {Record<string, string>} */
    const headers = token ? { authorization: `token ${token}` } : {};

    const lock = readLockfile();
    /** @type {Record<string, { version: string; sha256: string }>} */
    const newLock = ONLY_TARGET ? { ...lock } : {};
    let mismatch = false;

    for (const platform of selected) {
        const isWindows = platform.os === 'win32';
        const ext = isWindows ? '.zip' : '.tar.gz';
        const assetName = `ripgrep-${platform.version}-${platform.target}${ext}`;
        const binaryName = binaryNameFor(platform);
        const pkgShortName = packageNameFor(platform).replace('@vscode/', '');
        const binDir = path.join(PACKAGES_DIR, pkgShortName, 'bin');
        const binaryPath = path.join(binDir, binaryName);

        if ((FORCE || UPDATE_LOCK) && fs.existsSync(binDir)) {
            fs.rmSync(binDir, { recursive: true });
        }

        if (!FORCE && !UPDATE_LOCK && fs.existsSync(binaryPath)) {
            console.log(`[skip] ${platform.target}: already present`);
            newLock[platform.target] = lock[platform.target];
            continue;
        }

        console.log(`[fetch] ${platform.target} (${platform.version})`);
        fs.mkdirSync(binDir, { recursive: true });

        const archive = path.join(binDir, assetName);
        const url = `https://github.com/${REPO}/releases/download/${platform.version}/${assetName}`;
        await downloadToFile(url, archive, headers);

        const archiveSha = await sha256OfFile(archive);
        const expected = lock[platform.target];

        if (UPDATE_LOCK) {
            newLock[platform.target] = { version: platform.version, sha256: archiveSha };
            console.log(`        sha256=${archiveSha}`);
        } else if (!expected) {
            console.error(`[fail] ${platform.target}: no entry in binaries.lock.json. ` +
                `Run \`npm run update-lock\` to populate it.`);
            mismatch = true;
            fs.unlinkSync(archive);
            continue;
        } else if (expected.version !== platform.version || expected.sha256 !== archiveSha) {
            console.error(`[fail] ${platform.target}: lockfile mismatch.\n` +
                `        expected version=${expected.version} sha256=${expected.sha256}\n` +
                `        got      version=${platform.version} sha256=${archiveSha}`);
            mismatch = true;
            fs.unlinkSync(archive);
            continue;
        } else {
            newLock[platform.target] = expected;
        }

        // Windows builds ship as .zip; Linux/macOS as .tar.gz. The host agent
        // running this script may differ from the target OS (e.g. Linux CI
        // building the Windows package), so pick the extractor based on the
        // archive format and the host's available tools:
        //   - .tar.gz: GNU/bsdtar handle this everywhere -> `tar -xzf`
        //   - .zip on Windows host: bsdtar ships with Windows -> `tar -xf`
        //   - .zip on POSIX host: GNU tar can't read zip -> use `unzip`
        if (isWindows) {
            if (process.platform === 'win32') {
                execSync(`tar -xf "${archive}" -C "${binDir}" ${binaryName}`, { stdio: 'inherit' });
            } else {
                execSync(`unzip -o -j "${archive}" "${binaryName}" -d "${binDir}"`, { stdio: 'inherit' });
            }
        } else {
            execSync(`tar -xzf "${archive}" -C "${binDir}" ${binaryName}`, { stdio: 'inherit' });
            fs.chmodSync(binaryPath, 0o755);
        }
        fs.unlinkSync(archive);
        console.log(`[ok]    ${platform.target} -> ${path.relative(ROOT, binaryPath)}`);
    }

    if (mismatch) {
        process.exit(1);
    }

    if (UPDATE_LOCK) {
        writeLockfile(newLock);
        console.log(`\nLockfile updated: ${LOCK_PATH}`);
    } else {
        console.log(`\nAll selected binaries verified and prepared.`);
    }
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
