// @ts-check
'use strict';

const path = require('path');
const fs = require('fs');
const os = require('os');
const https = require('https');
const util = require('util');
const url = require('url');
const child_process = require('child_process');

const packageVersion = require('../package.json').version;
const tmpDir = path.join(os.tmpdir(), `vscode-ripgrep-cache-${packageVersion}`);

const fsUnlink = util.promisify(fs.unlink);
const fsExists = util.promisify(fs.exists);
const fsMkdir = util.promisify(fs.mkdir);

const isWindows = os.platform() === 'win32';

const REPO = 'microsoft/ripgrep-prebuilt';

function isGithubUrl(_url) {
    return url.parse(_url).hostname === 'api.github.com';
}

function download(url, dest, opts) {
    if (opts.headers && opts.headers.authorization && !isGithubUrl(url)) {
        delete opts.headers.authorization;
    }

    return new Promise((resolve, reject) => {
        console.log(`Download options: ${JSON.stringify(opts)}`);
        const outFile = fs.createWriteStream(dest);
        https.get(url, opts, response => {
            console.log('statusCode: ' + response.statusCode);
            if (response.statusCode === 302) {
                console.log('Following redirect to: ' + response.headers.location);
                return download(response.headers.location, dest, opts)
                    .then(resolve, reject);
            } else if (response.statusCode !== 200) {
                reject(new Error('Download failed with ' + response.statusCode));
                return;
            }

            response.pipe(outFile);
            outFile.on('finish', () => {
               resolve();
            });
        }).on('error', async err => {
            await fsUnlink(dest);
            reject(err);
        });
    });
}

function get(url, opts) {
    console.log(`GET ${url}`);
    return new Promise((resolve, reject) => {
        let result = '';
        https.get(url, opts, response => {
            if (response.statusCode !== 200) {
                reject(new Error('Request failed: ' + response.statusCode));
            }

            response.on('data', d => {
                result += d.toString();
            });

            response.on('end', () => {
                resolve(result);
            });

            response.on('error', e => {
                reject(e);
            });
        });
    });
}

function getApiUrl(repo, tag) {
    return `https://api.github.com/repos/${repo}/releases/tags/${tag}`;
}

/**
 * @param {{ force: boolean; token: string; version: string; }} opts
 * @param {string} assetName
 * @param {string} downloadFolder
 */
async function getAssetFromGithubApi(opts, assetName, downloadFolder) {
    const assetDownloadPath = path.join(downloadFolder, assetName);

    // We can just use the cached binary
    if (!opts.force && await fsExists(assetDownloadPath)) {
        console.log('Using cached download: ' + assetDownloadPath);
        return assetDownloadPath;
    }

    const downloadOpts = {
        headers: {
            'user-agent': 'vscode-ripgrep'
        }
    };
    if (opts.token) {
        downloadOpts.headers.authorization = `token ${opts.token}`;
    }

    console.log(`Finding release for ${opts.version}`);
    const release = await get(getApiUrl(REPO, opts.version), downloadOpts);
    let jsonRelease;
    try {
        jsonRelease = JSON.parse(release);
    } catch (e) {
        throw new Error('Malformed API response: ' + e.stack);
    }

    if (!jsonRelease.assets) {
        throw new Error('Bad API response: ' + JSON.stringify(release));
    }

    const asset = jsonRelease.assets.find(a => a.name === assetName);
    if (!asset) {
        throw new Error('Asset not found with name: ' + assetName);
    }

    console.log(`Downloading from ${asset.url}`);
    console.log(`Downloading to ${assetDownloadPath}`);

    downloadOpts.headers.accept = 'application/octet-stream';
    await download(asset.url, assetDownloadPath, downloadOpts);
}

function unzipWindows(zipPath, destinationDir) {
    return new Promise((resolve, reject) => {
        const unzipProc = child_process.exec('powershell -Command Expand-Archive ' + ['-Path', zipPath, '-DestinationPath', destinationDir].join(' '));
        unzipProc.on('error', err => {
            reject(err);
        });
        unzipProc.on('close', code => {
            console.log(`Unzip exited with ${code}`);
            if (code !== 0) {
                reject(new Error(`Unzip exited with ${code}`));
                return;
            }

            resolve();
        });
    });
}

function untar(zipPath, destinationDir) {
    return new Promise((resolve, reject) => {
        const unzipProc = child_process.spawn('tar', ['xvf', zipPath, '-C', destinationDir], { stdio: 'inherit'});
        unzipProc.on('error', err => {
            reject(err);
        });
        unzipProc.on('close', code => {
            console.log(`tar xvf exited with ${code}`);
            if (code !== 0) {
                reject(new Error(`tar xvf exited with ${code}`));
                return;
            }

            resolve();
        });
    });
}

async function unzipRipgrep(zipPath, destinationDir) {
    if (isWindows) {
        await unzipWindows(zipPath, destinationDir);
    } else {
        await untar(zipPath, destinationDir);
    }

    const expectedName = path.join(destinationDir, 'rg');
    if (await fsExists(expectedName)) {
        return expectedName;
    }

    if (await fsExists(expectedName + '.exe')) {
        return expectedName + '.exe';
    }

    throw new Error(`Expecting rg or rg.exe unzipped into ${destinationDir}, didn't find one.`);
}

module.exports = async opts => {
    if (!opts.version) {
        return Promise.reject(new Error('Missing version'));
    }

    if (!opts.target) {
        return Promise.reject(new Error('Missing target'));
    }

    const extension = isWindows ? '.zip' : '.tar.gz';
    const assetName = ['ripgrep', opts.version, opts.target].join('-') + extension;

    if (!await fsExists(tmpDir)) {
        await fsMkdir(tmpDir);
    }

    const assetDownloadPath = path.join(tmpDir, assetName);
    try {
        await getAssetFromGithubApi(opts, assetName, tmpDir)
    } catch (e) {
        console.log('Deleting invalid download cache');
        await fsUnlink(assetDownloadPath);
        throw e;
    }

    console.log(`Unzipping to ${opts.destDir}`);
    try {
        const destinationPath = await unzipRipgrep(assetDownloadPath, opts.destDir);
        if (!isWindows) {
            await util.promisify(fs.chmod)(destinationPath, '755');
        }
    } catch (e) {
        console.log('Unzip failed: ' + e.message);
        console.log('Deleting invalid download');
        await fsUnlink(assetDownloadPath);

        throw e;
    }
};
