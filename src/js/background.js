excludeForTabList = [];
pauseForTabList = [];
domainRegex = /^\w+:\/\/([\w\.:-]+)/;


async function getSettings() {
    var result = await chrome.storage.sync.get({'urlList': null, 'isNoEye': null, 'isNoFaceFeatures': null, 'maxSafe': null,
    'autoUnpause': null, 'autoUnpauseTimeout': null});
        ssettings.urlList = result.urlList ? JSON.parse(result.urlList) : [];
        ssettings.isNoEye = result.isNoEye == 1;
        ssettings.maxSafe = +result.maxSafe || 32;
        ssettings.autoUnpause = result.autoUnpause == 1;
        ssettings.autoUnpauseTimeout = +result.autoUnpauseTimeout || 15;
        ssettings.isNoFaceFeatures = result.isNoFaceFeatures == 1;

    result = await chrome.storage.local.get({'isPaused' : null, "pausedTime" : null});
        ssettings.isPaused = result.isPaused;
        ssettings.pausedTime = result.pausedTime;
    return ssettings;
}

var ssettings = {};
getSettings()
.then(onSuccess => {
    ssettings = onSuccess;
    console.log("Startup ssettings: " + JSON.stringify(ssettings));
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
                    isPaused: ssettings.isPaused,
                    pausedTime: ssettings.pausedTime,
                    autoUnpause: ssettings.autoUnpause,
                    autoUnpauseTimeout: ssettings.autoUnpauseTimeout,
                    isNoEye: ssettings.isNoEye,
                    isNoFaceFeatures: ssettings.isNoFaceFeatures,
                    maxSafe: ssettings.maxSafe
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
                        for (var i = 0; i < ssettings.urlList.length; i++) {
                            if (lowerUrl.indexOf(ssettings.urlList[i]) != -1) { settings.isExcluded = true; break; }
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
                    ssettings.urlList.push(url);
                    saveUrlList(ssettings.urlList);
                    chrome.runtime.sendMessage({ r: 'urlListModified' });
                }
                sendResponse(true);
                break;
            case 'urlListRemove':
                if (request.url) {
                    var lowerUrl = request.url.toLowerCase();
                    for (var i = 0; i < ssettings.urlList.length; i++) {
                        if (lowerUrl.indexOf(ssettings.urlList[i]) != -1) {
                            ssettings.urlList.splice(i, 1);
                            i--;
                        }
                    }
                } else
                    ssettings.urlList.splice(request.index, 1);
                saveUrlList(ssettings.urlList);
                //chrome.runtime.sendMessage({ r: 'urlListModified' });
                break;
            case 'getUrlList':
                sendResponse(ssettings.urlList);
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