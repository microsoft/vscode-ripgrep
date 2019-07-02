// @ts-check
'use strict';

const os = require('os');
const path = require('path');

const { existsP, binPath, getNodeModulesPath } = require('./common.js');

const version = 'vpub';

getNodeModulesPath().then(nodeModulesPath => {
    if (!nodeModulesPath) {
        throw new Error('node_modules does not exist, postinstall should not be running');
    }

    return existsP(binPath).then(binExists => {
        if (binExists) {
            console.log('bin/ folder already exists');
        } else {
            const download = require('./download');

            const opts = {
                version,
                token: process.env['GITHUB_TOKEN']
            };

            const arch = process.env.npm_config_arch || os.arch();
            switch (os.platform()) {
                case 'darwin':
                    opts.target = 'x86_64-apple-darwin';
                    break;
                case 'win32':
                    opts.target = arch === 'x64' ?
                        'x86_64-pc-windows-msvc' :
                        'i686-pc-windows-msvc';
                    break;
                case 'linux':
                    opts.target = arch === 'x64' ? 'x86_64-unknown-linux-musl' :
                        arch === 'arm' ? 'arm-unknown-linux-gnueabihf' :
                        arch === 'arm64' ? 'aarch64-unknown-linux-gnu' :
                        arch === 'ppc64' ? 'powerpc64le-unknown-linux-gnu' :
                        'i686-unknown-linux-musl'
                    break;
                default: throw new Error('Unknown platform: ' + opts.platform);
            }

            return download(opts);
        }
    }).then(() => {
        return cleanup(nodeModulesPath);
    })
}).catch(err => {
    console.error(`Downloading ripgrep failed: ${err.toString()}`);
    process.exit(1);
});

function rimrafP(rimraf, path) {
    return new Promise(resolve => {
        rimraf(path, resolve);
    });
}

function cleanup(nodeModulesPath) {
    // Clean up node_modules but only the packed ones in lib/
    if (__dirname === path.dirname(nodeModulesPath)) {
        const rimraf = require('rimraf');
        return rimrafP(rimraf, nodeModulesPath);
    } else {
        console.log('Not removing node_modules in parent folder')
    }
}