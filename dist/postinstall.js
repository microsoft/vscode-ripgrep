// @ts-check
'use strict';

const fs = require('fs');
const os = require('os');
const { existsP, renameP, node_modules_path, _node_modules_path } = require('./common.js');

const version = '0.6.0-patch.0';

existsP(node_modules_path).then(exists => {
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
            opts.arch = process.env.VSCODE_ELECTRON_PLATFORM || os.arch();
            break;
        default: throw new Error('Unknown platform: ' + opts.platform);
    }

    return download(opts);
}).then(() => {
    // Cleanup - delete node_modules
    const rimraf = require('rimraf');
    return rimrafP(rimraf, node_modules_path);
}).catch(err => {
    console.error(`Downloading ripgrep failed: ${err.toString()}`);
    process.exit(1);
});

function rimrafP(rimraf, path) {
    return new Promise(resolve => {
        rimraf(path, resolve);
    });
}