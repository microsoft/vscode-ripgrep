// @ts-check
'use strict';

const fs = require('fs');
const os = require('os');
const { existsP, renameP, node_modules_path, _node_modules_path, binPath } = require('./common.js');

const version = '0.7.1-patch.0';

existsP(binPath).then(binExists => {
    if (binExists) {
        console.log('bin/ folder already exists');
        return earlyCleanup().then(() => process.exit())
    } else {
        return existsP(node_modules_path);
    }
}).then(exists => {
    if (exists) {
        console.log('Using node_modules which already exists');
    } else {
        return existsP(_node_modules_path).then(exists => {
            if (exists) {
                console.log('Renaming _node_modules => node_modules');
                return renameP(_node_modules_path, node_modules_path);
            }
            else throw new Error('Missing ./_node_modules...');
        });
    }
}).then(() => {
    // dependencies are fixed, now it is safe to require './download.js'
    const download = require('./download');

    const opts = {
        platform: os.platform(),
        version,
        token: process.env['GITHUB_TOKEN']
    };

    switch (opts.platform) {
        case 'darwin':
            opts.arch = 'x64';
            break;
        case 'win32':
        case 'linux':
            opts.arch = process.env.npm_config_arch || os.arch();
            break;
        default: throw new Error('Unknown platform: ' + opts.platform);
    }

    return download(opts);
}).then(() => {
    return cleanup();
}).catch(err => {
    console.error(`Downloading ripgrep failed: ${err.toString()}`);
    process.exit(1);
});

function rimrafP(rimraf, path) {
    return new Promise(resolve => {
        rimraf(path, resolve);
    });
}

function earlyCleanup() {
    return existsP(_node_modules_path)
        .then(exists => exists && renameP(_node_modules_path, node_modules_path))
        .then(() => cleanup());
}

function cleanup() {
    // Cleanup - delete node_modules and also _node_modules just for good measure
    const rimraf = require('rimraf');
    return rimrafP(rimraf, node_modules_path);
}