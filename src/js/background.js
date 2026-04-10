let excludeForTabList = [];
let pauseForTabList = [];
const domainRegex = /^\w+:\/\/([\w.:+-]+)/;

const DEFAULT_SETTINGS = {
    urlList: [],
    isNoEye: false,
    isNoFaceFeatures: false,
    maxSafe: 32,
    autoUnpause: true,
    autoUnpauseTimeout: 15,
    filterColor: 'grey',
    isPaused: false,
    pausedTime: null,
    isBlackList: false,
    excludeLocalhost: true
};

// Import domain filtering functionality
importScripts('content/DomainFilter.js');

// Blocklist feature variables
let blockedDomains = new Set();
let domainToBlocklistMap = new Map(); // Maps domain to blocklist name for contextual redirects
let blocklistLoadPromise = null;
let hasLoadedBlocklists = false;
let blocklistRetryTimerId = null;
const BLOCKLIST_RETRY_DELAY_MS = 30000;

function safeParseJson(value, fallbackValue) {
    if (typeof value !== 'string' || !value) {
        return fallbackValue;
    }

    try {
        return JSON.parse(value);
    } catch (error) {
        console.warn('FitnaFilter: failed to parse stored JSON value', error);
        return fallbackValue;
    }
}

function normalizeUrlListEntry(value, domainOnly) {
    if (typeof value !== 'string') {
        return null;
    }

    const normalizedValue = value.trim().toLowerCase();
    if (!normalizedValue) {
        return null;
    }

    if (domainOnly) {
        return getDomain(normalizedValue);
    }

    if (normalizedValue.length < 3 || /\s/.test(normalizedValue)) {
        return null;
    }

    return normalizedValue;
}

function dedupeStringList(list) {
    const seen = new Set();
    const deduped = [];

    list.forEach(item => {
        if (typeof item === 'string' && !seen.has(item)) {
            seen.add(item);
            deduped.push(item);
        }
    });

    return deduped;
}

function isUrlInUserList(url, urlList) {
    if (typeof url !== 'string') {
        return false;
    }

    const lowerUrl = url.toLowerCase();
    for (let index = 0; index < urlList.length; index++) {
        if (lowerUrl.indexOf(urlList[index]) !== -1) {
            return true;
        }
    }

    return false;
}

function maybeAutoUnpause(settings) {
    if (!settings || typeof settings.pausedTime !== 'number' || !settings.autoUnpause) {
        return;
    }

    if (settings.pausedTime + (settings.autoUnpauseTimeout * 60) >= (Date.now() / 1000)) {
        return;
    }

    chrome.storage.local.set({ isPaused: 0, pausedTime: null });
    settings.isPaused = false;
    settings.pausedTime = null;
    storedSettings.isPaused = false;
    storedSettings.pausedTime = null;
}

function getTabOverrideState(tabId, url) {
    const state = {
        isPausedForTab: false,
        isExcludedForTab: false
    };

    if (typeof tabId === 'number' && pauseForTabList.indexOf(tabId) !== -1) {
        state.isPausedForTab = true;
    }

    if (typeof tabId === 'number' && typeof url === 'string') {
        const domain = getDomain(url);
        if (domain) {
            state.isExcludedForTab = excludeForTabList.some(entry => entry.tabId === tabId && entry.domain === domain);
        }
    }

    return state;
}

function getExclusionState(url, settings) {
    const exclusionState = {
        isExcluded: false,
        isExcludedByLocalhost: false,
        isExcludedByUserList: false,
        isInUserList: false
    };

    if (!settings || typeof url !== 'string') {
        return exclusionState;
    }

    const hostname = getHostname(url);
    exclusionState.isExcludedByLocalhost = settings.excludeLocalhost &&
        (isLocalhostHostname(hostname) || isLocalFileUrl(url));

    const urlList = Array.isArray(settings.urlList) ? settings.urlList : [];
    exclusionState.isInUserList = isUrlInUserList(url, urlList);
    exclusionState.isExcludedByUserList = settings.isBlackList ? !exclusionState.isInUserList : exclusionState.isInUserList;
    exclusionState.isExcluded = exclusionState.isExcludedByLocalhost || exclusionState.isExcludedByUserList;

    return exclusionState;
}

function getComputedTabState(tab, settings) {
    const computedState = {
        isPaused: !!settings.isPaused,
        pausedTime: settings.pausedTime,
        autoUnpause: !!settings.autoUnpause,
        autoUnpauseTimeout: settings.autoUnpauseTimeout,
        isNoEye: !!settings.isNoEye,
        isNoFaceFeatures: !!settings.isNoFaceFeatures,
        maxSafe: settings.maxSafe,
        filterColor: settings.filterColor,
        isBlackList: !!settings.isBlackList,
        excludeLocalhost: settings.excludeLocalhost,
        isPausedForTab: false,
        isExcludedForTab: false,
        isExcluded: false
    };

    if (!tab) {
        return computedState;
    }

    const overrideState = getTabOverrideState(tab.id, tab.url);
    computedState.isPausedForTab = overrideState.isPausedForTab;
    computedState.isExcludedForTab = overrideState.isExcludedForTab;

    if (tab.url) {
        computedState.isExcluded = getExclusionState(tab.url, settings).isExcluded;
    }

    return computedState;
}

async function refreshBlocklists() {
    if (blocklistRetryTimerId !== null) {
        clearTimeout(blocklistRetryTimerId);
        blocklistRetryTimerId = null;
    }

    const currentLoad = fetchAndProcessBlocklist();
    blocklistLoadPromise = currentLoad;

    try {
        const nextBlocklists = await currentLoad;
        if (blocklistLoadPromise !== currentLoad) {
            return false;
        }

        blockedDomains = nextBlocklists.blockedDomains;
        domainToBlocklistMap = nextBlocklists.domainToBlocklistMap;
        hasLoadedBlocklists = true;
        blocklistLoadPromise = null;
        return true;
    } catch (error) {
        if (blocklistLoadPromise === currentLoad) {
            console.error('FitnaFilter: failed to refresh blocklists', error);
            blocklistLoadPromise = null;
            if (!hasLoadedBlocklists && blocklistRetryTimerId === null) {
                // Retry the initial warm-up after a short delay in case startup timing caused the failure.
                blocklistRetryTimerId = setTimeout(() => {
                    blocklistRetryTimerId = null;
                    if (!hasLoadedBlocklists && !blocklistLoadPromise) {
                        refreshBlocklists();
                    }
                }, BLOCKLIST_RETRY_DELAY_MS);
            }
        }
        return false;
    }
}

function isPrivateNetworkHostname(hostname) {
    if (!hostname) {
        return false;
    }

    if (isLocalhostHostname(hostname)) {
        return true;
    }

    if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname)) {
        const octets = hostname.split('.').map(Number);
        if (octets.some(octet => Number.isNaN(octet) || octet < 0 || octet > 255)) {
            return false;
        }

        return octets[0] === 10 ||
            octets[0] === 127 ||
            (octets[0] === 169 && octets[1] === 254) ||
            (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
            (octets[0] === 192 && octets[1] === 168);
    }

    const normalizedHostname = hostname.toLowerCase();
    return normalizedHostname === '::1' ||
        normalizedHostname.startsWith('fc') ||
        normalizedHostname.startsWith('fd') ||
        normalizedHostname.startsWith('fe80:');
}

function canRequesterAccessPrivateImage(requestUrl, senderTabUrl) {
    if (typeof requestUrl !== 'string' || !requestUrl) {
        return false;
    }

    try {
        const parsedRequestUrl = new URL(requestUrl);
        if (parsedRequestUrl.protocol !== 'http:' && parsedRequestUrl.protocol !== 'https:') {
            return false;
        }

        if (!isPrivateNetworkHostname(parsedRequestUrl.hostname)) {
            return true;
        }

        if (typeof senderTabUrl !== 'string' || !senderTabUrl) {
            return false;
        }

        const senderProtocol = getUrlProtocol(senderTabUrl);
        if (senderProtocol === 'file:' || senderProtocol === 'filesystem:') {
            return true;
        }

        const senderHostname = getHostname(senderTabUrl);
        return isPrivateNetworkHostname(senderHostname);
    } catch (error) {
        return false;
    }
}


async function getSettings() {
    const syncResult = await chrome.storage.sync.get({
        'urlList': null,
        'isNoEye': null,
        'isNoFaceFeatures': null,
        'maxSafe': null,
        'autoUnpause': null,
        'autoUnpauseTimeout': null,
        'blocklistSettings': null,
        'filterColor': null,
        'excludeLocalhost': null
    });

    const nextSettings = { ...DEFAULT_SETTINGS };
    nextSettings.urlList = dedupeStringList(safeParseJson(syncResult.urlList, []));
    nextSettings.isNoEye = syncResult.isNoEye == 1;
    nextSettings.isNoFaceFeatures = syncResult.isNoFaceFeatures == 1;
    nextSettings.maxSafe = +syncResult.maxSafe || DEFAULT_SETTINGS.maxSafe;
    nextSettings.autoUnpause = syncResult.autoUnpause !== null ? syncResult.autoUnpause == 1 : DEFAULT_SETTINGS.autoUnpause;
    nextSettings.autoUnpauseTimeout = syncResult.autoUnpauseTimeout !== null &&
        syncResult.autoUnpauseTimeout !== undefined ? (+syncResult.autoUnpauseTimeout || 0) : DEFAULT_SETTINGS.autoUnpauseTimeout;
    if (nextSettings.autoUnpauseTimeout < 1 || nextSettings.autoUnpauseTimeout > 1000) {
        nextSettings.autoUnpauseTimeout = DEFAULT_SETTINGS.autoUnpauseTimeout;
    }
    nextSettings.filterColor = ['white', 'black', 'grey'].includes(syncResult.filterColor) ? syncResult.filterColor : DEFAULT_SETTINGS.filterColor;
    nextSettings.excludeLocalhost = syncResult.excludeLocalhost !== null ? syncResult.excludeLocalhost == 1 : DEFAULT_SETTINGS.excludeLocalhost;

    // Load blocklist settings
    if (syncResult.blocklistSettings) {
        const savedBlocklists = safeParseJson(syncResult.blocklistSettings, {});
        for (const [key, value] of Object.entries(savedBlocklists)) {
            if (BLOCKLISTS[key]) {
                BLOCKLISTS[key].enabled = value;
            }
        }
    }

    const localResult = await chrome.storage.local.get({ 'isPaused': null, 'pausedTime': null });
    nextSettings.isPaused = localResult.isPaused == 1;
    nextSettings.pausedTime = typeof localResult.pausedTime === 'number' ? localResult.pausedTime : null;
    maybeAutoUnpause(nextSettings);

    // Preserve blacklist mode if ever set elsewhere
    if (typeof storedSettings.isBlackList === 'boolean') {
        nextSettings.isBlackList = storedSettings.isBlackList;
    }

    storedSettings = nextSettings;
    return storedSettings;
}

let storedSettings = { ...DEFAULT_SETTINGS };
getSettings()
.then(onSuccess => {
    storedSettings = onSuccess;
    console.log("Startup storedSettings: " + JSON.stringify(storedSettings));
    // Start blocklist processing after initial settings load
    refreshBlocklists();
});

/**
 * Remove any per-tab pause/exclusion entries for a tab.
 * These lists live in-memory only, so we must prune when tabs close/rebind.
 * @param {number} tabId
 */
function pruneTabState(tabId) {
    pauseForTabList = pauseForTabList.filter(id => id !== tabId);
    excludeForTabList = excludeForTabList.filter(entry => entry.tabId !== tabId);
}

// Clean up in-memory per-tab state to avoid unbounded growth.
chrome.tabs.onRemoved.addListener((tabId) => {
    pruneTabState(tabId);
});

chrome.tabs.onReplaced.addListener((addedTabId, removedTabId) => {
    pruneTabState(removedTabId);
});

function getDomain(url) {
    var regex = domainRegex.exec(url);
    return regex ? regex[1].toLowerCase() : null;
}

/**
 * Extract a URL protocol (e.g. "https:", "file:") from a URL string.
 * @param {string} url
 * @returns {string|null}
 */
function getUrlProtocol(url) {
    if (typeof url !== 'string' || !url) {
        return null;
    }

    const normalizedUrl = url.startsWith('view-source:') ? url.slice('view-source:'.length) : url;

    try {
        return new URL(normalizedUrl).protocol.toLowerCase();
    } catch (error) {
        const index = normalizedUrl.indexOf(':');
        if (index === -1) {
            return null;
        }
        return normalizedUrl.slice(0, index + 1).toLowerCase();
    }
}

/**
 * Extract a hostname from a URL string, including bracketed IPv6 hosts like http://[::1]:3000/.
 * @param {string} url
 * @returns {string|null}
 */
function getHostname(url) {
    if (typeof url !== 'string' || !url) {
        return null;
    }

    const normalizedUrl = url.startsWith('view-source:') ? url.slice('view-source:'.length) : url;

    try {
        const parsedUrl = new URL(normalizedUrl);
        if (!parsedUrl.hostname) {
            return null;
        }
        return parsedUrl.hostname.toLowerCase().replace(/\.$/, '');
    } catch (error) {
        const domain = getDomain(url);
        if (!domain) {
            return null;
        }
        return domain.split(':')[0].toLowerCase().replace(/\.$/, '');
    }
}

/**
 * Determine whether a hostname is a localhost variant (IPv4/IPv6 loopback or .localhost domains).
 * @param {string|null} hostname
 * @returns {boolean}
 */
function isLocalhostHostname(hostname) {
    if (!hostname) {
        return false;
    }

    return hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname === '::1' ||
        hostname.endsWith('.localhost');
}

/**
 * Determine whether a URL is a local file URL (file:// or filesystem:).
 * @param {string} url
 * @returns {boolean}
 */
function isLocalFileUrl(url) {
    const protocol = getUrlProtocol(url);
    return protocol === 'file:' || protocol === 'filesystem:';
}

function saveUrlList(urlList) {
    chrome.storage.sync.set({"urlList": JSON.stringify(urlList)});
}
chrome.runtime.onMessage.addListener(
    function(request, sender, sendResponse) {
        switch (request.r) {
            case 'getSettings': {
                getSettings()
                    .then(freshSettings => {
                        const tab = request.tab || sender.tab;
                        const settings = getComputedTabState(tab, freshSettings);
                        sendResponse(settings);
                    })
                    .catch(error => {
                        console.error('Error getting settings:', error);
                        sendResponse({ isPaused: false, isNoEye: false, isNoFaceFeatures: false, maxSafe: DEFAULT_SETTINGS.maxSafe, filterColor: DEFAULT_SETTINGS.filterColor });
                    });
                break;
            }
            case 'setColorIcon':
                chrome.action.setIcon({ path: request.toggle ? '../images/icon.png' : '../images/icon-d.png', tabId: sender.tab.id });
                break;
            case 'urlListAdd': {
                const url = normalizeUrlListEntry(request.url, !!request.domainOnly);
                if (!url) {
                    sendResponse(false);
                    break;
                }
                chrome.storage.sync.get({ urlList: '[]' })
                    .then(result => {
                        const list = dedupeStringList(safeParseJson(result.urlList, []));
                        if (list.indexOf(url) === -1) {
                            list.push(url);
                        }
                        return chrome.storage.sync.set({ urlList: JSON.stringify(list) })
                            .then(() => list);
                    })
                    .then(list => {
                        storedSettings.urlList = list;
                        chrome.runtime.sendMessage({ r: 'urlListModified' });
                        sendResponse(true);
                    })
                    .catch(error => {
                        console.error('Error adding URL to list:', error);
                        sendResponse(false);
                    });
                break;
            }
            case 'urlListRemove': {
                chrome.storage.sync.get({ urlList: '[]' })
                    .then(result => {
                        let list = dedupeStringList(safeParseJson(result.urlList, []));
                        if (request.exactUrl || request.domainOnly) {
                            const exactUrl = normalizeUrlListEntry(request.exactUrl || request.url, !!request.domainOnly);
                            if (exactUrl) {
                                list = list.filter(item => item !== exactUrl);
                            }
                        } else if (request.url) {
                            const normalizedRequestUrl = normalizeUrlListEntry(request.url, false);
                            if (normalizedRequestUrl) {
                                list = list.filter(item => item !== normalizedRequestUrl);
                            }
                        } else if (typeof request.index === 'number' && request.index >= 0 && request.index < list.length) {
                            list.splice(request.index, 1);
                        }
                        return chrome.storage.sync.set({ urlList: JSON.stringify(list) })
                            .then(() => list);
                    })
                    .then(list => {
                        storedSettings.urlList = list;
                        chrome.runtime.sendMessage({ r: 'urlListModified' });
                        sendResponse(true);
                    })
                    .catch(error => {
                        console.error('Error removing URL from list:', error);
                        sendResponse(false);
                    });
                break;
            }
            case 'getUrlList': {
                chrome.storage.sync.get({ urlList: '[]' })
                    .then(result => {
                        const list = dedupeStringList(safeParseJson(result.urlList, []));
                        storedSettings.urlList = list;
                        sendResponse(list);
                    })
                    .catch(error => {
                        console.error('Error getting URL list:', error);
                        sendResponse([]);
                    });
                break;
            }
            case 'setUrlList': {
                if (!Array.isArray(request.urlList)) {
                    sendResponse(false);
                    break;
                }
                const list = dedupeStringList(request.urlList
                    .map(item => normalizeUrlListEntry(item, false))
                    .filter(item => !!item));
                chrome.storage.sync.set({ urlList: JSON.stringify(list) })
                    .then(() => {
                        storedSettings.urlList = list;
                        chrome.runtime.sendMessage({ r: 'urlListModified' });
                        sendResponse(true);
                    })
                    .catch(error => {
                        console.error('Error setting URL list:', error);
                        sendResponse(false);
                    });
                break;
            }
            case 'excludeForTab':
                var domain = getDomain(request.tab.url);
                if (!domain) {
                    sendResponse(false);
                    break;
                }
                if (request.toggle) {
                    // Prevent duplicates if the same tab/domain is toggled repeatedly.
                    const existing = excludeForTabList.find(entry => entry.tabId === request.tab.id && entry.domain === domain);
                    if (!existing) {
                        excludeForTabList.push({ tabId: request.tab.id, domain: domain });
                    }
                } else {
                    for (let i = 0; i < excludeForTabList.length; i++) {
                        if (excludeForTabList[i].tabId === request.tab.id && excludeForTabList[i].domain === domain) {
                            excludeForTabList.splice(i, 1);
                            break;
                        }
                    }
                }
                sendResponse(true);
                break;
            case 'pause': {
                const isPaused = !!request.toggle;
                const pausedTime = isPaused ? Math.floor(Date.now() / 1000) : null;
                chrome.storage.local.set({ "isPaused": isPaused ? 1 : 0, "pausedTime": pausedTime });
                storedSettings.isPaused = isPaused;
                storedSettings.pausedTime = pausedTime;
                sendResponse(true);
                break;
            }
            case 'pauseForTab':
                if (request.toggle) {
                    if (pauseForTabList.indexOf(request.tabId) === -1) {
                        pauseForTabList.push(request.tabId);
                    }
                } else {
                    for (let i = 0; i < pauseForTabList.length; i++) {
                        if (pauseForTabList[i] === request.tabId) {
                            pauseForTabList.splice(i, 1);
                            break;
                        }
                    }
                }
                sendResponse(true);
                break;
            case 'setNoEye': {
                const noEyeValue = request.toggle ? 1 : 0;
                storedSettings.isNoEye = !!request.toggle;
                chrome.storage.sync.set({"isNoEye": noEyeValue});
                sendResponse(true);
                break;
            }
            case 'setNoFaceFeatures': {
                const noFaceValue = request.toggle ? 1 : 0;
                storedSettings.isNoFaceFeatures = !!request.toggle;
                chrome.storage.sync.set({"isNoFaceFeatures": noFaceValue});
                sendResponse(true);
                break;
            }
            case 'setAutoUnpause': {
                const autoUnpauseValue = request.toggle ? 1 : 0;
                storedSettings.autoUnpause = !!request.toggle;
                chrome.storage.sync.set({"autoUnpause": autoUnpauseValue});
                sendResponse(true);
                break;
            }
            case 'setAutoUnpauseTimeout': {
                let autoUnpauseTimeout = +request.autoUnpauseTimeout;
                if (!autoUnpauseTimeout || autoUnpauseTimeout < 1 || autoUnpauseTimeout > 1000) {
                    autoUnpauseTimeout = 15;
                }
                storedSettings.autoUnpauseTimeout = autoUnpauseTimeout;
                chrome.storage.sync.set({"autoUnpauseTimeout": autoUnpauseTimeout});
                sendResponse(true);
                break;
            }
            case 'setExcludeLocalhost': {
                const excludeLocalhostValue = request.toggle ? 1 : 0;
                storedSettings.excludeLocalhost = !!request.toggle;
                chrome.storage.sync.set({"excludeLocalhost": excludeLocalhostValue});
                sendResponse(true);
                break;
            }
            case 'setMaxSafe': {
                let ms = +request.maxSafe;
                if (!ms || ms < 1 || ms > 1000) {
                    ms = 32;
                }
                storedSettings.maxSafe = ms;
                chrome.storage.sync.set({"maxSafe": ms});
                sendResponse(true);
                break;
            }
            case 'setFilterColor': {
                const validColors = ['white', 'black', 'grey'];
                const color = request.color && validColors.includes(request.color) ? request.color : 'grey';
                storedSettings.filterColor = color;
                chrome.storage.sync.set({"filterColor": color});
                sendResponse(true);
                break;
            }
            case 'getBlocklists':
                const blocklistInfo = {};
                for (const [key, blocklist] of Object.entries(BLOCKLISTS)) {
                    blocklistInfo[key] = {
                        enabled: blocklist.enabled,
                        description: blocklist.description,
                        category: blocklist.category // Include category information
                    };
                }
                sendResponse(blocklistInfo);
                break;
            case 'toggleBlocklist':
                if (request.name && BLOCKLISTS[request.name]) {
                    BLOCKLISTS[request.name].enabled = request.enabled;
                    saveBlocklistSettings();
                    refreshBlocklists()
                        .then(success => {
                            sendResponse(success);
                        })
                        .catch(error => {
                            console.error('Error toggling blocklist:', error);
                            sendResponse(false);
                        });
                } else {
                    sendResponse(false);
                }
                break;
            case 'fetchAndReadImage': {
                const respondWithError = (errorMessage) => {
                    console.error('FitnaFilter: fetchAndReadImage failed', errorMessage);
                    sendResponse({ success: false, error: errorMessage });
                };

                if (!request.url) {
                    respondWithError('Missing image URL');
                    break;
                }

                if (!canRequesterAccessPrivateImage(request.url, sender.tab && sender.tab.url)) {
                    respondWithError('URL not allowed');
                    break;
                }

                fetch(request.url)
                    .then((response) => {
                        if (!response.ok) {
                            throw new Error('Unexpected status ' + response.status);
                        }
                        return response.blob();
                    })
                    .then(rblob => new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result);
                        reader.onerror = () => reject(new Error('Could not read fetched blob'));
                        reader.readAsDataURL(rblob);
                    }))
                    .then(dataUrl => {
                        sendResponse({ success: true, dataUrl });
                    })
                    .catch(error => {
                        respondWithError(error.message || 'Unknown fetch failure');
                    });
                break;
            }
        }
        return true;
    }
);

/**
 * Save blocklist settings to storage
 */
function saveBlocklistSettings() {
    const settings = {};
    
    // Extract just the enabled status for each blocklist
    for (const [key, blocklist] of Object.entries(BLOCKLISTS)) {
        settings[key] = blocklist.enabled;
    }
    
    chrome.storage.sync.set({
        "blocklistSettings": JSON.stringify(settings)
    });
}


// Listen for navigation events
chrome.webNavigation.onBeforeNavigate.addListener(
    (details) => {
        // Only intercept main frame navigation (not iframes, etc)
        if (details.frameId !== 0) return;
        
        try {
            // Get the hostname from the URL
            const url = new URL(details.url);
            const hostname = url.hostname;
            
            maybeAutoUnpause(storedSettings);

            const computedState = getComputedTabState({ id: details.tabId, url: details.url }, storedSettings);
            if (computedState.isPaused || computedState.isPausedForTab ||
                computedState.isExcluded || computedState.isExcludedForTab) {
                return;
            }

            if (!hasLoadedBlocklists && blocklistLoadPromise) {
                console.log('FitnaFilter: skipping navigation block while blocklists are warming up');
                return;
            }

            const matchedDomain = findMatchingBlockedDomain(hostname);
            if (matchedDomain) {
                const blocklistName = domainToBlocklistMap.get(matchedDomain);
                const redirectUrl = getContextualRedirectUrl(blocklistName);
                
                console.log(`Blocked navigation to: ${hostname} (${blocklistName}) -> redirecting to: ${redirectUrl}`);
                
                // Redirect the tab to contextual Quran verse
                chrome.tabs.update(details.tabId, { 
                    url: redirectUrl 
                });
            }
        } catch (error) {
            console.error("Error processing navigation:", error);
        }
    },
    { url: [{ schemes: ['http', 'https'] }] }
);

/**
 * Find a matching blocked domain by walking the hostname labels.
 * @param {string} hostname
 * @returns {string|null}
 */
function findMatchingBlockedDomain(hostname) {
    if (!hostname) {
        return null;
    }

    let candidate = hostname.toLowerCase();
    while (candidate) {
        if (blockedDomains.has(candidate)) {
            return candidate;
        }

        const nextDot = candidate.indexOf('.');
        if (nextDot === -1) {
            break;
        }
        candidate = candidate.slice(nextDot + 1);
    }

    return null;
}
