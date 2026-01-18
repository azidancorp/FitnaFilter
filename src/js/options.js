document.addEventListener("DOMContentLoaded", function () {
    // Element selectors
    const addNameInput = document.getElementById("addName");
    const noFaceFeaturesCheckbox = document.getElementById("noFaceFeatures");
    const noEyeCheckbox = document.getElementById("noEye");
    const listElement = document.getElementById("list");
    const form = document.querySelector("form");
    const freeTextCheckbox = document.getElementById("free-text");
    const maxSafeInput = document.getElementById("max-safe");
    const autoUnpauseCheckbox = document.getElementById("autoUnpause");
    const autoUnpauseTimeoutInput =
        document.getElementById("autoUnpauseTimeout");
    const excludeLocalhostCheckbox = document.getElementById("excludeLocalhost");
    const viceBlocklistContainer = document.getElementById(
        "vice-blocklist-container"
    );
    const hazardBlocklistContainer = document.getElementById(
        "hazard-blocklist-container"
    );
    const distractionBlocklistContainer = document.getElementById(
        "distraction-blocklist-container"
    );

    let isFreeText = false;

    // --- Initial Setup ---

    // Focus on the addName input initially
    addNameInput.focus();

    // Get initial settings from background script
    chrome.runtime.sendMessage({ r: "getSettings" }, function (settings) {
        if (chrome.runtime.lastError) {
            console.error("Error getting settings:", chrome.runtime.lastError);
            return;
        }
        if (settings) {
            noEyeCheckbox.checked = settings.isNoEye;
            noFaceFeaturesCheckbox.checked = settings.isNoFaceFeatures;
            autoUnpauseCheckbox.checked = settings.autoUnpause;
            autoUnpauseTimeoutInput.value = settings.autoUnpauseTimeout;
            maxSafeInput.value = settings.maxSafe;
            excludeLocalhostCheckbox.checked = settings.excludeLocalhost !== false;
        } else {
            console.warn("Received null settings object.");
        }
    });

    // Listen for messages from background script (e.g., if list modified elsewhere)
    chrome.runtime.onMessage.addListener(function (
        request,
        sender,
        sendResponse
    ) {
        if (request.r === "urlListModified") {
            createList();
        }
        // Keep the message channel open for asynchronous response if needed
        // return true;
    });

    // --- Event Listeners ---

    noEyeCheckbox.addEventListener("click", function () {
        chrome.runtime.sendMessage({ r: "setNoEye", toggle: this.checked });
    });

    noFaceFeaturesCheckbox.addEventListener("click", function () {
        chrome.runtime.sendMessage({
            r: "setNoFaceFeatures",
            toggle: this.checked,
        });
    });

    autoUnpauseCheckbox.addEventListener("click", function () {
        chrome.runtime.sendMessage({
            r: "setAutoUnpause",
            toggle: this.checked,
        });
    });

    excludeLocalhostCheckbox.addEventListener("click", function () {
        chrome.runtime.sendMessage({
            r: "setExcludeLocalhost",
            toggle: this.checked,
        });
    });

    autoUnpauseTimeoutInput.addEventListener("change", function () {
        chrome.runtime.sendMessage({
            r: "setAutoUnpauseTimeout",
            autoUnpauseTimeout: this.value,
        });
    });

    maxSafeInput.addEventListener("change", function () {
        chrome.runtime.sendMessage({ r: "setMaxSafe", maxSafe: this.value });
    });

    // Ensure maxSafe value is potentially saved if changed just before leaving
    window.addEventListener("unload", function () {
        // Triggering blur might cause a change event if the value differs
        maxSafeInput.blur();
    });

    form.addEventListener("submit", function (event) {
        event.preventDefault(); // Prevent default form submission
        const url = addNameInput.value.trim().toLowerCase();
        if (!url.length) return;
        chrome.runtime.sendMessage({ r: "urlListAdd", url: url }, createList); // Use createList as callback
        addNameInput.value = "";
    });

    // Event delegation for delete buttons within the list
    listElement.addEventListener("click", function (event) {
        if (event.target && event.target.classList.contains("delete")) {
            const itemElement = event.target.parentElement;
            // Find the index of the clicked item among its siblings
            const index = Array.from(
                itemElement.parentElement.children
            ).indexOf(itemElement);
            if (index > -1) {
                chrome.runtime.sendMessage(
                    { r: "urlListRemove", index: index },
                    createList
                ); // Use createList as callback
                // createList will rebuild the list, so no need to remove the element directly
            }
        }
    });

    freeTextCheckbox.addEventListener("click", function () {
        isFreeText = this.checked;
        createList(); // Rebuild list based on the new mode
    });

    // --- List Creation Function ---

    function createList() {
        chrome.runtime.sendMessage({ r: "getUrlList" }, function (urlList) {
            if (chrome.runtime.lastError) {
                console.error(
                    "Error getting URL list:",
                    chrome.runtime.lastError
                );
                listElement.innerHTML = "<p>Error loading exception list.</p>";
                return;
            }
            if (!urlList) {
                console.warn("Received null URL list.");
                urlList = []; // Ensure urlList is an array
            }

            listElement.innerHTML = ""; // Clear current list

            if (isFreeText) {
                const textarea = document.createElement("textarea");
                textarea.style.width = "100%";
                textarea.setAttribute("rows", "15");
                textarea.classList.add("free-text-enabled");
                textarea.value = urlList.join("\n"); // Join URLs with newline

                textarea.addEventListener("change", function () {
                    const text = textarea.value;
                    const lines = text.split("\n");
                    const urls = [];
                    for (let i = 0; i < lines.length; i++) {
                        const url = lines[i].trim();
                        if (url) {
                            urls.push(url);
                        }
                    }
                    // Send the updated list back to the background script
                    chrome.runtime.sendMessage(
                        { r: "setUrlList", urlList: urls },
                        createList
                    ); // Recreate list after setting
                });

                listElement.appendChild(textarea);
            } else {
                // Create list items
                urlList.forEach((url) => {
                    const div = document.createElement("div");
                    div.className = "item";
                    // Use textContent for security and simplicity
                    div.innerHTML =
                        "<span class='delete'>X</span> <span class='url'></span>";
                    div.querySelector(".url").textContent = url; // Set URL text safely
                    listElement.appendChild(div);
                });
            }
        });
    }

    // --- Blocklist Loading and Handling ---

    function loadBlocklists() {
        chrome.runtime.sendMessage(
            { r: "getBlocklists" },
            function (blocklists) {
                if (chrome.runtime.lastError) {
                    console.error(
                        "Error getting blocklists:",
                        chrome.runtime.lastError
                    );
                    viceBlocklistContainer.innerHTML =
                        "<p>Error loading blocklists.</p>";
                    hazardBlocklistContainer.innerHTML =
                        "<p>Error loading blocklists.</p>";
                    distractionBlocklistContainer.innerHTML =
                        "<p>Error loading blocklists.</p>";
                    return;
                }
                if (!blocklists) {
                    console.warn("Received null blocklists object.");
                    // Clear loading indicators even if blocklists are empty/null
                    viceBlocklistContainer.innerHTML = "";
                    hazardBlocklistContainer.innerHTML = "";
                    distractionBlocklistContainer.innerHTML = "";
                    return;
                }

                console.log("Received blocklists:", blocklists);

                // Clear containers (remove loading indicators)
                viceBlocklistContainer.innerHTML = "";
                hazardBlocklistContainer.innerHTML = "";
                distractionBlocklistContainer.innerHTML = "";

                // Organize blocklists by category
                const viceBlocklists = [];
                const hazardBlocklists = [];
                const distractionBlocklists = [];

                // Sort and categorize
                Object.entries(blocklists).forEach(([name, info]) => {
                    console.log(
                        `Processing ${name}: category=${info.category}, enabled=${info.enabled}`
                    );
                    if (info.category === "vice") {
                        viceBlocklists.push([name, info]);
                    } else if (info.category === "hazard") {
                        hazardBlocklists.push([name, info]);
                    } else if (info.category === "distraction") {
                        distractionBlocklists.push([name, info]);
                    } else {
                        console.warn(
                            `Blocklist ${name} has unknown category: ${info.category}`
                        );
                    }
                });

                // Sort each category alphabetically by description
                const sortFn = (a, b) =>
                    a[1].description.localeCompare(b[1].description);
                viceBlocklists.sort(sortFn);
                hazardBlocklists.sort(sortFn);
                distractionBlocklists.sort(sortFn);

                // --- Helper function to create a blocklist item ---
                function createBlocklistItem(
                    container,
                    name,
                    info,
                    isEnabled,
                    isDisabled,
                    categoryClass
                ) {
                    const blocklistItemDiv = document.createElement("div");
                    blocklistItemDiv.className = `checkbox-group blocklist-item ${categoryClass}`;

                    const checkbox = document.createElement("input");
                    checkbox.type = "checkbox";
                    checkbox.id = "blocklist-" + name;
                    checkbox.dataset.blocklist = name; // Use dataset for custom data attributes
                    checkbox.checked = isEnabled;
                    checkbox.disabled = isDisabled;

                    const label = document.createElement("label");
                    label.setAttribute("for", "blocklist-" + name);
                    label.textContent = info.description;

                    blocklistItemDiv.appendChild(checkbox);
                    blocklistItemDiv.appendChild(label);
                    container.appendChild(blocklistItemDiv);

                    return checkbox; // Return checkbox for attaching event listener if needed
                }

                // --- Create Vice blocklist items ---
                viceBlocklists.forEach(([name, info]) => {
                    // Vice blocklists are always checked and disabled
                    createBlocklistItem(
                        viceBlocklistContainer,
                        name,
                        info,
                        true,
                        true,
                        "vice-item"
                    );

                    // Ensure vice categories are enabled in the background
                    if (!info.enabled) {
                        chrome.runtime.sendMessage({
                            r: "toggleBlocklist",
                            name: name,
                            enabled: true,
                        });
                    }
                });

                // --- Create Hazard blocklist items ---
                hazardBlocklists.forEach(([name, info]) => {
                    // Hazard blocklists are checked by default, but remain toggleable
                    // and respect user preferences when they've been explicitly disabled
                    const checkbox = createBlocklistItem(
                        hazardBlocklistContainer,
                        name,
                        info,
                        info.enabled, // Use the stored state to respect user preference
                        false,
                        "hazard-item"
                    );

                    // Set up event handler for toggleable hazard blocklists
                    checkbox.addEventListener("change", function () {
                        const blocklistName = this.dataset.blocklist; // Access data attribute
                        const isEnabled = this.checked;

                        chrome.runtime.sendMessage({
                            r: "toggleBlocklist",
                            name: blocklistName,
                            enabled: isEnabled,
                        });
                    });
                    
                    // For newly added hazard categories or first installation,
                    // enable them by default
                    if (info.enabled === undefined) {
                        checkbox.checked = true;
                        chrome.runtime.sendMessage({
                            r: "toggleBlocklist",
                            name: name,
                            enabled: true,
                        });
                    }
                });

                // --- Create Distraction blocklist items ---
                distractionBlocklists.forEach(([name, info]) => {
                    // Distraction blocklists are toggleable
                    const checkbox = createBlocklistItem(
                        distractionBlocklistContainer,
                        name,
                        info,
                        info.enabled,
                        false,
                        "distraction-item"
                    );

                    // Set up event handler for toggleable distraction blocklists
                    checkbox.addEventListener("change", function () {
                        const blocklistName = this.dataset.blocklist; // Access data attribute
                        const isEnabled = this.checked;

                        chrome.runtime.sendMessage({
                            r: "toggleBlocklist",
                            name: blocklistName,
                            enabled: isEnabled,
                        });
                    });
                });
            }
        );
    }

    // --- Initial Calls ---
    createList(); // Initial population of the exception list
    loadBlocklists(); // Initial population of the blocklists
});
