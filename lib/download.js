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

const REPO = 'microsoft/ripgrep-prebuilt';

function isGithubUrl(_url) {
    return url.parse(_url).hostname === 'api.github.com';
}

function downloadToFile(url, dest, opts) {
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
                return downloadToFile(response.headers.location, dest, opts)
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

function getAssetUrl(repo, tag, target) {
    return `https://github.com/${repo}/releases/download/${tag}/ripgrep-${tag}-${target}.zip`;
}

function getApiUrl(repo, tag) {
    return `https://api.github.com/repos/${repo}/releases/tags/${tag}`;
}

async function download(opts, assetName, downloadFolder) {
    const assetDownloadPath = path.join(downloadFolder, assetName);

    // We can just use the cached binary
    if (await fsExists(assetDownloadPath)) {
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

    console.log(`Finding asset for ${opts.version}`);
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

    console.log(`Downloading to ${assetDownloadPath}`);
    console.log(`Downloading from ${asset.url}`);

    downloadOpts.headers.accept = 'application/octet-stream';
    try {
        for (let i = 0; i < 500; i++)
            await downloadToFile(asset.url, assetDownloadPath, downloadOpts);
    } catch (e) {
        console.log('Deleting invalid download cache');
        await fsUnlink(assetDownloadPath);

        throw e;
    }

    return assetDownloadPath;
}

function unzip(zipPath, destinationDir) {
    return new Promise((resolve, reject) => {
        const unzipProc = child_process.spawn('unzip', [zipPath, '-d', destinationDir], { stdio: 'inherit'});
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

async function unzipRipgrep(zipPath, destinationDir) {
    await unzip(zipPath, destinationDir);
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

    const assetName = ['ripgrep', opts.version, opts.target].join('-') + '.zip';

    if (!await fsExists(tmpDir)) {
        await fsMkdir(tmpDir);
    }

    const assetDownloadPath = await download(opts, assetName, tmpDir)
    console.log(`Unzipping to ${opts.destDir}`);
    try {
        const destinationPath = await unzipRipgrep(assetDownloadPath, opts.destDir);
        if (os.platform() !== 'win32') {
            await util.promisify(fs.chmod)(destinationPath, '755');
        }
    } catch (e) {
        console.log('Unzip failed: ' + e.message);
        console.log('Deleting invalid download');
        await fsUnlink(assetDownloadPath);

        throw e;
    }
};
