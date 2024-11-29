// Cache DOM elements
const elements = {
    showImages: document.getElementById('showImages'),
    excludeDomain: document.getElementById('excludeDomain'),
    excludeForTab: document.getElementById('excludeForTab'),
    pauseChk: document.getElementById('pauseChk'),
    pauseForTab: document.getElementById('pauseForTab'),
    excludeDomainLabel: document.getElementById('exclude-domain-label'),
    excludeTabWrap: document.getElementById('exclude-tab-wrap'),
    close: document.getElementById('close')
};

/**
 * Shows images on the specified tab
 * @param {number} tabId - The ID of the tab to show images on
 */
function showImages(tabId) {
    chrome.tabs.sendMessage(tabId, { r: 'showImages' })
        .catch(err => console.error('Failed to show images:', err));
}

/**
 * Initialize popup with current settings
 * @param {chrome.tabs.Tab} activeTab - The currently active tab
 */
function initializePopup(activeTab) {
    chrome.runtime.sendMessage({ r: 'getSettings', tab: activeTab }, function (settings) {
        if (chrome.runtime.lastError) {
            console.error('Error getting settings:', chrome.runtime.lastError);
            return;
        }

        elements.pauseChk.checked = settings.isPaused;
        elements.pauseForTab.checked = settings.isPausedForTab;
        elements.excludeDomain.checked = settings.isBlackList ? !settings.isExcluded : settings.isExcluded;
        elements.excludeForTab.checked = settings.isExcludedForTab;
        elements.excludeDomainLabel.innerText = (settings.isBlackList ? 'Add' : 'Exclude') + ' Website';
        elements.excludeTabWrap.style.display = settings.isBlackList ? 'none' : 'block';
    });
}

// Query for active tab and initialize popup
chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    if (chrome.runtime.lastError) {
        console.error('Error querying tabs:', chrome.runtime.lastError);
        return;
    }

    const activeTab = tabs[0];

    // Initialize popup with current settings
    initializePopup(activeTab);

    // Setup event listeners
    elements.showImages.addEventListener('click', () => showImages(activeTab.id));

    elements.excludeDomain.addEventListener('click', function() {
        if (this.checked) {
            chrome.runtime.sendMessage({ r: 'urlListAdd', url: activeTab.url, domainOnly: true })
                .then(() => showImages(activeTab.id))
                .catch(err => console.error('Error adding URL to list:', err));
        } else {
            chrome.runtime.sendMessage({ r: 'urlListRemove', url: activeTab.url })
                .catch(err => console.error('Error removing URL from list:', err));
        }
    });

    elements.excludeForTab.addEventListener('click', function() {
        const isChecked = this.checked;
        chrome.runtime.sendMessage({ r: 'excludeForTab', toggle: isChecked, tab: activeTab })
            .then(() => {
                if (isChecked) showImages(activeTab.id);
            })
            .catch(err => console.error('Error setting tab exclusion:', err));
    });

    elements.pauseChk.addEventListener('click', function() {
        chrome.runtime.sendMessage({ r: 'pause', toggle: this.checked })
            .then(() => showImages(activeTab.id))
            .catch(err => console.error('Error toggling pause:', err));
    });

    elements.pauseForTab.addEventListener('click', function() {
        chrome.runtime.sendMessage({ r: 'pauseForTab', tabId: activeTab.id, toggle: this.checked })
            .then(() => showImages(activeTab.id))
            .catch(err => console.error('Error toggling tab pause:', err));
    });
});

// Close button handler
elements.close.addEventListener('click', () => window.close());
