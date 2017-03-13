const os = require('os');
const download = require('./download');

const opts = {
    platform: os.platform(),
    arch: os.arch(),
    version: '0.5.0'
};

download(opts).catch(err => {
    console.error(`Downloading ripgrep failed: ${err.toString()}`);
});