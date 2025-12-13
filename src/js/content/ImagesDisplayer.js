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
     * Remove iframes that are no longer connected to the DOM.
     * This prevents memory leaks from holding references to removed iframes.
     */
    function pruneDisconnected() {
        mIframes = mIframes.filter(iframe => iframe && iframe.isConnected);
    }

    /**
     * Add an iframe with deduplication and pruning.
     * @param {HTMLIFrameElement} iframe
     */
    function addIFrame(iframe) {
        if (!iframe || !iframe.isConnected) {
            return;
        }
        // Prune disconnected iframes to prevent unbounded growth
        pruneDisconnected();
        // Only add if not already in list (prevents duplicates on reprocess)
        if (mIframes.indexOf(iframe) === -1) {
            mIframes.push(iframe);
        }
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

        // Prune disconnected iframes before iterating
        pruneDisconnected();

        mIframes.forEach(iframe => {
            try {
                if (iframe.contentWindow && iframe.contentWindow.skfShowImages) {
                    iframe.contentWindow.skfShowImages();
                }
            } catch (err) {
                // Cross-origin or detached iframe - silently ignore
            }
        });
    }

    /**
     * Reset the displayer state. Called when the extension is being
     * completely torn down or reinitialized.
     */
    function reset() {
        mShowAll = false;
        mIframes = [];
    }

    return Object.freeze({
        setShowAll,
        isShowAll,
        addIFrame,
        showImages,
        pruneDisconnected,
        reset
    });
}