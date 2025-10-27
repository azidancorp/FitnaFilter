/**
 * Factory function to create the eye
 * that allows to display the original filtered images.
 *
 * @param {Document} doc
 */
function Eye(doc) {
    let mDomElement = createEye(doc);
    let mCurrentMode = 'reveal'; // 'reveal' or 'undo'
    let mRevealCallback = null;
    let mFilterCallback = null;
    let mTargetElement = null;

    /**
     * Create the eye that is positioned accordingly in elements with filtered images
     * to show the original unfiltered images.
     *
     * @param {Document} doc
     * @returns {Element}
     */
    function createEye(doc) {
        const eye = doc.createElement('div');

        eye.style.display = 'none';
        eye.style.width = eye.style.height = '16px';
        eye.style.position = 'fixed';
        eye.style.zIndex = 1e8;
        eye.style.cursor = 'pointer';
        eye.style.padding = '0';
        eye.style.margin = '0';
        eye.style.opacity = '.5';

        return eye;
    }

    /**
     * Get the eye to show to original unfiltered images.
     *
     * @returns {Element}
     */
    function getDomElement() {
        return mDomElement;
    }

    /**
     * Position the eye in the top right corner of an element.
     *
     * @param {Element} domElement
     * @param {object} coords
     * @param {Document} doc
     */
    function position(domElement, coords, doc) {
        mDomElement.style.top = (coords.top < 0 ? 0 : coords.top) + 'px';
        let left = coords.right;
        if (left > doc.documentElement.clientWidth) {
            left = doc.documentElement.clientWidth;
        }
        mDomElement.style.left = (left - 16) + 'px';
    }

    /**
     * Hide the eye.
     */
    function hide() {
        mDomElement.style.display = 'none';
    }

    /**
     * Show the eye.
     */
    function show() {
        mDomElement.style.display = 'block';
    }

    /**
     * Set the element which original unfiltered image might be shown,
     * with toggle support for reveal/undo.
     *
     * @param {Element} domElement
     * @param {Function} revealCallback - Callback to reveal original image
     * @param {Function} filterCallback - Callback to re-apply filter
     * @param {string} eyeCSSUrl - CSS URL for reveal icon
     * @param {string} undoCSSUrl - CSS URL for undo icon
     */
    function setAnchor(domElement, revealCallback, filterCallback, eyeCSSUrl, undoCSSUrl) {
        mTargetElement = domElement;
        mRevealCallback = revealCallback;
        mFilterCallback = filterCallback;

        // Set initial mode based on element state
        if (domElement[IS_REVEALED]) {
            mCurrentMode = 'undo';
            mDomElement.style.backgroundImage = undoCSSUrl;
        } else {
            mCurrentMode = 'reveal';
            mDomElement.style.backgroundImage = eyeCSSUrl;
        }

        mDomElement.onclick = event => {
            event.stopPropagation();

            if (mCurrentMode === 'reveal') {
                // Reveal original image
                mRevealCallback(domElement);
                mCurrentMode = 'undo';
                mDomElement.style.backgroundImage = undoCSSUrl;
                // Keep eye visible (don't hide)
            } else {
                // Re-apply filter
                mFilterCallback(domElement);
                mCurrentMode = 'reveal';
                mDomElement.style.backgroundImage = eyeCSSUrl;
                // Keep eye visible (don't hide)
            }
        };
    }

    /**
     * Attach the eye to an element.
     *
     * @param {Element} domElement
     */
    function attachTo(domElement) {
        domElement.appendChild(mDomElement);
    }

    /**
     * Detach the eye from the current element it is currently attached to.
     */
    function detach() {
        if (mDomElement && mDomElement.parentNode) {
            mDomElement.parentNode.removeChild(mDomElement);
        }
    }

    /**
     * Reset the eye to reveal mode (used when re-filtering an element).
     */
    function resetToRevealMode() {
        mCurrentMode = 'reveal';
    }

    return Object.freeze({
        createEye,
        getDomElement,
        position,
        hide,
        show,
        setAnchor,
        attachTo,
        detach,
        resetToRevealMode
    });
}