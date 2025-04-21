/**
 * Factory function to handle the visibility of images in a window and its iframes.
 */
function ImagesDisplayer() {
    let mShowAll = false;
    let mIframes = [];

    /**
     * Set the flag used to show the images.
     * @param {boolean} show
     */
    function setShowAll(show) {
        mShowAll = show;
    }

    /**
     * Get the flag used to show the images.
     * @returns {boolean}
     */
    function isShowAll() {
        return mShowAll;
    }

    /**
     * Add an iframe.
     * @param {HTMLIFrameElement} iframe
     */
    function addIFrame(iframe) {
        mIframes.push(iframe);
    }

    /**
     * Display images in a window and its iframes.
     */
    function showImages() {
        if (mShowAll) {
            return;
        }

        mShowAll = true;

        if (window === top) {
            chrome.runtime.sendMessage({
                r: 'setColorIcon',
                toggle: false
            });
        }

        if (window.skfShowImages !== null) {
            window.skfShowImages();
        }

        mIframes.map(iframe => {
            try {
                if (iframe.contentWindow && iframe.contentWindow.skfShowImages) {
                    iframe.contentWindow.skfShowImages();
                }

            } catch (err) {

            }
        });
    }

    return Object.freeze({
        setShowAll,
        isShowAll,
        addIFrame,
        showImages
    });
}