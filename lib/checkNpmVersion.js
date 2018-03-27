'use strict';

const cp = require('child_process');

// Publishing with npm 5 does not work
const npmPath = process.env['npm_execpath'];
const out = cp.execSync(`${npmPath} --version`).toString();
if (compareSemver(out, '5.0.0') >= 0) {
    throw new Error('NPM < 5 is required for publishing vscode-ripgrep. See https://github.com/roblourens/vscode-ripgrep/issues/7')
}

function compareSemver(a, b) {
    const aNum = versionStringToNumber(a);
    const bNum = versionStringToNumber(b);

    return aNum - bNum;
}

function versionStringToNumber(str) {
    const semverRegex = /v?(\d+)\.(\d+)\.(\d+)/;
    const match = str.match(semverRegex);
    if (!match) {
        throw new Error('Invalid node version string: ' + str);
    }

    return parseInt(match[1], 10) * 10000 + parseInt(match[2], 10) * 100 + parseInt(match[3], 10);
}
