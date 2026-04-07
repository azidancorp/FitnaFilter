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
    grabUrlBtn: document.getElementById('grabUrlBtn'),
    statusIndicator: document.getElementById('statusIndicator')
};

let currentFilterColor = null;

/**
 * Updates the status indicator in the footer
 * @param {boolean} isPaused - Whether filtering is paused
 */
function updateStatusIndicator(isPaused) {
    if (!elements.statusIndicator) return;
    
    const dot = elements.statusIndicator.querySelector('.status-dot');
    const text = elements.statusIndicator.querySelector('.status-text');
    
    if (isPaused) {
        elements.statusIndicator.classList.add('paused');
        dot.style.background = '#ff4757';
        dot.style.boxShadow = '0 0 8px #ff4757';
        text.textContent = 'Paused';
    } else {
        elements.statusIndicator.classList.remove('paused');
        dot.style.background = '#00d9a5';
        dot.style.boxShadow = '0 0 8px #00d9a5';
        text.textContent = 'Active';
    }
}

/**
 * Creates a ripple effect on button click
 * @param {Event} e - Click event
 */
function createRipple(e) {
    const button = e.currentTarget;
    const rect = button.getBoundingClientRect();
    const ripple = document.createElement('span');
    const size = Math.max(rect.width, rect.height);
    const x = e.clientX - rect.left - size / 2;
    const y = e.clientY - rect.top - size / 2;
    
    ripple.style.cssText = `
        position: absolute;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.3);
        width: ${size}px;
        height: ${size}px;
        left: ${x}px;
        top: ${y}px;
        pointer-events: none;
        animation: ripple 0.6s ease-out;
    `;
    
    button.appendChild(ripple);
    setTimeout(() => ripple.remove(), 600);
}

/**
 * Shows images on the specified tab
 * @param {number} tabId - The ID of the tab to show images on
 */
function showImages(tabId) {
    chrome.tabs.sendMessage(tabId, { r: 'showImages' })
        .catch(err => console.error('Failed to show images:', err));
}

/**
 * Apply the active class to the selected filter color button without messaging.
 * @param {string} color
 */
function applyFilterColorUI(color) {
    elements.whiteFilter.classList.toggle('active', color === 'white');
    elements.blackFilter.classList.toggle('active', color === 'black');
    elements.greyFilter.classList.toggle('active', color === 'grey');
}

/**
 * Sends the new filter color to background and active tab if supported.
 * @param {string} color
 * @param {number} tabId
 */
function dispatchFilterColor(color, tabId) {
    chrome.runtime.sendMessage({ r: 'setFilterColor', color: color })
        .then(() => {
            if (tabId) {
                chrome.tabs.get(tabId, (tab) => {
                    if (chrome.runtime.lastError) {
                        console.log('Tab not found:', chrome.runtime.lastError.message);
                        return;
                    }

                    if (tab.url && !tab.url.startsWith('chrome://')) {
                        chrome.tabs.sendMessage(tabId, { r: 'updateFilterColor', color: color })
                            .catch(err => {
                                console.log('Note: Filter color updated in storage but not in current tab');
                            });
                    } else {
                        console.log('Cannot send messages to this tab type');
                    }
                });
            }
        })
        .catch(err => console.error('Error setting filter color:', err));
}

/**
 * Sets the filter color and updates UI
 * @param {string} color - The color to set ('white', 'black', or 'grey')
 * @param {number} tabId - The ID of the active tab
 * @param {{force?: boolean, broadcast?: boolean}} options
 */
function setFilterColor(color, tabId, options = {}) {
    const normalizedColor = ['white', 'black', 'grey'].includes(color) ? color : 'grey';
    const force = options.force === true;
    const broadcast = options.broadcast !== false;

    if (!force && normalizedColor === currentFilterColor) {
        return;
    }

    currentFilterColor = normalizedColor;
    applyFilterColorUI(normalizedColor);

    if (broadcast) {
        dispatchFilterColor(normalizedColor, tabId);
    }
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
        
        // Update status indicator
        const isPaused = settings.isPaused || settings.isPausedForTab;
        updateStatusIndicator(isPaused);
        
        // Set active filter color button
        const filterColor = settings.filterColor || 'grey'; // Default to grey if not set
        setFilterColor(filterColor, activeTab.id, { broadcast: false, force: true });
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

    // Setup event listeners with ripple effects
    const buttons = document.querySelectorAll('.btn');
    buttons.forEach(button => {
        button.addEventListener('click', createRipple);
    });

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
            .then(() => {
                showImages(activeTab.id);
                updateStatusIndicator(this.checked || elements.pauseForTab.checked);
            })
            .catch(err => console.error('Error toggling pause:', err));
    });
    elements.pauseForTab.addEventListener('click', function() {
        chrome.runtime.sendMessage({ r: 'pauseForTab', tabId: activeTab.id, toggle: this.checked })
            .then(() => {
                showImages(activeTab.id);
                updateStatusIndicator(elements.pauseChk.checked || this.checked);
            })
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
