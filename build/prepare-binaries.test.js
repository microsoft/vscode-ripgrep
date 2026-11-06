// @ts-check
'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('fs');
const os = require('os');
const path = require('path');
const https = require('https');
const { EventEmitter } = require('events');
const { PassThrough } = require('stream');
const { downloadToFile } = require('./prepare-binaries');

/**
 * @param {{ after: typeof import('node:test').after; mock: typeof import('node:test').mock }} t
 * @param {{ statusCode?: number; location?: string; error?: Error }[]} replies
 */
function setupDownload(t, replies) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vscode-ripgrep-test-'));
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    const dest = path.join(dir, 'archive');
    /** @type {{ url: string; headers: Record<string, string> }[]} */
    const requests = [];
    /** @type {import('node:test').Mock<() => PassThrough>[]} */
    const resumes = [];

    t.mock.method(https, 'get', (
        /** @type {string} */ url,
        /** @type {{ headers: Record<string, string> }} */ options,
        /** @type {(res: PassThrough & { statusCode: number; headers: { location?: string } }) => void} */ callback
    ) => {
        const reply = replies[requests.length];
        assert.ok(reply, 'Unexpected extra request');
        requests.push({ url, headers: options.headers });
        const request = new EventEmitter();
        queueMicrotask(() => {
            if (reply.error) {
                request.emit('error', reply.error);
                return;
            }
            const response = Object.assign(new PassThrough(), {
                statusCode: reply.statusCode ?? 200,
                headers: { location: reply.location },
            });
            resumes.push(t.mock.method(response, 'resume'));
            callback(response);
            response.end('archive contents');
        });
        return request;
    });

    return { dest, requests, resumes };
}

test('downloads a successful response with the supplied headers', async t => {
    const { dest, requests } = setupDownload(t, [{}]);
    await downloadToFile('https://github.com/archive', dest, { authorization: 'token test' });
    assert.equal(fs.readFileSync(dest, 'utf8'), 'archive contents');
    assert.deepEqual(requests, [{
        url: 'https://github.com/archive',
        headers: { 'user-agent': 'vscode-ripgrep', authorization: 'token test' },
    }]);
});

for (const statusCode of [301, 302]) {
    for (const location of ['https://github.com/releases/archive', '/releases/archive', 'archive']) {
        test(`${statusCode} preserves headers for a same-host redirect to ${location}`, async t => {
            const { dest, requests, resumes } = setupDownload(t, [{ statusCode, location }, {}]);
            const headers = { authorization: 'token test', cookie: 'session=test', 'www-authenticate': 'test' };
            await downloadToFile('https://github.com/releases/start', dest, headers);
            assert.equal(requests.length, 2);
            assert.equal(requests[1].url, 'https://github.com/releases/archive');
            assert.deepEqual(requests[1].headers, { 'user-agent': 'vscode-ripgrep', ...headers });
            assert.equal(resumes[0].mock.callCount(), 1);
            assert.equal(fs.readFileSync(dest, 'utf8'), 'archive contents');
        });
    }

    for (const location of ['https://assets.example/archive', '//assets.example/archive', 'https://github.com:8443/archive']) {
        test(`${statusCode} strips sensitive headers for a redirect to ${location}`, async t => {
            const { dest, requests, resumes } = setupDownload(t, [{ statusCode, location }, {}]);
            const headers = Object.freeze({
                authorization: 'token test',
                Authorization: 'token test',
                COOKIE: 'session=test',
                'WwW-Authenticate': 'test',
                Accept: 'application/octet-stream',
            });
            await downloadToFile('https://github.com/archive', dest, headers);
            assert.equal(requests.length, 2);
            assert.equal(requests[1].url, new URL(location, 'https://github.com/archive').href);
            assert.deepEqual(requests[0].headers, { 'user-agent': 'vscode-ripgrep', ...headers });
            assert.deepEqual(requests[1].headers, {
                'user-agent': 'vscode-ripgrep',
                Accept: 'application/octet-stream',
            });
            assert.equal(resumes[0].mock.callCount(), 1);
            assert.equal(fs.readFileSync(dest, 'utf8'), 'archive contents');
        });
    }
}

test('does not restore credentials when a redirect chain returns to the original host', async t => {
    const { dest, requests } = setupDownload(t, [
        { statusCode: 302, location: 'https://assets.example/archive' },
        { statusCode: 301, location: 'https://github.com/archive' },
        {},
    ]);
    await downloadToFile('https://github.com/start', dest, { authorization: 'token test' });
    assert.equal(requests.length, 3);
    for (const request of requests.slice(1)) {
        assert.deepEqual(request.headers, { 'user-agent': 'vscode-ripgrep' });
    }
});

test('allows exactly five redirects before a successful download', async t => {
    const replies = Array.from({ length: 5 }, (_, i) => ({ statusCode: 302, location: `/redirect-${i}` }));
    const { dest, requests, resumes } = setupDownload(t, [...replies, {}]);
    await downloadToFile('https://github.com/archive', dest, {});
    assert.equal(requests.length, 6);
    assert.equal(fs.readFileSync(dest, 'utf8'), 'archive contents');
    for (const resume of resumes.slice(0, 5)) {
        assert.equal(resume.mock.callCount(), 1);
    }
});

test('rejects a redirect loop after five redirects and drains every response', async t => {
    const replies = Array.from({ length: 6 }, () => ({ statusCode: 302, location: '/archive' }));
    const { dest, requests, resumes } = setupDownload(t, replies);
    await assert.rejects(downloadToFile('https://github.com/archive', dest, {}), {
        message: 'Too many redirects: https://github.com/archive',
    });
    assert.equal(requests.length, 6);
    assert.equal(fs.existsSync(dest), false);
    for (const resume of resumes) {
        assert.equal(resume.mock.callCount(), 1);
    }
});

for (const statusCode of [301, 302, 404]) {
    test(`rejects HTTP ${statusCode} without a redirect location`, async t => {
        const { dest, requests, resumes } = setupDownload(t, [{ statusCode }]);
        await assert.rejects(downloadToFile('https://github.com/archive', dest, {}), {
            message: `HTTP ${statusCode} for https://github.com/archive`,
        });
        assert.equal(requests.length, 1);
        assert.equal(resumes[0].mock.callCount(), 1);
        assert.equal(fs.existsSync(dest), false);
    });
}

test('rejects an invalid redirect URL and drains the response', async t => {
    const { dest, requests, resumes } = setupDownload(t, [{ statusCode: 302, location: 'https://[' }]);
    await assert.rejects(downloadToFile('https://github.com/archive', dest, {}), {
        code: 'ERR_INVALID_URL',
    });
    assert.equal(requests.length, 1);
    assert.equal(resumes[0].mock.callCount(), 1);
    assert.equal(fs.existsSync(dest), false);
});

test('propagates request errors after a redirect', async t => {
    const error = new Error('Connection failed');
    const { dest, requests } = setupDownload(t, [
        { statusCode: 302, location: '/archive' },
        { error },
    ]);
    await assert.rejects(downloadToFile('https://github.com/start', dest, {}), error);
    assert.equal(requests.length, 2);
    assert.equal(fs.existsSync(dest), false);
});
