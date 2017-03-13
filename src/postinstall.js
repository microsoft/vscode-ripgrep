const os = require('os');
const download = require('./download');

const opts = {
    platform: os.platform(),
    version: '0.5.0'
};

switch (opts.platform) {
    case 'darwin': opts.arch = 'x64'; break;
    case 'win32': opts.arch = 'ia32'; break;
    case 'linux': opts.arch = os.arch(); break;
    default: throw new Error('Unknown platform: ' + opts.platform);
}

download(opts).catch(err => {
    console.error(`Downloading ripgrep failed: ${err.toString()}`);
});