'use strict';

const { existsP, renameP, node_modules_path, _node_modules_path } = require('./common.js');

if (shouldRun()) {
    existsP(_node_modules_path).then(exists => {
        if (exists) {
            console.log('Publishing ./_node_modules folder that already exists');
        } else {
            return existsP(node_modules_path).then(exists => {
                if (exists) {
                    return renameP(node_modules_path, _node_modules_path).then(() => {
                        console.log('Renamed node_modules to _node_modules for publish');
                    });
                } else {
                    throw new Error('No node_modules or _node_modules - run `npm install --ignore-scripts` before publishing');
                }
            });
        }
    }).catch(err => {
        if (err) {
            console.error('Prep failed: ' + err.message);
            process.exit(1);
        }
    });
}

function shouldRun() {
    const npmConfigArgv = process.env['npm_config_argv'];
    if (!npmConfigArgv) {
        // Script invoked directly
        return true;
    }

    const npmConfig = JSON.parse(process.env['npm_config_argv']);
    return npmConfig && npmConfig.cooked && npmConfig.cooked[0] && npmConfig.cooked[0].startsWith('p'); // publish or package
}