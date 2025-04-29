excludeForTabList = [];
pauseForTabList = [];
domainRegex = /^\w+:\/\/([\w\.:-]+)/;

// Blocklist feature variables
let blockedDomains = new Set();
const REDIRECT_URL = 'https://quran.com/';

// Available blocklists
const BLOCKLISTS = {
  abuse: {
    url: chrome.runtime.getURL('blocklists/abuse.txt'),
    enabled: true,
    description: 'Sites promoting abusive behavior',
    category: 'vice'
  },
//   ads: {
//     url: 'https://raw.githubusercontent.com/blocklistproject/Lists/master/ads.txt',
//     enabled: false,
//     description: 'Ad servers and trackers'
//   },
//   crypto: {
//     url: 'https://raw.githubusercontent.com/blocklistproject/Lists/master/crypto.txt',
//     enabled: false,
//     description: 'Cryptocurrency mining domains'
//   },
  drugs: {
    url: chrome.runtime.getURL('blocklists/drugs.txt'),
    enabled: true,
    description: 'Drug-related sites',
    category: 'vice'
  },
//   facebook: {
//     url: 'https://raw.githubusercontent.com/blocklistproject/Lists/master/facebook.txt',
//     enabled: false,
//     description: 'Facebook-related domains'
//   },
  fraud: {
    url: 'https://raw.githubusercontent.com/blocklistproject/Lists/master/fraud.txt',
    enabled: false,
    description: 'Known fraud sites',
    category: 'hazard'
  },
  gambling: {
    url: chrome.runtime.getURL('blocklists/gambling.txt'),
    enabled: true,
    description: 'Gambling sites',
    category: 'vice'
  },
  malware: {
    url: 'https://raw.githubusercontent.com/blocklistproject/Lists/master/malware.txt',
    enabled: false,
    description: 'Known malware domains',
    category: 'hazard'
  },
  phishing: {
    url: 'https://raw.githubusercontent.com/blocklistproject/Lists/master/phishing.txt',
    enabled: false,
    description: 'Phishing sites',
    category: 'hazard'
  },
  piracy: {
    url: 'https://raw.githubusercontent.com/blocklistproject/Lists/master/piracy.txt',
    enabled: false,
    description: 'Piracy sites',
    category: 'hazard'
  },
  porn: {
    url: chrome.runtime.getURL('blocklists/porn.txt'),
    enabled: true,
    description: 'Pornography sites',
    category: 'vice'
  },
  ransomware: {
    url: 'https://raw.githubusercontent.com/blocklistproject/Lists/master/ransomware.txt',
    enabled: false,
    description: 'Ransomware domains',
    category: 'hazard'
  },
//   redirect: {
//     url: 'https://raw.githubusercontent.com/blocklistproject/Lists/master/redirect.txt',
//     enabled: false,
//     description: 'URL shorteners and redirectors'
//   },
  scam: {
    url: 'https://raw.githubusercontent.com/blocklistproject/Lists/master/scam.txt',
    enabled: false,
    description: 'Scam sites',
    category: 'hazard'
  }//,
//   tiktok: {
//     url: 'https://raw.githubusercontent.com/blocklistproject/Lists/master/tiktok.txt',
//     enabled: false,
//     description: 'TikTok domains'
//   }
};

async function getSettings() {
    var result = await chrome.storage.sync.get({
        'urlList': null, 
        'isNoEye': null, 
        'isNoFaceFeatures': null, 
        'maxSafe': null,
        'autoUnpause': null, 
        'autoUnpauseTimeout': null,
        'blocklistSettings': null
    });
        storedSettings.urlList = result.urlList ? JSON.parse(result.urlList) : [];
        storedSettings.isNoEye = result.isNoEye == 1;
        storedSettings.maxSafe = +result.maxSafe || 32;
        storedSettings.autoUnpause = result.autoUnpause == 1;
        storedSettings.autoUnpauseTimeout = +result.autoUnpauseTimeout || 15;
        storedSettings.isNoFaceFeatures = result.isNoFaceFeatures == 1;
        
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
                    maxSafe: storedSettings.maxSafe
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
                if (!domain) return;
                if (request.toggle) {
                    excludeForTabList.push({ tabId: request.tab.id, domain: domain });
                } else {
                    for (var i = 0; i < excludeForTabList.length; i++)
                        if (excludeForTabList[i].tabId == request.tab.id && excludeForTabList[i].domain == domain) { excludeForTabList.splice(i, 1); break; }
                }
                break;
            case 'pause':
                pause = request.toggle;
                if (pause == 1) {
                    chrome.storage.local.set({"pausedTime": (Date.now() / 1000)});
                } else {
                    chrome.storage.local.set({"pausedTime": null});
                }
                chrome.storage.local.set({"isPaused": pause ? 1 : 0});
                break;
            case 'pauseForTab':
                if (request.toggle)
                    pauseForTabList.push(request.tabId);
                else
                    for (var i = 0; i < pauseForTabList.length; i++)
                        if (pauseForTabList[i] == request.tabId) { pauseForTabList.splice(i, 1); break; }
                break;
            case 'setNoEye':
                isNoEye = request.toggle;
                chrome.storage.sync.set({"isNoEye": isNoEye});
                break;
            case 'setNoFaceFeatures':
                isNoFaceFeatures = request.toggle;
                chrome.storage.sync.set({"isNoFaceFeatures": isNoFaceFeatures});
                break;
            case 'setAutoUnpause':
                autoUnpause = request.toggle;
                chrome.storage.sync.set({"autoUnpause": autoUnpause});
                break;
            case 'setAutoUnpauseTimeout':
                var autoUnpauseTimeout = +request.autoUnpauseTimeout;
                if (!autoUnpauseTimeout || autoUnpauseTimeout < 1 || autoUnpauseTimeout > 1000)
                    autoUnpauseTimeout = 15;
                    chrome.storage.sync.set({"autoUnpauseTimeout": autoUnpauseTimeout});
                break;
            case 'setMaxSafe':
                var ms = +request.maxSafe;
                if (!ms || ms < 1 || ms > 1000)
                    ms = 32;
                    chrome.storage.sync.set({"maxSafe": maxSafe = ms});
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
                    fetchAndProcessBlocklist();
                    sendResponse(true);
                } else {
                    sendResponse(false);
                }
                break;
            case 'fetchAndReadImage':
                fetch(request.url)
                .then((response) => {
                    return response.blob()})
                .then(rblob => {
                    const reader = new FileReader();
                    reader.readAsDataURL(rblob);
            
                    return new Promise((resolve, reject) => {
                        reader.onloadend = () => resolve(reader);
                    });
                }).then(reader => {
                    sendResponse(reader.result);
                });
                break;
        }
        return true;
    }
);

/////////////////////////////////////////////////////
// Allow-Control-Allow-Origin: *
/////////////////////////////////////////////////////
var accessControlRequestHeaders;
var exposedHeaders;

var requestListener = function(details) {
    var flag = false,
        rule = {
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
    var flag = false,
        rule = {
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

/**
 * Process a single blocklist file and add domains to the blockedDomains set
 * @param {string} url - URL of the blocklist (local file URL or remote URL)
 * @returns {Promise<number>} - Number of domains added
 */
async function processBlocklist(url) {
  try {
    console.log("Loading blocklist from: " + url);
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch blocklist: ${response.status}`);
    }
    
    const text = await response.text();
    const lines = text.split('\n');
    let addedCount = 0;
    
    // Process each line
    for (const line of lines) {
      const trimmedLine = line.trim();
      // Skip comments and empty lines
      if (!trimmedLine || trimmedLine.startsWith('#')) {
        continue;
      }
      
      // Handle different formats (0.0.0.0 domain.com or just domain.com)
      let domain;
      if (trimmedLine.startsWith('0.0.0.0')) {
        domain = trimmedLine.split(/\s+/)[1]; // Extract domain after IP
      } else {
        domain = trimmedLine;
      }
      
      // Add to our Set if it's a valid domain
      if (domain && domain.includes('.')) {
        blockedDomains.add(domain);
        addedCount++;
      }
    }
    
    console.log(`Added ${addedCount} domains from blocklist: ${url}`);
    return addedCount;
  } catch (error) {
    console.error(`Error processing blocklist ${url}:`, error);
    return 0;
  }
}

/**
 * Fetches all enabled blocklists from GitHub and processes them
 */
async function fetchAndProcessBlocklist() {
  try {
    // Clear existing blocklist
    blockedDomains.clear();
    
    let totalDomains = 0;
    const enabledLists = [];
    
    // Process each enabled blocklist
    for (const [key, blocklist] of Object.entries(BLOCKLISTS)) {
      if (blocklist.enabled) {
        enabledLists.push(key);
        const addedCount = await processBlocklist(blocklist.url);
        totalDomains += addedCount;
      }
    }
    
    console.log(`Loaded ${totalDomains} domains from blocklists: ${enabledLists.join(', ') || 'none'}`);
  } catch (error) {
    console.error("Error fetching or processing blocklists:", error);
  }
}

// Fetch blocklist when service worker starts
fetchAndProcessBlocklist();

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
      if (blockedDomains.has(hostname)) {
        console.log(`Blocked navigation to: ${hostname}`);
        
        // Redirect the tab
        chrome.tabs.update(details.tabId, { 
          url: REDIRECT_URL 
        });
      }
    } catch (error) {
      console.error("Error processing navigation:", error);
    }
  },
  { url: [{ schemes: ['http', 'https'] }] }
);