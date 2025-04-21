// Cache DOM elements
const elements = {
    showImages: document.getElementById('showImages'),
    excludeDomain: document.getElementById('excludeDomain'),
    excludeForTab: document.getElementById('excludeForTab'),
    pauseChk: document.getElementById('pauseChk'),
    pauseForTab: document.getElementById('pauseForTab'),
    excludeDomainLabel: document.getElementById('exclude-domain-label'),
    reloadTab: document.getElementById('reloadTab'),
    whiteFilter: document.getElementById('whiteFilter'),
    blackFilter: document.getElementById('blackFilter'),
    greyFilter: document.getElementById('greyFilter'),
    customUrlInput: document.getElementById('customUrlInput'),
    addUrlBtn: document.getElementById('addUrlBtn'),
    grabUrlBtn: document.getElementById('grabUrlBtn')
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
 * Sets the filter color and updates UI
 * @param {string} color - The color to set ('white', 'black', or 'grey')
 * @param {number} tabId - The ID of the active tab
 */
function setFilterColor(color, tabId) {
    // Remove active class from all buttons
    elements.whiteFilter.classList.remove('active');
    elements.blackFilter.classList.remove('active');
    elements.greyFilter.classList.remove('active');

    // Add active class to selected button
    switch (color) {
        case 'white':
            elements.whiteFilter.classList.add('active');
            break;
        case 'black':
            elements.blackFilter.classList.add('active');
            break;
        case 'grey':
            elements.greyFilter.classList.add('active');
            break;
    }

    // Send message to background script to update the filter color
    chrome.runtime.sendMessage({ r: 'setFilterColor', color: color })
        .then(() => {
            // Refresh the current tab to apply the new filter color
            chrome.tabs.sendMessage(tabId, { r: 'updateFilterColor', color: color })
                .catch(err => console.error('Failed to update filter color:', err));
        })
        .catch(err => console.error('Error setting filter color:', err));
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
        
        // Set active filter color button
        const filterColor = settings.filterColor || 'grey'; // Default to grey if not set
        setFilterColor(filterColor, activeTab.id);
    });
}

// Add event listener for 'Grab URL' button
if (elements.grabUrlBtn) {
    elements.grabUrlBtn.addEventListener('click', function () {
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            if (chrome.runtime.lastError) {
                console.error('Error querying tabs:', chrome.runtime.lastError);
                return;
            }
            if (tabs && tabs[0] && tabs[0].url) {
                elements.customUrlInput.value = tabs[0].url;
            }
        });
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
    elements.reloadTab.addEventListener('click', () => {
        chrome.tabs.reload(activeTab.id);
        window.close();
    });
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

    // Filter color button event listeners
    elements.whiteFilter.addEventListener('click', () => setFilterColor('white', activeTab.id));
    elements.blackFilter.addEventListener('click', () => setFilterColor('black', activeTab.id));
    elements.greyFilter.addEventListener('click', () => setFilterColor('grey', activeTab.id));

    // Add URL button event listener (custom input)
    if (elements.addUrlBtn && elements.customUrlInput) {
        elements.addUrlBtn.addEventListener('click', function () {
            const url = elements.customUrlInput.value.trim().toLowerCase();
            if (!url) {
                elements.customUrlInput.value = '';
                return console.log('No URL entered.');
            }
            chrome.runtime
                .sendMessage({ r: 'urlListAdd', url })
                .then(() => {
                    showImages(activeTab.id);
                    elements.customUrlInput.value = '';
                })
                .catch(err => console.error('Error adding custom URL:', err));
        });
    }
});