'use strict';

const fs = require('fs');

fs.rename('./node_modules', './_node_modules', err => {
    if (err) {
        console.error('Prep failed: ' + err.message);
        process.exit(1);
    } else {
        console.log('Renamed node_modules to _node_modules for publish');
    }
});