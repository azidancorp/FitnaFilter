let excludeForTabList = [];
let pauseForTabList = [];
const domainRegex = /^\w+:\/\/([\w.:+-]+)/;
let pause = 0;
let isNoEye = 0;
let isNoFaceFeatures = 0;
let autoUnpause = 1;
let maxSafe = 32;

// Import domain filtering functionality
importScripts('content/DomainFilter.js');

// Blocklist feature variables
let blockedDomains = new Set();
let domainToBlocklistMap = new Map(); // Maps domain to blocklist name for contextual redirects


async function getSettings() {
    var result = await chrome.storage.sync.get({
        'urlList': null, 
        'isNoEye': null, 
        'isNoFaceFeatures': null, 
        'maxSafe': null,
        'autoUnpause': null, 
        'autoUnpauseTimeout': null,
        'blocklistSettings': null,
        'filterColor': null
    });
        storedSettings.urlList = result.urlList ? JSON.parse(result.urlList) : [];
        storedSettings.isNoEye = result.isNoEye == 1;
        storedSettings.maxSafe = +result.maxSafe || 32;
        storedSettings.autoUnpause = result.autoUnpause !== null ? result.autoUnpause == 1 : true; // Default to true if not set
        storedSettings.autoUnpauseTimeout = +result.autoUnpauseTimeout || 15;
        storedSettings.isNoFaceFeatures = result.isNoFaceFeatures == 1;
        storedSettings.filterColor = result.filterColor || 'grey';
        
        // Load blocklist settings
        if (result.blocklistSettings) {
            const savedBlocklists = JSON.parse(result.blocklistSettings);
            // Update enabled status for each blocklist
            for (const [key, value] of Object.entries(savedBlocklists)) {
                if (BLOCKLISTS[key]) {
                    BLOCKLISTS[key].enabled = value;
                }
            }
        }

    result = await chrome.storage.local.get({'isPaused' : null, "pausedTime" : null});
        storedSettings.isPaused = result.isPaused;
        storedSettings.pausedTime = result.pausedTime;
    return storedSettings;
}

var storedSettings = {};
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
            case 'getSettings':  
                getSettings();
                var settings = {
                    isPaused: storedSettings.isPaused,
                    pausedTime: storedSettings.pausedTime,
                    autoUnpause: storedSettings.autoUnpause,
                    autoUnpauseTimeout: storedSettings.autoUnpauseTimeout,
                    isNoEye: storedSettings.isNoEye,
                    isNoFaceFeatures: storedSettings.isNoFaceFeatures,
                    maxSafe: storedSettings.maxSafe,
                    filterColor: storedSettings.filterColor
                };
                var tab = request.tab || sender.tab;
                if (tab) {
                    if (pauseForTabList.indexOf(tab.id) != -1)
                        settings.isPausedForTab = true;
                    if (tab.url) {
                        var domain = getDomain(tab.url);
                        if (domain) {
                            for (var i = 0; i < excludeForTabList.length; i++) {
                                if (excludeForTabList[i].tabId == tab.id && excludeForTabList[i].domain == domain) { settings.isExcludedForTab = true; break; }
                            }
                        }
                        var lowerUrl = tab.url.toLowerCase();
                        for (var i = 0; i < storedSettings.urlList.length; i++) {
                            if (lowerUrl.indexOf(storedSettings.urlList[i]) != -1) { settings.isExcluded = true; break; }
                        }
                        if (settings.isBlackList)
                            settings.isExcluded = !settings.isExcluded;
                    }
                }
                if (typeof settings.pausedTime == "number" && settings.autoUnpause &&
                (settings.pausedTime + (settings.autoUnpauseTimeout * 60) < (Date.now() / 1000))){
                    //Timeout reached, turn off pause
                    chrome.storage.local.set({"isPaused": 0});
                    chrome.storage.local.set({"pausedTime": null});
                    settings.isPaused = false;
                }
                sendResponse(settings); 
                break;
            case 'setColorIcon':
                chrome.action.setIcon({ path: request.toggle ? '../images/icon.png' : '../images/icon-d.png', tabId: sender.tab.id });
                break;
            case 'urlListAdd':
                var url = request.domainOnly ? getDomain(request.url) : request.url.toLowerCase();
                if (url) {
                    storedSettings.urlList.push(url);
                    saveUrlList(storedSettings.urlList);
                    chrome.runtime.sendMessage({ r: 'urlListModified' });
                }
                sendResponse(true);
                break;
            case 'urlListRemove':
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
                sendResponse(storedSettings.urlList);
                break;
            case 'setUrlList':
                saveUrlList(request.urlList);
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
            case 'pause':
                pause = request.toggle;
                if (pause == 1) {
                    chrome.storage.local.set({"pausedTime": (Date.now() / 1000)});
                } else {
                    chrome.storage.local.set({"pausedTime": null});
                }
                chrome.storage.local.set({"isPaused": pause ? 1 : 0});
                sendResponse(true);
                break;
            case 'pauseForTab':
                if (request.toggle)
                    pauseForTabList.push(request.tabId);
                else
                    for (var i = 0; i < pauseForTabList.length; i++)
                        if (pauseForTabList[i] == request.tabId) { pauseForTabList.splice(i, 1); break; }
                sendResponse(true);
                break;
            case 'setNoEye':
                isNoEye = request.toggle;
                chrome.storage.sync.set({"isNoEye": isNoEye});
                sendResponse(true);
                break;
            case 'setNoFaceFeatures':
                isNoFaceFeatures = request.toggle;
                chrome.storage.sync.set({"isNoFaceFeatures": isNoFaceFeatures});
                sendResponse(true);
                break;
            case 'setAutoUnpause':
                autoUnpause = request.toggle;
                chrome.storage.sync.set({"autoUnpause": autoUnpause});
                sendResponse(true);
                break;
            case 'setAutoUnpauseTimeout':
                var autoUnpauseTimeout = +request.autoUnpauseTimeout;
                if (!autoUnpauseTimeout || autoUnpauseTimeout < 1 || autoUnpauseTimeout > 1000) {
                    autoUnpauseTimeout = 15;
                }
                chrome.storage.sync.set({"autoUnpauseTimeout": autoUnpauseTimeout});
                sendResponse(true);
                break;
            case 'setMaxSafe':
                var ms = +request.maxSafe;
                if (!ms || ms < 1 || ms > 1000) {
                    ms = 32;
                }
                chrome.storage.sync.set({"maxSafe": maxSafe = ms});
                sendResponse(true);
                break;
            case 'setFilterColor':
                const validColors = ['white', 'black', 'grey'];
                const color = request.color && validColors.includes(request.color) ? request.color : 'grey';
                storedSettings.filterColor = color;
                chrome.storage.sync.set({"filterColor": color});
                sendResponse(true);
                break;
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

/////////////////////////////////////////////////////
// Allow-Control-Allow-Origin: *
/////////////////////////////////////////////////////
let accessControlRequestHeaders;
let exposedHeaders;

var requestListener = function(details) {
    var flag = false;
    var rule = {
        name: "Origin",
        value: "http://evil.com/"
    };
    var i;

    for (i = 0; i < details.requestHeaders.length; ++i) {
        if (details.requestHeaders[i].name.toLowerCase() === rule.name.toLowerCase()) {
            flag = true;
            details.requestHeaders[i].value = rule.value;
            break;
        }
    }
    if (!flag) details.requestHeaders.push(rule);

    for (i = 0; i < details.requestHeaders.length; ++i) {
        if (details.requestHeaders[i].name.toLowerCase() === "access-control-request-headers") {
            accessControlRequestHeaders = details.requestHeaders[i].value
        }
    }

    return { requestHeaders: details.requestHeaders };
};

var responseListener = function(details) {
    var flag = false;
    var rule = {
        "name": "Access-Control-Allow-Origin",
        "value": "*"
    };

    for (var i = 0; i < details.responseHeaders.length; ++i) {
        if (details.responseHeaders[i].name.toLowerCase() === rule.name.toLowerCase()) {
            flag = true;
            details.responseHeaders[i].value = rule.value;
            break;
        }
    }
    if (!flag) details.responseHeaders.push(rule);

    console.log("Before if loop")
    if (accessControlRequestHeaders) {

        details.responseHeaders.push({ "name": "Access-Control-Allow-Headers", "value": accessControlRequestHeaders });

    }

    if (exposedHeaders) {
        details.responseHeaders.push({ "name": "Access-Control-Expose-Headers", "value": exposedHeaders });
    }

    details.responseHeaders.push({ "name": "Access-Control-Allow-Methods", "value": "GET, PUT, POST, DELETE, HEAD, OPTIONS" });

    return { responseHeaders: details.responseHeaders };

};

/*On install*/
chrome.runtime.onInstalled.addListener(function() {
    chrome.storage.local.set({ 'active': true });
    chrome.storage.local.set({ 'urls': ["<all_urls>"] });
    chrome.storage.local.set({ 'exposedHeaders': '' });
    reload();
});

/*Reload settings*/
function reload() {
    chrome.storage.local.get({ 'active': false, 'urls': ["<all_urls>"], 'exposedHeaders': '' }, function(result) {

        exposedHeaders = result.exposedHeaders;

        /*Remove Listeners*/
//        chrome.declarativeNetRequest.onHeadersReceived.removeListener(responseListener);
//        chrome.declarativeNetRequest.onBeforeSendHeaders.removeListener(requestListener);

//        if(result.active) {
        //chrome.browserAction.setIcon({path: "on.png"});

//        if (result.urls.length) {

            /*Add Listeners*/
//            chrome.declarativeNetRequest.onHeadersReceived.addListener(responseListener, {
//                urls: result.urls
//            }, //["blocking", "responseHeaders"]
//            );

//            chrome.declarativeNetRequest.onBeforeSendHeaders.addListener(requestListener, {
//               urls: result.urls
//            }, //["blocking", "requestHeaders"]
//            );
//        }
//        } else {
        //chrome.browserAction.setIcon({path: "off.png"});
//        }
    }); 
}

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

