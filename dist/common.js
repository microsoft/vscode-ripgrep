'use strict';

const path = require('path');
const fs = require('fs');

exports.node_modules_path = path.resolve(__dirname, '../node_modules');
exports._node_modules_path = path.resolve(__dirname, '../_node_modules');

exports.existsP = testPath => {
    return new Promise(resolve => fs.exists(testPath, resolve));
};

exports.renameP = (oldPath, newPath) => {
    return new Promise((resolve, reject) => {
        fs.rename(oldPath, newPath, err => {
            if (err) reject(err)
            else resolve();
        });
    });
};

exports.rmdirP = target => {
    return new Promise((resolve, reject) => {
        fs.rmdir(target, err => {
            if (err) reject(err);
            else resolve();
        });
    });
};
