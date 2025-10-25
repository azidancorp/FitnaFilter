/**
 * Factory function to handle the movement of a mouse.
 */
function MouseController() {
    let mMoved = false;
    let mEvent = null;
    let mElement = null;
    /**
     * Watch the movement of the mouse in a
     * Document.
     *
     * @param {Document} doc
     */
    function watchDocument(doc) {
        doc.addEventListener('mousemove', mouseMoveCallback);
    }
    /**
     * Unwatch the movement of the mouse in a
     * Document.
     *
     * @param {Document} doc
     */
    function unwatchDocument(doc) {
        doc.removeEventListener('mousemove', mouseMoveCallback);
    }
    /*
     * Internal use
     */
    function mouseMoveCallback(event) {
        mMoved = true;
        mEvent = event;
    }
    /**
     * Determine if the local
     * Element
     * has been set.
     *
     * @returns {boolean}
     */
    function hasElement() {
        return mElement !== null;
    }
    /**
     * Reset the local
     * Element.
     */
    function clearElement() {
        mElement = null;
    }
    /**
     * Set the local
     * Element.
     *
     * @param {Element} domElement
     */
    function setElement(domElement) {
        mElement = domElement;
    }
    /**
     * Get the local
     * Element.
     *
     * @returns {Element}
     */
    function getElement() {
        return mElement;
    }
    /**
     * Set an attribute in the local
     * Element.
     *
     * @param {string} name
     * @param {string} value
     */
    function setAttrElement(name, value) {
        mElement[name] = value;
    }
    /**
     * Get an attribute's value in the local
     * Element.
     *
     * @param {string} name
     *
     * @returns value
     */
    function getAttrValueElement(name) {
        return mElement[name];
    }
    /**
     * Determine if the local
     * Element
     * is the same passed in the argument
     *
     * @returns {boolean}
     */
    function hasThatElement(domElement) {
        return mElement === domElement;
    }
    /**
     * Set the local flag to determine that the mouse has moved.
     */
    function move() {
        mMoved = true;
    }
    /**
     * Set the local flag to determine that the mouse has not moved.
     */
    function unmove() {
        mMoved = false;
    }
    /**
     * Get the local flag to determine that the mouse has moved.
     *
     * @returns {boolean}
     */
    function hasMoved() {
        return mMoved;
    }
    /**
     * Determine if the local
     * MouseEvent
     * is set.
     */
    function hasEvent() {
        return mEvent !== null;
    }
    /**
     * Get the local
     * MouseEvent
     *
     * @returns {MouseEvent}
     */
    function getEvent() {
        return mEvent;
    }

    return Object.freeze({
        watchDocument,
        unwatchDocument,
        hasElement,
        clearElement,
        setElement,
        getElement,
        setAttrElement,
        getAttrValueElement,
        hasThatElement,
        move,
        unmove,
        hasMoved,
        hasEvent,
        getEvent
    });
}
