import { fileURLToPath } from 'node:url';
import path from 'node:path';

const _packageRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

export function binPathFor({ os, arch }) {
    const binaryName = os === 'win32' ? 'rg.exe' : 'rg';
    return path.join(_packageRoot, 'bin', `${os}-${arch}`, binaryName);
}

export const rgPath = binPathFor({
    os: process.platform,
    arch: process.env.npm_config_arch || process.arch,
});
