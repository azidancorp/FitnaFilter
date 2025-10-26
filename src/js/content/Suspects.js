/**
 * Factory function to handle a list of potential elements.
 */
function Suspects() {
    let mList = [];

    function pruneDisconnected() {
        mList = mList.filter(suspect => {
            if (!suspect || !suspect.isConnected) {
                if (suspect && typeof releaseFilteredResources === 'function') {
                    releaseFilteredResources(suspect);
                }
                return false;
            }
            return true;
        });
    }

    /**
     * Apply a callback to the list of elements.
     * @param {function} callback
     */
    function applyCallback(callback) {
        pruneDisconnected();
        mList.forEach(suspect => {
            callback(suspect);
        });
    }

    /**
     * Add an element to the list.
     * @param {Element} domElement
     */
    function addSuspect(domElement) {
        pruneDisconnected();
        if (!domElement || !domElement.isConnected) {
            return;
        }
        if (mList.indexOf(domElement) === -1) {
            mList.push(domElement);
            domElement[ATTR_RECTANGLE] = domElement.getBoundingClientRect();
        }
    }

    /**
     * Update the bounding rectangles of the elements in the list.
     */
    function updateSuspectsRectangles() {
        pruneDisconnected();
        mList.forEach(suspect => {
            suspect[ATTR_RECTANGLE] = suspect.getBoundingClientRect();
        });
    }
    /**
     * Find the elements that are under the mouse pointer.
     * @param {Element} defaultElement
     * @param {MouseEvent} mouseEvent
     */
    function findSuspectsUnderMouse(defaultElement, mouseEvent) {
        pruneDisconnected();
        let foundSize = defaultElement ?
            defaultElement[ATTR_RECTANGLE].width * defaultElement[ATTR_RECTANGLE].height :
            null;

        return mList.filter(suspect => {
            if (suspect === defaultElement) {
                return false;
            }

            const rect = suspect[ATTR_RECTANGLE];
            if (!rect) {
                return false;
            }

            let isValid = false;
            if (isMouseIn(mouseEvent, rect)) {
                if (!defaultElement) {
                    isValid = true;
                } else if (!defaultElement[HAS_BACKGROUND_IMAGE] &&
                    suspect[HAS_BACKGROUND_IMAGE]) {
                    isValid = true;
                } else if ((foundSize > rect.width * rect.height) &&
                    defaultElement[HAS_BACKGROUND_IMAGE] === suspect[HAS_BACKGROUND_IMAGE]) {
                    isValid = true;
                }
                if (isValid) {
                    foundSize = rect.width * rect.height;
                }
            }

            return isValid;
        });
    }

    return Object.freeze({
        applyCallback,
        addSuspect,
        updateSuspectsRectangles,
        findSuspectsUnderMouse
    });
}
