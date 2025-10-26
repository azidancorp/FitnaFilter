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
    isBlackList: false
};

// Import domain filtering functionality
importScripts('content/DomainFilter.js');

// Blocklist feature variables
let blockedDomains = new Set();
let domainToBlocklistMap = new Map(); // Maps domain to blocklist name for contextual redirects


async function getSettings() {
    const syncResult = await chrome.storage.sync.get({
        'urlList': null,
        'isNoEye': null,
        'isNoFaceFeatures': null,
        'maxSafe': null,
        'autoUnpause': null,
        'autoUnpauseTimeout': null,
        'blocklistSettings': null,
        'filterColor': null
    });

    const nextSettings = { ...DEFAULT_SETTINGS };
    nextSettings.urlList = syncResult.urlList ? JSON.parse(syncResult.urlList) : [];
    nextSettings.isNoEye = syncResult.isNoEye == 1;
    nextSettings.isNoFaceFeatures = syncResult.isNoFaceFeatures == 1;
    nextSettings.maxSafe = +syncResult.maxSafe || DEFAULT_SETTINGS.maxSafe;
    nextSettings.autoUnpause = syncResult.autoUnpause !== null ? syncResult.autoUnpause == 1 : DEFAULT_SETTINGS.autoUnpause;
    nextSettings.autoUnpauseTimeout = +syncResult.autoUnpauseTimeout || DEFAULT_SETTINGS.autoUnpauseTimeout;
    nextSettings.filterColor = ['white', 'black', 'grey'].includes(syncResult.filterColor) ? syncResult.filterColor : DEFAULT_SETTINGS.filterColor;

    // Load blocklist settings
    if (syncResult.blocklistSettings) {
        const savedBlocklists = JSON.parse(syncResult.blocklistSettings);
        for (const [key, value] of Object.entries(savedBlocklists)) {
            if (BLOCKLISTS[key]) {
                BLOCKLISTS[key].enabled = value;
            }
        }
    }

    const localResult = await chrome.storage.local.get({ 'isPaused': null, 'pausedTime': null });
    nextSettings.isPaused = localResult.isPaused == 1;
    nextSettings.pausedTime = typeof localResult.pausedTime === 'number' ? localResult.pausedTime : null;

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
    fetchAndProcessBlocklist(blockedDomains, domainToBlocklistMap);
});

function getDomain(url) {
    var regex = domainRegex.exec(url);
    return regex ? regex[1].toLowerCase() : null;
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
                        const settings = {
                            isPaused: freshSettings.isPaused,
                            pausedTime: freshSettings.pausedTime,
                            autoUnpause: freshSettings.autoUnpause,
                            autoUnpauseTimeout: freshSettings.autoUnpauseTimeout,
                            isNoEye: freshSettings.isNoEye,
                            isNoFaceFeatures: freshSettings.isNoFaceFeatures,
                            maxSafe: freshSettings.maxSafe,
                            filterColor: freshSettings.filterColor,
                            isBlackList: !!freshSettings.isBlackList
                        };

                        const tab = request.tab || sender.tab;
                        if (tab) {
                            if (pauseForTabList.indexOf(tab.id) !== -1) {
                                settings.isPausedForTab = true;
                            }
                            if (tab.url) {
                                const domain = getDomain(tab.url);
                                if (domain) {
                                    for (let i = 0; i < excludeForTabList.length; i++) {
                                        if (excludeForTabList[i].tabId === tab.id && excludeForTabList[i].domain === domain) {
                                            settings.isExcludedForTab = true;
                                            break;
                                        }
                                    }
                                }
                                const lowerUrl = tab.url.toLowerCase();
                                const list = Array.isArray(freshSettings.urlList) ? freshSettings.urlList : [];
                                for (let i = 0; i < list.length; i++) {
                                    if (lowerUrl.indexOf(list[i]) !== -1) {
                                        settings.isExcluded = true;
                                        break;
                                    }
                                }
                                if (settings.isBlackList) {
                                    settings.isExcluded = !settings.isExcluded;
                                }
                            }
                        }

                        if (typeof settings.pausedTime === 'number' && settings.autoUnpause &&
                            (settings.pausedTime + (settings.autoUnpauseTimeout * 60) < (Date.now() / 1000))) {
                            // Timeout reached, turn off pause
                            chrome.storage.local.set({ "isPaused": 0, "pausedTime": null });
                            settings.isPaused = false;
                            storedSettings.isPaused = false;
                            storedSettings.pausedTime = null;
                        }

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
            case 'urlListAdd':
                var url = request.domainOnly ? getDomain(request.url) : request.url.toLowerCase();
                if (url) {
                    if (!Array.isArray(storedSettings.urlList)) {
                        storedSettings.urlList = [];
                    }
                    storedSettings.urlList.push(url);
                    saveUrlList(storedSettings.urlList);
                    chrome.runtime.sendMessage({ r: 'urlListModified' });
                }
                sendResponse(true);
                break;
            case 'urlListRemove':
                if (!Array.isArray(storedSettings.urlList)) {
                    storedSettings.urlList = [];
                }
                if (request.url) {
                    var lowerUrl = request.url.toLowerCase();
                    for (var i = 0; i < storedSettings.urlList.length; i++) {
                        if (lowerUrl.indexOf(storedSettings.urlList[i]) != -1) {
                            storedSettings.urlList.splice(i, 1);
                            i--;
                        }
                    }
                } else
                    storedSettings.urlList.splice(request.index, 1);
                saveUrlList(storedSettings.urlList);
                //chrome.runtime.sendMessage({ r: 'urlListModified' });
                sendResponse(true);
                break;
            case 'getUrlList':
                sendResponse(Array.isArray(storedSettings.urlList) ? storedSettings.urlList : []);
                break;
            case 'setUrlList':
                if (Array.isArray(request.urlList)) {
                    storedSettings.urlList = request.urlList.slice();
                    saveUrlList(storedSettings.urlList);
                }
                sendResponse(true);
                break;
            case 'excludeForTab':
                var domain = getDomain(request.tab.url);
                if (!domain) {
                    sendResponse(false);
                    break;
                }
                if (request.toggle) {
                    excludeForTabList.push({ tabId: request.tab.id, domain: domain });
                } else {
                    for (var i = 0; i < excludeForTabList.length; i++)
                        if (excludeForTabList[i].tabId == request.tab.id && excludeForTabList[i].domain == domain) { excludeForTabList.splice(i, 1); break; }
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
                if (request.toggle)
                    pauseForTabList.push(request.tabId);
                else
                    for (var i = 0; i < pauseForTabList.length; i++)
                        if (pauseForTabList[i] == request.tabId) { pauseForTabList.splice(i, 1); break; }
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
                    // Refresh the blocklist when settings change
                    fetchAndProcessBlocklist(blockedDomains, domainToBlocklistMap);
                    sendResponse(true);
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
            
            // Check if hostname is in our blocklist
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

