$(function () {
    var $addName = $('#addName').focus(), $noFaceFeatures = $('#noFaceFeatures'), $noEye = $('#noEye'), $list = $('#list'),
        $form = $('form'), isFreeText = false, $freeText = $('#free-text'), $maxSafe = $('#max-safe'),
        $autoUnpause = $('#autoUnpause'), $autoUnpauseTimeout = $('#autoUnpauseTimeout'),
        $viceBlocklistContainer = $('#vice-blocklist-container'),
        $hazardBlocklistContainer = $('#hazard-blocklist-container');
    chrome.runtime.sendMessage({ r: 'getSettings' }, function (settings) {
        $noEye[0].checked = settings.isNoEye;
        $noFaceFeatures[0].checked = settings.isNoFaceFeatures;
        $autoUnpause[0].checked = settings.autoUnpause;
        $autoUnpauseTimeout.val(settings.autoUnpauseTimeout);
        $maxSafe.val(settings.maxSafe);
    });
    chrome.runtime.onMessage.addListener(function (request) {
        if (request.r == 'urlListModified')
            CreateList();
    });
    $noEye.click(function () {
        chrome.runtime.sendMessage({ r: 'setNoEye', toggle: this.checked });
    });
    $noFaceFeatures.click(function () {
        chrome.runtime.sendMessage({ r: 'setNoFaceFeatures', toggle: this.checked });
    });
    $autoUnpause.click(function () {
        chrome.runtime.sendMessage({ r: 'setAutoUnpause', toggle: this.checked });
    });
    $autoUnpauseTimeout.change(function() {
        chrome.runtime.sendMessage({ r: 'setAutoUnpauseTimeout', autoUnpauseTimeout: $autoUnpauseTimeout.val() });
    });
    $maxSafe.change(function () {
        chrome.runtime.sendMessage({ r: 'setMaxSafe', maxSafe: $maxSafe.val() });
    });
    $(window).on('unload', function () { $maxSafe.blur(); });
    $form.submit(function () {
        var url = $.trim($addName.val()).toLowerCase();
        if (!url.length) return;
        chrome.runtime.sendMessage({ r: 'urlListAdd', url: url }, CreateList);
        $addName.val('');
        return false;
    });
    $list.on('click', '.delete', function () {
        var $parent = $(this).parent();
        chrome.runtime.sendMessage({ r: 'urlListRemove', index: $parent.index() });
        CreateList();
    });
    function CreateList() {
        chrome.runtime.sendMessage({ r: 'getUrlList' }, function (urlList) {
            $list.empty();
            if (isFreeText) {
                var $textarea = $('<textarea>').css('width', '100%').attr('rows', '15').addClass('free-text-enabled'), text = '';
                for (var i = 0; i < urlList.length; i++) {
                    text += urlList[i] + '\n';
                }
                $textarea.val(text);
                $list.append($textarea);
                $textarea.change(function () {
                    var text = $textarea.val(), lines = text.split('\n'), urls = [];
                    for (var i = 0; i < lines.length; i++) {
                        var url = lines[i].trim();
                        if (url)
                            urls.push(url);
                    }
                    chrome.runtime.sendMessage({ r: 'setUrlList', urlList: urls }, CreateList);                        
                });
            }
            else {
                for (var i = 0; i < urlList.length; i++)
                    $list.append("<div class='item'><span class='delete'>X</span> <span class='url'>" + urlList[i] + '</span></div>');
            }
        });
    }
    $freeText.click(function () {
        isFreeText = $freeText[0].checked;
        CreateList();
    });
    CreateList();
    
    // Load and populate blocklists
    function loadBlocklists() {
        chrome.runtime.sendMessage({ r: 'getBlocklists' }, function(blocklists) {
            if (!blocklists) return;
            
            console.log("Received blocklists:", blocklists);
            
            // Clear containers
            $viceBlocklistContainer.empty();
            $hazardBlocklistContainer.empty();
            
            // Organize blocklists by category
            const viceBlocklists = [];
            const hazardBlocklists = [];
            
            // Sort and categorize
            Object.entries(blocklists).forEach(([name, info]) => {
                console.log(`Processing ${name}: category=${info.category}, enabled=${info.enabled}`);
                if (info.category === 'vice') {
                    viceBlocklists.push([name, info]);
                } else if (info.category === 'hazard') {
                    hazardBlocklists.push([name, info]);
                } else {
                    console.warn(`Blocklist ${name} has unknown category: ${info.category}`);
                }
            });
            
            // Sort each category alphabetically by description
            viceBlocklists.sort((a, b) => a[1].description.localeCompare(b[1].description));
            hazardBlocklists.sort((a, b) => a[1].description.localeCompare(b[1].description));
            
            // Create Vice blocklist items
            viceBlocklists.forEach(([name, info]) => {
                const $blocklistItem = $('<div>').addClass('checkbox-group blocklist-item vice-item');
                const $checkbox = $('<input type="checkbox">').attr({
                    id: 'blocklist-' + name,
                    'data-blocklist': name
                }).prop('checked', true) // Always checked
                  .prop('disabled', true); // Cannot be unchecked
                
                const $label = $('<label>').attr('for', 'blocklist-' + name).text(info.description);
                
                $blocklistItem.append($checkbox).append($label);
                $viceBlocklistContainer.append($blocklistItem);
                
                // Always ensure vice categories are enabled
                if (!info.enabled) {
                    chrome.runtime.sendMessage({
                        r: 'toggleBlocklist',
                        name: name,
                        enabled: true
                    });
                }
            });
            
            // Create Hazard blocklist items
            hazardBlocklists.forEach(([name, info]) => {
                const $blocklistItem = $('<div>').addClass('checkbox-group blocklist-item hazard-item');
                const $checkbox = $('<input type="checkbox">').attr({
                    id: 'blocklist-' + name,
                    'data-blocklist': name
                }).prop('checked', info.enabled);
                
                const $label = $('<label>').attr('for', 'blocklist-' + name).text(info.description);
                
                $blocklistItem.append($checkbox).append($label);
                $hazardBlocklistContainer.append($blocklistItem);
                
                // Set up event handler for toggleable hazard blocklists
                $checkbox.on('change', function() {
                    const name = $(this).data('blocklist');
                    const enabled = this.checked;
                    
                    chrome.runtime.sendMessage({
                        r: 'toggleBlocklist',
                        name: name,
                        enabled: enabled
                    });
                });
            });
        });
    }
    
    // Load blocklists when the page is ready
    loadBlocklists();
});