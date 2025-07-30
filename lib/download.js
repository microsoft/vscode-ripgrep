// @ts-check
'use strict';

const path = require('path');
const fs = require('fs');
const os = require('os');
const https = require('https');
const util = require('util');
const url = require('url');
const stream = require('stream');
const child_process = require('child_process');
const proxy_from_env = require('proxy-from-env');
const yauzl = require('yauzl'); // use yauzl ^2.9.2 because vscode already ships with it.
const packageVersion = require('../package.json').version;
const tmpDir = path.join(os.tmpdir(), `vscode-ripgrep-cache-${packageVersion}`);

const fsUnlink = util.promisify(fs.unlink);
const fsExists = util.promisify(fs.exists);
const fsMkdir = util.promisify(fs.mkdir);

const isWindows = os.platform() === 'win32';

const REPO = 'microsoft/ripgrep-prebuilt';
const pipelineAsync = util.promisify(stream.pipeline);

/**
 * @param {string} _url
 */
function isGithubUrl(_url) {
    return url.parse(_url).hostname === 'api.github.com';
}


/**
 * @param {string} _url
 * @param {fs.PathLike} dest
 * @param {any} opts
 */
function download(_url, dest, opts) {

    const proxy = proxy_from_env.getProxyForUrl(url.parse(_url));
    if (proxy !== '') {
        var HttpsProxyAgent = require('https-proxy-agent');
        opts = {
            ...opts,
            "agent": new HttpsProxyAgent.HttpsProxyAgent(proxy),
            proxy
        };
    }


    if (opts.headers && opts.headers.authorization && !isGithubUrl(_url)) {
        delete opts.headers.authorization;
    }

    return new Promise((resolve, reject) => {
        console.log(`Download options: ${JSON.stringify(opts)}`);
        const outFile = fs.createWriteStream(dest);
        const mergedOpts = {
            ...url.parse(_url),
            ...opts
        };
        https.get(mergedOpts, response => {
            console.log('statusCode: ' + response.statusCode);
            if (response.statusCode === 302) {
                response.resume();
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

/**
 * @param {string} _url
 * @param {any} opts
 */
function get(_url, opts) {
    console.log(`GET ${_url}`);

    const proxy = proxy_from_env.getProxyForUrl(url.parse(_url));
    if (proxy !== '') {
        var HttpsProxyAgent = require('https-proxy-agent');
        opts = {
            ...opts,
            "agent": new HttpsProxyAgent.HttpsProxyAgent(proxy)
        };
    }

    return new Promise((resolve, reject) => {
        let result = '';
        opts = {
            ...url.parse(_url),
            ...opts
        };
        https.get(opts, response => {
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
        }).on('error', e => reject(e));
    });
}

/**
 * @param {string} repo
 * @param {string} tag
 */
function getApiUrl(repo, tag) {
    return `https://api.github.com/repos/${repo}/releases/tags/${tag}`;
}

/**
 * @returns {string | null}
 */
function getMirrorUrl() {
    const mirrorUrlFromEnv = process.env.RIPGREP_MIRROR_URL;
    if (mirrorUrlFromEnv) {
        console.log('Using ripgrep mirror URL from environment variable RIPGREP_MIRROR_URL: ' + mirrorUrlFromEnv);
        return mirrorUrlFromEnv;
    }

    const mirrorUrlFromNpmConfig = process.env.npm_config_ripgrep_mirror_url;
    if (mirrorUrlFromNpmConfig) {
        console.log('Using ripgrep mirror URL from npm config: ' + mirrorUrlFromNpmConfig);
        return mirrorUrlFromNpmConfig;
    }

    return null;
}

/**
 * @param {{ force: boolean; token: string; version: string; }} opts
 * @param {string} assetName
 * @param {string} assetDownloadPath
 * @param {object} downloadOpts
 */
async function downloadFromGithub(opts, assetName, assetDownloadPath, downloadOpts) {
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

/**
 * Downloads the ripgrep asset from a mirror or from the GitHub API.
 * @param {{ force: boolean; token: string; version: string; }} opts
 * @param {string} assetName
 * @param {string} downloadFolder
 * @param {string | null} mirrorUrl
 */
async function downloadAsset(opts, assetName, downloadFolder, mirrorUrl) {
    const assetDownloadPath = path.join(downloadFolder, assetName);

    // We can just use the cached binary
    if (!opts.force && await fsExists(assetDownloadPath)) {
        console.log('Using cached download: ' + assetDownloadPath);
        return;
    }

    const downloadOpts = {
        headers: {
            'user-agent': 'vscode-ripgrep'
        }
    };

    if (mirrorUrl) {
        const baseUrl = mirrorUrl.endsWith('/') ? mirrorUrl : `${mirrorUrl}/`;
        const downloadUrl = baseUrl + assetName;

        console.log(`Downloading from mirror: ${downloadUrl}`);
        console.log(`Downloading to: ${assetDownloadPath}`);
        await download(downloadUrl, assetDownloadPath, downloadOpts);
        return;
    }

    await downloadFromGithub(opts, assetName, assetDownloadPath, downloadOpts);
}

/**
 * @param {string} zipPath
 * @param {string} destinationDir
 */
function unzipWindows(zipPath, destinationDir) {
    // code from https://stackoverflow.com/questions/63932027/how-to-unzip-to-a-folder-using-yauzl
    return new Promise((resolve, reject) => {
        try {
            // Create folder if not exists
            fs.promises.mkdir(path.dirname(destinationDir), { recursive: true });

            // Same as example we open the zip.
            yauzl.open(zipPath, { lazyEntries: true }, (err, zipFile) => {
                if (err) {
                    zipFile?.close();
                    reject(err);
                    return;
                }

                // This is the key. We start by reading the first entry.
                zipFile.readEntry();

                // Now for every entry, we will write a file or dir
                // to disk. Then call zipFile.readEntry() again to
                // trigger the next cycle.
                zipFile.on('entry', (entry) => {
                    try {
                        // Directories
                        if (/\/$/.test(entry.fileName)) {
                            // Create the directory then read the next entry.
                            fs.promises.mkdir(path.join(destinationDir, entry.fileName), { recursive: true });
                            zipFile.readEntry();
                        }
                        // Files
                        else {
                            // Write the file to disk.
                            zipFile.openReadStream(entry, (readErr, readStream) => {
                                if (readErr) {
                                    zipFile.close();
                                    reject(readErr);
                                    return;
                                }

                                const file = fs.createWriteStream(path.join(destinationDir, entry.fileName));
                                readStream.pipe(file);
                                file.on('finish', () => {
                                    // Wait until the file is finished writing, then read the next entry.
                                    // @ts-ignore: Typing for close() is wrong.
                                    file.close(() => {
                                        zipFile.readEntry();
                                    });

                                    file.on('error', (err) => {
                                        zipFile.close();
                                        reject(err);
                                    });
                                });
                            });
                        }
                    } catch (e) {
                        zipFile.close();
                        reject(e);
                    }
                });
                zipFile.on('end', (err) => {
                    resolve();
                });
                zipFile.on('error', (err) => {
                    zipFile.close();
                    reject(err);
                });
            });
        }
        catch (e) {
            reject(e);
        }
    });
}

function untar(zipPath, destinationDir) {
    return new Promise((resolve, reject) => {
        const unzipProc = child_process.spawn('tar', ['xvf', zipPath, '-C', destinationDir], { stdio: 'inherit' });
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

/**
 * @param {string} zipPath
 * @param {string} destinationDir
 */
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
    const mirrorUrl = getMirrorUrl();

    try {
        await downloadAsset(opts, assetName, tmpDir, mirrorUrl)
    } catch (e) {
        console.log('Deleting invalid download cache');
        try {
            await fsUnlink(assetDownloadPath);
        } catch (e) { }

        throw e;
    }

    console.log(`Unzipping to ${opts.destDir}`);
    try {
        const destinationPath = await unzipRipgrep(assetDownloadPath, opts.destDir);
        if (!isWindows) {
            await util.promisify(fs.chmod)(destinationPath, '755');
        }
    } catch (e) {
        console.log('Deleting invalid download');

        try {
            await fsUnlink(assetDownloadPath);
        } catch (e) { }

        throw e;
    }
};
