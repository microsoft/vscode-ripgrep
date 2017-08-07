'use strict';

const { existsP, renameP, node_modules_path, _node_modules_path } = require('./common.js');

existsP(_node_modules_path).then(exists => {
    if (exists) {
        console.log('Publishing ./_node_modules folder that already exists');
    } else {
        existsP(node_modules_path).then(exists => {
            if (exists) {
                return renameP(node_modules_path, _node_modules_path).then(() => {
                    console.log('Renamed node_modules to _node_modules for publish');
                });
            } else {
                throw new Error('No node_modules or _node_modules - run npm install before publishing');
            }
        });
    }
}).catch(err => {
    if (err) {
        console.error('Prep failed: ' + err.message);
        process.exit(1);
    }
});
