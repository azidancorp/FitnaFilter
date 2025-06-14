excludeForTabList = [];
pauseForTabList = [];
domainRegex = /^\w+:\/\/([\w\.:-]+)/;

// Blocklist feature variables
let blockedDomains = new Set();
let domainToBlocklistMap = new Map(); // Maps domain to blocklist name for contextual redirects

// Contextual Quran verse mappings for different blocklist categories
const VERSE_MAPPINGS = {
    // Vice category verses
    gambling: [
        '2:219',  // "They ask you about wine and gambling..."
        '5:90' // "O you who believe! Intoxicants and gambling..."
    ],
    porn: [
        '24:30',  // "Tell the believing men to lower their gaze..."
        '24:31',  // "And tell the believing women to lower their gaze..."
        '17:32'   // "And do not approach unlawful sexual intercourse..."
    ],
    drugs: [
        '5:90',   // "O you who believe! Intoxicants and gambling..."
        '2:219'   // "They ask you about wine and gambling..."
    ],
    vaping: [
        '5:90',   // "O you who believe! Intoxicants and gambling..."
        '2:195'   // "And do not throw yourselves into destruction..."
    ],
    abuse: [
        '4:36',   // "Worship Allah and associate nothing with Him, and be kind to parents..."
        '17:23'   // "Your Lord has decreed that you worship none but Him..."
    ],
    
    // Hazard category verses
    fraud: [
        '2:188',  // "And do not consume one another's wealth unjustly..."
        '4:29'    // "O you who believe! Do not consume one another's wealth unjustly..."
    ],
    scam: [
        '2:188',  // "And do not consume one another's wealth unjustly..."
        '83:1'  // "Woe to those who give less [than due]..."
    ],
    malware: [
        '2:195',  // "And do not throw yourselves into destruction..."
        '4:29'    // "O you who believe! Do not consume one another's wealth unjustly..."
    ],
    phishing: [
        '2:42',   // "And do not mix truth with falsehood..."
        '2:188'   // "And do not consume one another's wealth unjustly..."
    ],
    ransomware: [
        '2:188',  // "And do not consume one another's wealth unjustly..."
        '4:29'    // "O you who believe! Do not consume one another's wealth unjustly..."
    ],
    
    // Distraction category verses
    youtube: [
        '103:1', // "By time, Indeed mankind is in loss..."
        '62:9'     // "O you who believe! When the call is proclaimed for Salah..."
    ],
    tiktok: [
        '103:1', // "By time, Indeed mankind is in loss..."
        '25:67'    // "And those who, when they spend, do so neither extravagantly nor sparingly..."
    ],
    facebook: [
        '49:12',   // "O you who believe! Avoid much suspicion..."
        '103:1'  // "By time, Indeed mankind is in loss..."
    ],
    twitter: [
        '49:12',   // "O you who believe! Avoid much suspicion..."
        '103:1'  // "By time, Indeed mankind is in loss..."
    ],
    fortnite: [
        '103:1', // "By time, Indeed mankind is in loss..."
        '2:195'    // "And do not throw yourselves into destruction..."
    ],
    
    // Default verses for uncategorized or general blocking
    default: [
        '2:286',   // "Allah does not burden a soul beyond that it can bear..."
        '94:5'   // "So verily, with hardship, there is relief..."
    ]
};

function getContextualRedirectUrl(blocklistName) {
    const verses = VERSE_MAPPINGS[blocklistName] || VERSE_MAPPINGS.default;
    const randomVerse = verses[Math.floor(Math.random() * verses.length)];
    return `https://quran.com/${randomVerse}`;
}

// Available blocklists
const BLOCKLISTS = {
  // Vice category (red) - always enabled
  abuse: {
    url: chrome.runtime.getURL('blocklists/abuse.txt'),
    enabled: true,
    description: 'Sites promoting abusive behavior',
    category: 'vice'
  },
  drugs: {
    url: chrome.runtime.getURL('blocklists/drugs.txt'),
    enabled: true,
    description: 'Drug-related sites',
    category: 'vice'
  },
  gambling: {
    url: chrome.runtime.getURL('blocklists/gambling.txt'),
    enabled: true,
    description: 'Gambling sites',
    category: 'vice'
  },
  porn: {
    url: chrome.runtime.getURL('blocklists/porn.txt'),
    enabled: true,
    description: 'Pornography sites',
    category: 'vice'
  },
  vaping: {
    url: chrome.runtime.getURL('blocklists/vaping.txt'),
    enabled: true,
    description: 'Vaping and e-cigarette sites',
    category: 'vice'
  },
  
  // Hazards category (orange) - toggleable
  crypto: {
    url: chrome.runtime.getURL('blocklists/crypto.txt'),
    enabled: false,
    description: 'Cryptocurrency mining domains',
    category: 'hazard'
  },
  fraud: {
    url: chrome.runtime.getURL('blocklists/fraud.txt'),
    enabled: false,
    description: 'Known fraud sites',
    category: 'hazard'
  },
  malware: {
    url: chrome.runtime.getURL('blocklists/malware.txt'),
    enabled: false,
    description: 'Known malware domains',
    category: 'hazard'
  },
  phishing: {
    url: chrome.runtime.getURL('blocklists/phishing.txt'),
    enabled: false,
    description: 'Phishing sites',
    category: 'hazard'
  },
  ransomware: {
    url: chrome.runtime.getURL('blocklists/ransomware.txt'),
    enabled: false,
    description: 'Ransomware domains',
    category: 'hazard'
  },
  redirect: {
    url: chrome.runtime.getURL('blocklists/redirect.txt'),
    enabled: false,
    description: 'URL shorteners and redirectors',
    category: 'hazard'
  },
  scam: {
    url: chrome.runtime.getURL('blocklists/scam.txt'),
    enabled: false,
    description: 'Scam sites',
    category: 'hazard'
  },
  tracking: {
    url: chrome.runtime.getURL('blocklists/tracking.txt'),
    enabled: false,
    description: 'Tracking domains',
    category: 'hazard'
  },
  
  // Distractions category (yellow) - toggleable
  ads: {
    url: chrome.runtime.getURL('blocklists/ads.txt'),
    enabled: false,
    description: 'Ad servers and trackers',
    category: 'distraction'
  },
  facebook: {
    url: chrome.runtime.getURL('blocklists/facebook.txt'),
    enabled: false,
    description: 'Facebook-related domains',
    category: 'distraction'
  },
  fortnite: {
    url: chrome.runtime.getURL('blocklists/fortnite.txt'),
    enabled: false,
    description: 'Fortnite gaming domains',
    category: 'distraction'
  },
  piracy: {
    url: chrome.runtime.getURL('blocklists/piracy.txt'),
    enabled: false,
    description: 'Piracy sites',
    category: 'distraction'
  },
  smarttv: {
    url: chrome.runtime.getURL('blocklists/smart-tv.txt'),
    enabled: false,
    description: 'Smart TV related domains',
    category: 'distraction'
  },
  tiktok: {
    url: chrome.runtime.getURL('blocklists/tiktok.txt'),
    enabled: false,
    description: 'TikTok domains',
    category: 'distraction'
  },
  torrent: {
    url: chrome.runtime.getURL('blocklists/torrent.txt'),
    enabled: false,
    description: 'Torrent sites',
    category: 'distraction'
  },
  twitter: {
    url: chrome.runtime.getURL('blocklists/twitter.txt'),
    enabled: false,
    description: 'Twitter domains',
    category: 'distraction'
  },
  whatsapp: {
    url: chrome.runtime.getURL('blocklists/whatsapp.txt'),
    enabled: false,
    description: 'WhatsApp domains',
    category: 'distraction'
  },
  youtube: {
    url: chrome.runtime.getURL('blocklists/youtube.txt'),
    enabled: false,
    description: 'YouTube domains',
    category: 'distraction'
  }
};

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
    fetchAndProcessBlocklist();
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
 * @param {string} blocklistName - Name of the blocklist for contextual mapping
 * @returns {Promise<number>} - Number of domains added
 */
async function processBlocklist(url, blocklistName) {
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
    const CHUNK_SIZE = 1000;
    let processed = 0;

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
        domainToBlocklistMap.set(domain, blocklistName); // Track which blocklist this domain belongs to
        addedCount++;
      }

      processed++;
      if (processed % CHUNK_SIZE === 0) {
        await new Promise((r) => setTimeout(r));
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
    domainToBlocklistMap.clear();
    
    let totalDomains = 0;
    const enabledLists = [];
    
    // Process each enabled blocklist
    for (const [key, blocklist] of Object.entries(BLOCKLISTS)) {
      if (blocklist.enabled) {
        enabledLists.push(key);
        const addedCount = await processBlocklist(blocklist.url, key);
        totalDomains += addedCount;
      }
    }
    
    console.log(`Loaded ${totalDomains} domains from blocklists: ${enabledLists.join(', ') || 'none'}`);
  } catch (error) {
    console.error("Error fetching or processing blocklists:", error);
  }
}

// Fetch blocklists after settings load to avoid blocking startup

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
        const blocklistName = domainToBlocklistMap.get(hostname);
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