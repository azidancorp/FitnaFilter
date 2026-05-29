#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const backgroundCode = fs.readFileSync('src/js/background.js', 'utf8');

function createContext(overrides = {}) {
    let capturedMessageListener = null;
    const noopListener = {
        addListener() {}
    };
    const messageListener = {
        addListener(callback) {
            capturedMessageListener = callback;
        }
    };

    const context = {
        console: {
            log() {},
            warn() {},
            error() {}
        },
        URL,
        Blob,
        Response,
        AbortController,
        FileReader: class {},
        setTimeout,
        clearTimeout,
        importScripts() {},
        BLOCKLISTS: {},
        fetchAndProcessBlocklist: async () => ({ domainToBlocklistMap: new Map() }),
        chrome: {
            storage: {
                sync: { get: async () => ({}) },
                local: {
                    get: async () => ({}),
                    set() {}
                }
            },
            tabs: {
                onRemoved: noopListener,
                onReplaced: noopListener,
                sendMessage() {}
            },
            runtime: {
                onInstalled: noopListener,
                onStartup: noopListener,
                onMessage: messageListener,
                lastError: null
            },
            webNavigation: { onBeforeNavigate: noopListener },
            action: { setIcon() {} }
        },
        ...overrides
    };

    vm.createContext(context);
    vm.runInContext(backgroundCode, context);
    context.capturedMessageListener = capturedMessageListener;
    return context;
}

function assertAccess(context, label, requestUrl, senderUrl, expected) {
    const actual = context.canRequesterAccessPrivateImage(requestUrl, senderUrl);
    assert.strictEqual(actual, expected, label);
}

async function testAccessRules() {
    const context = createContext();
    const publicSender = 'https://attacker.example/page';

    assertAccess(context, 'public image allowed', 'https://cdn.example/image.png', publicSender, true);
    assertAccess(context, 'localhost multiple trailing dots denied',
        'http://localhost../image.png', publicSender, false);
    assertAccess(context, 'single-label local DNS denied', 'http://router/image.png', publicSender, false);
    assertAccess(context, 'localdomain suffix denied', 'http://nas.localdomain/image.png', publicSender, false);
    assertAccess(context, 'home.arpa suffix denied', 'http://camera.home.arpa/image.png', publicSender, false);
    assertAccess(context, 'IPv6 fe80 link-local denied', 'http://[fe80::1]/image.png', publicSender, false);
    assertAccess(context, 'IPv6 fe81 link-local denied', 'http://[fe81::1]/image.png', publicSender, false);
    assertAccess(context, 'IPv6 febf link-local denied', 'http://[febf::1]/image.png', publicSender, false);
    assertAccess(context, 'IPv4-mapped IPv6 denied', 'http://[::ffff:192.168.1.1]/image.png', publicSender, false);
    assertAccess(context, 'public to private IPv4 denied', 'http://192.168.1.1/image.png', publicSender, false);
    assertAccess(context, 'private same-origin allowed', 'http://192.168.1.1/image.png',
        'http://192.168.1.1/page', true);
    assertAccess(context, 'private different port denied', 'http://127.0.0.1:9000/image.png',
        'http://127.0.0.1:8000/page', false);
    assertAccess(context, 'missing sender denied for private target', 'http://127.0.0.1/image.png', undefined, false);
    assertAccess(context, 'userinfo rejected', 'https://user:pass@example.com/image.png', publicSender, false);
}

async function testResponseLimits() {
    const context = createContext();
    const imageBlob = await context.responseToLimitedBlob(new Response('abc', {
        headers: { 'content-type': 'image/png' }
    }));
    assert.strictEqual(imageBlob.size, 3, 'image response should be accepted');

    await assert.rejects(
        () => context.responseToLimitedBlob(new Response('abc', {
            headers: { 'content-type': 'text/html' }
        })),
        /Unexpected content type/,
        'non-image response should be rejected'
    );

    await assert.rejects(
        () => context.responseToLimitedBlob(new Response('abc', {
            headers: {
                'content-type': 'image/png',
                'content-length': String(10 * 1024 * 1024 + 1)
            }
        })),
        /Image response too large/,
        'oversized response should be rejected by declared length'
    );
}

async function testMissingSenderFailsClosed() {
    const context = createContext({
        fetch: async () => {
            throw new Error('fetch should not run without sender.url');
        }
    });

    const response = await new Promise(resolve => {
        context.capturedMessageListener(
            { r: 'fetchAndReadImage', url: 'https://cdn.example/image.png' },
            {},
            resolve
        );
    });

    assert.strictEqual(response.success, false, 'missing sender.url should fail the request');
    assert.strictEqual(response.error, 'URL not allowed', 'missing sender.url should be rejected');
}

async function testFetchTimeoutPath() {
    const abortError = new Error('aborted');
    abortError.name = 'AbortError';

    const context = createContext({
        setTimeout(callback, delay) {
            if (delay === 15000) {
                callback();
            }
            return 1;
        },
        clearTimeout() {},
        fetch: async (url, options) => {
            assert.strictEqual(url, 'https://cdn.example/image.png', 'fetch URL should pass through');
            assert.strictEqual(options.credentials, 'omit', 'fetch should omit credentials');
            assert.strictEqual(options.redirect, 'error', 'fetch should reject redirects');
            assert.ok(options.signal, 'fetch should receive an AbortSignal');
            if (options.signal.aborted) {
                throw abortError;
            }
            return new Response('abc', { headers: { 'content-type': 'image/png' } });
        }
    });

    const response = await new Promise(resolve => {
        context.capturedMessageListener(
            { r: 'fetchAndReadImage', url: 'https://cdn.example/image.png' },
            { url: 'https://page.example/' },
            resolve
        );
    });

    assert.strictEqual(response.success, false, 'AbortError should fail the request');
    assert.strictEqual(response.error, 'Image fetch timed out', 'AbortError should be reported as timeout');
}

(async () => {
    await testAccessRules();
    await testResponseLimits();
    await testMissingSenderFailsClosed();
    await testFetchTimeoutPath();
    console.log('background fetch guard checks passed');
})().catch(error => {
    console.error(error);
    process.exit(1);
});
