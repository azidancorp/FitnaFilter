$(function () {
    var $addName = $('#addName').focus(), $noFaceFeatures = $('#noFaceFeatures'), $noEye = $('#noEye'), $list = $('#list'),
        $form = $('form'), isFreeText = false, $freeText = $('#free-text'), $maxSafe = $('#max-safe'),
        $autoUnpause = $('#autoUnpause'), $autoUnpauseTimeout = $('#autoUnpauseTimeout');
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
});