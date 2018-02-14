'use strict';

const path = require('path');
const fs = require('fs');

exports.binPath = path.join(__dirname, '../bin');

exports.getNodeModulesPath = () => {
    const thisDirNodeModules = path.resolve(__dirname, 'node_modules');
    const nextDirNodeModules = path.resolve(__dirname, '../node_modules');
    return exports.existsP(thisDirNodeModules).then(exists => {
        return exists ?
            thisDirNodeModules :
            exports.existsP(nextDirNodeModules).then(exists => {
                return exists ?
                    nextDirNodeModules :
                    null;
            });
    })
};

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
