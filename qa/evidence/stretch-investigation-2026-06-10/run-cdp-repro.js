#!/usr/bin/env node
'use strict';

const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const fixtureDir = __dirname;
const repoRoot = path.resolve(fixtureDir, '../../..');
const extensionDir = path.join(repoRoot, 'extension');
const pageUrl = 'http://page.test:8125/index.html';
const port = 8125;
const imageIds = [
    'picture-fixed',
    'srcset-fixed',
    'picture-auto',
    'plain-tall',
    'cross-picture-fixed',
    'cross-srcset-fixed'
];

function getContentType(filePath) {
    if (filePath.endsWith('.html')) {
        return 'text/html; charset=utf-8';
    }
    if (filePath.endsWith('.svg')) {
        return 'image/svg+xml';
    }
    if (filePath.endsWith('.json')) {
        return 'application/json; charset=utf-8';
    }
    return 'application/octet-stream';
}

function startServer() {
    const server = http.createServer((request, response) => {
        const url = new URL(request.url, 'http://127.0.0.1');
        const pathname = url.pathname === '/' ? '/index.html' : url.pathname;
        const decodedPath = decodeURIComponent(pathname);
        const filePath = path.resolve(fixtureDir, '.' + decodedPath);

        if (!filePath.startsWith(fixtureDir + path.sep)) {
            response.writeHead(403);
            response.end('Forbidden');
            return;
        }

        fs.readFile(filePath, (error, data) => {
            if (error) {
                response.writeHead(404);
                response.end('Not found');
                return;
            }

            response.writeHead(200, {
                'content-type': getContentType(filePath),
                'cache-control': 'no-store'
            });
            response.end(data);
        });
    });

    return new Promise(resolve => {
        server.listen(port, '127.0.0.1', () => resolve(server));
    });
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchJson(url, options) {
    const response = await fetch(url, options);
    if (!response.ok) {
        throw new Error(`${url} returned HTTP ${response.status}`);
    }
    return response.json();
}

async function waitForDebugPort(remotePort) {
    const versionUrl = `http://127.0.0.1:${remotePort}/json/version`;
    const deadline = Date.now() + 10000;
    let lastError = null;

    while (Date.now() < deadline) {
        try {
            return await fetchJson(versionUrl);
        } catch (error) {
            lastError = error;
            await delay(100);
        }
    }

    throw lastError || new Error('Timed out waiting for Chrome debugging port');
}

class CdpClient {
    constructor(webSocketUrl) {
        this.webSocketUrl = webSocketUrl;
        this.nextId = 1;
        this.pending = new Map();
        this.events = [];
    }

    async connect() {
        this.ws = new WebSocket(this.webSocketUrl);
        this.ws.addEventListener('message', event => this.handleMessage(event));

        await new Promise((resolve, reject) => {
            this.ws.addEventListener('open', resolve, { once: true });
            this.ws.addEventListener('error', reject, { once: true });
        });
    }

    handleMessage(event) {
        const message = JSON.parse(event.data);
        if (message.id && this.pending.has(message.id)) {
            const { resolve, reject } = this.pending.get(message.id);
            this.pending.delete(message.id);
            if (message.error) {
                reject(new Error(message.error.message || JSON.stringify(message.error)));
            } else {
                resolve(message.result);
            }
            return;
        }

        this.events.push(message);
    }

    send(method, params = {}) {
        const id = this.nextId++;
        const payload = { id, method, params };
        this.ws.send(JSON.stringify(payload));

        return new Promise((resolve, reject) => {
            this.pending.set(id, { resolve, reject });
        });
    }

    close() {
        if (this.ws) {
            this.ws.close();
        }
    }
}

async function evaluate(cdp, expression) {
    const result = await cdp.send('Runtime.evaluate', {
        expression,
        awaitPromise: true,
        returnByValue: true
    });

    if (result.exceptionDetails) {
        throw new Error(result.exceptionDetails.text || 'Runtime evaluation failed');
    }

    return result.result.value;
}

function collectExpression() {
    return `(() => {
        const ids = ${JSON.stringify(imageIds)};
        const entries = ids.map(id => {
            const img = document.getElementById(id);
            const source = img && img.parentElement && img.parentElement.tagName === 'PICTURE' ?
                img.parentElement.querySelector('source') :
                null;
            if (!img) {
                return { id, exists: false };
            }
            return {
                id,
                exists: true,
                src: img.src,
                currentSrc: img.currentSrc,
                naturalWidth: img.naturalWidth,
                naturalHeight: img.naturalHeight,
                renderedWidth: img.width,
                renderedHeight: img.height,
                clientWidth: img.clientWidth,
                clientHeight: img.clientHeight,
                complete: img.complete,
                processedAttr: img.getAttribute('skf-is-processed'),
                toggledAttr: img.getAttribute('skf-is-toggled'),
                originalSrc: img.getAttribute('skf-original-src'),
                originalSrcset: img.getAttribute('skf-original-srcset'),
                sourceSrcset: source ? source.srcset : null,
                sourceOriginalSrcset: source ? source.getAttribute('skf-original-srcset') : null,
                naturalAspect: img.naturalHeight ? img.naturalWidth / img.naturalHeight : null,
                renderedAspect: img.clientHeight ? img.clientWidth / img.clientHeight : null
            };
        });
        return {
            href: location.href,
            readyState: document.readyState,
            entries
        };
    })()`;
}

async function waitForPageState(cdp, withExtension) {
    const deadline = Date.now() + 20000;
    let lastState = null;

    while (Date.now() < deadline) {
        lastState = await evaluate(cdp, collectExpression());
        const allLoaded = lastState.readyState === 'complete' &&
            lastState.entries.every(entry => entry.exists && entry.complete && entry.naturalWidth > 0);
        const extensionDone = lastState.entries
            .filter(entry => entry.id !== 'plain-tall')
            .every(entry => entry.src && entry.src.startsWith('blob:') && entry.processedAttr === 'true');

        if (allLoaded && (!withExtension || extensionDone)) {
            return lastState;
        }

        await delay(250);
    }

    return lastState;
}

async function runScenario(name, withExtension) {
    const remotePort = withExtension ? 9338 : 9337;
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), `fitnafilter-${name}-`));
    const chromeArgs = [
        '--no-sandbox',
        '--disable-gpu',
        '--disable-dev-shm-usage',
        '--no-first-run',
        '--no-default-browser-check',
        '--no-proxy-server',
        '--window-size=1280,1000',
        `--user-data-dir=${userDataDir}`,
        `--remote-debugging-port=${remotePort}`,
        '--host-resolver-rules=MAP page.test 127.0.0.1, MAP cdn.test 127.0.0.1'
    ];

    if (withExtension) {
        chromeArgs.push(`--disable-extensions-except=${extensionDir}`);
        chromeArgs.push(`--load-extension=${extensionDir}`);
    } else {
        chromeArgs.push('--disable-extensions');
    }

    const command = '/usr/bin/xvfb-run';
    const args = ['-a', '/usr/bin/brave-browser', ...chromeArgs];
    const chrome = spawn(command, args, {
        stdio: ['ignore', 'ignore', 'pipe']
    });
    const stderr = [];
    chrome.stderr.on('data', chunk => stderr.push(chunk.toString()));

    let cdp = null;
    try {
        await waitForDebugPort(remotePort);
        const initialTargets = await fetchJson(`http://127.0.0.1:${remotePort}/json/list`);
        const target = await fetchJson(
            `http://127.0.0.1:${remotePort}/json/new?${encodeURIComponent('about:blank')}`,
            { method: 'PUT' }
        );
        cdp = new CdpClient(target.webSocketDebuggerUrl);
        await cdp.connect();
        await cdp.send('Runtime.enable');
        await cdp.send('Page.enable');
        await cdp.send('Page.navigate', { url: pageUrl });

        const state = await waitForPageState(cdp, withExtension);
        const screenshot = await cdp.send('Page.captureScreenshot', {
            format: 'png',
            fromSurface: true
        });

        const screenshotPath = path.join(fixtureDir, `${name}.png`);
        fs.writeFileSync(screenshotPath, Buffer.from(screenshot.data, 'base64'));

        const finalTargets = await fetchJson(`http://127.0.0.1:${remotePort}/json/list`);

        return {
            name,
            withExtension,
            state,
            screenshotPath,
            initialTargets: initialTargets.map(item => ({
                type: item.type,
                title: item.title,
                url: item.url
            })),
            finalTargets: finalTargets.map(item => ({
                type: item.type,
                title: item.title,
                url: item.url
            })),
            stderr: stderr.join('').split('\n').filter(Boolean).slice(-20)
        };
    } finally {
        if (cdp) {
            cdp.close();
        }
        chrome.kill('SIGTERM');
        await delay(500);
        if (!chrome.killed) {
            chrome.kill('SIGKILL');
        }
        fs.rmSync(userDataDir, { recursive: true, force: true });
    }
}

function summarize(results) {
    const byName = Object.fromEntries(results.map(result => [result.name, result.state]));
    const controlEntries = Object.fromEntries(byName.control.entries.map(entry => [entry.id, entry]));
    const extensionEntries = Object.fromEntries(byName.extension.entries.map(entry => [entry.id, entry]));

    return imageIds.map(id => {
        const control = controlEntries[id];
        const extension = extensionEntries[id];
        return {
            id,
            controlCurrentSrc: control.currentSrc,
            controlNatural: `${control.naturalWidth}x${control.naturalHeight}`,
            extensionCurrentSrc: extension.currentSrc,
            extensionOriginalSrc: extension.originalSrc,
            extensionOriginalSrcset: extension.originalSrcset,
            extensionSourceOriginalSrcset: extension.sourceOriginalSrcset,
            extensionNatural: `${extension.naturalWidth}x${extension.naturalHeight}`,
            rendered: `${extension.clientWidth}x${extension.clientHeight}`,
            naturalAspect: extension.naturalAspect,
            renderedAspect: extension.renderedAspect
        };
    });
}

(async () => {
    const server = await startServer();
    try {
        const results = [
            await runScenario('control', false),
            await runScenario('extension', true)
        ];
        const output = {
            pageUrl,
            generatedAt: new Date().toISOString(),
            results,
            summary: summarize(results)
        };
        const outputPath = path.join(fixtureDir, 'results.json');
        fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
        console.log(JSON.stringify(output.summary, null, 2));
        console.log(`Wrote ${outputPath}`);
    } finally {
        await new Promise(resolve => server.close(resolve));
    }
})().catch(error => {
    console.error(error);
    process.exit(1);
});
