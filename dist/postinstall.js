// @ts-check
'use strict';

const fs = require('fs');
const os = require('os');

existsP('./node_modules').then(exists => {
    if (exists) {
        console.log('Using node_modules which already exists');
    } else {
        return existsP('./_node_modules').then(exists => {
            if (exists) {
                console.log('Renaming _node_modules => node_modules');
                return renameP('./_node_modules', './node_modules');
            }
            else throw new Error('Missing ./_node_modules...');
        });
    }
}).then(() => {
    // dependencies are fixed, now it is safe to require './download.js'
    const download = require('./download');

    const opts = {
        platform: os.platform(),
        version: '0.5.1-patch.0',
        token: process.env['GITHUB_TOKEN']
    };

    switch (opts.platform) {
        case 'darwin': opts.arch = 'x64'; break;
        case 'win32': opts.arch = 'ia32'; break;
        case 'linux': opts.arch = process.env.VSCODE_ELECTRON_PLATFORM || os.arch(); break;
        default: throw new Error('Unknown platform: ' + opts.platform);
    }

    return download(opts);
}).catch(err => {
    console.error(`Downloading ripgrep failed: ${err.toString()}`);
    process.exit(1);
});

function existsP(testPath) {
    return new Promise(resolve => fs.exists(testPath, resolve));
}

function renameP(oldPath, newPath) {
    return new Promise((resolve, reject) => {
        fs.rename(oldPath, newPath, err => {
            if (err) reject(err)
            else resolve();
        });
    });
}

function rmdirP(target) {
    return new Promise((resolve, reject) => {
        fs.rmdir(target, err => {
            if (err) reject(err);
            else resolve();
        });
    });
}