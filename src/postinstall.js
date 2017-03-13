const os = require('os');
const download = require('./download');

const opts = {
    platform: os.platform(),
    arch: os.arch(),
    version: '0.5.0'
};

download(opts).then(() => {
    console.log('success');
}, err => {
    console.log(`fail: ${err.toString()}`);
});