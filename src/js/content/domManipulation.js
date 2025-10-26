/**
 * Add css style to the head of a Document.
 *
 * @param {Document} doc - Document to hold the style.
 * @param {object} headStyles - Object to keep reference of the style
 * added.
 * @param {string} styleName - Name of the css style.
 * @param {string} style - Css style.
 *
 * @example
 * const headStyles = {};
 * const styleName = 'classA';
 * const style = '{background-image: none !important;}'
 *
 * addHeadStyle(document, headStyles, styleName, style);
 */
function addHeadStyle(doc, headStyles, styleName, style) {
    const styleElement = doc.createElement('style');
    styleElement.type = 'text/css';
    styleElement.appendChild(doc.createTextNode(styleName + style));
    doc.head.appendChild(styleElement);
    headStyles[styleName] = styleElement;
}
/**
 * Remove css style from the head of a Document.
 *
 * @param {Document} doc - Document that holds the style to be removed.
 * @param {object} headStyles - Object that keeps the reference of the
 * styles.
 * @param {string} styleName - Name of the css style.
 *
 * @example
 * const headStyles = {};
 * const styleName = 'classA';
 * const style = '{background-image: none !important;}'
 *
 * addHeadStyle(document, headStyles, styleName, style);
 * removeHeadStyle(document, headStyles, styleName);
 */
function removeHeadStyle(doc, headStyles, styleName) {
    doc.head.removeChild(headStyles[styleName]);
    delete headStyles[styleName];
}
/**
 * Add script to the head of a Document.
 *
 * @param {Document} doc - Document to hold the script
 * @param {string} [src] - Path or url to the script.
 * @param {string} [code] - Code of the script.
 * @param {function} [onload]- Callback to be called once the script element
 * is loaded.
 *
 * @example
 * const src = './js/script.js';
 * const code = "const a = 'example'; console.log(a);"
 * const onload = () => {
 *      // do something
 * };
 *
 * addHeadScript(document, src);
 * addHeadScript(document, src, code);
 * addHeadScript(document, src, code, onload);
 * addHeadScript(document, src, null, onload);
 * addHeadScript(document, null, code);
 */
function addHeadScript(doc, src, code, onload) {
    const scriptElement = doc.createElement('script');
    scriptElement.type = 'text/javascript';
    if (src) {
        scriptElement.src = src;
    }
    if (code) {
        scriptElement.appendChild(doc.createTextNode(code));
    }
    if (onload) {
        scriptElement.onload = onload;
    }
    doc.head.appendChild(scriptElement);
}
/**
 * Add css class to an Element.
 *
 * @param {Element} domElement
 * @param {string} className
 *
 * @example
 * const domElement = document.getElementById('id');
 * const className = 'classA';
 * addCssClass(domElement, className);
 */
function addCssClass(domElement, className) {
    domElement.className += ' ' + className;
}
/**
 * Remove css class from an Element.
 *
 * @param {Element} domElement
 * @param {string} className
 *
 * @example
 * const domElement = document.getElementById('id');
 * const className = 'classA';
 * removeCssClass(domElement, className);
 */
function removeCssClass(domElement, className) {
    const oldClass = domElement.className;
    const newClass = domElement.className.replace(new RegExp('\\b' + className + '\\b'), '');

    if (oldClass !== newClass) {
        domElement.className = newClass;
    }
}
/**
 * Add|remove listeners to|from an Element.
 * for different types of
 * {@link https://developer.mozilla.org/en-US/docs/Web/API/Event|events}.
 *
 * @param {Element} domElement
 * @param {object} listeners - Object that define the events and the
 * callbacks.
 * @param {boolean} add - Flag to add|remove the listeners.
 * @param {string} flag - Name of the property to be added to the
 * element. It is used to check if listeners have been added to the
 * element.
 *
 * @example
 * const mousemove = () => {
 *      // do something
 * };
 * const mouseover = () => {
 *      // do something
 * };
 * const listeners = {
 *   'mousemove': mousemove,
 *   'mouseover': mouseover
 * };
 * const element = document.getElementById('id');
 * const flag = 'has-mouse-listeners';
 *
 * handleListeners(element, listeners, true, flag); // add listeners
 * handleListeners(element, listeners, false, flag); // remove listeners
 */
function handleListeners(domElement, listeners, add, flag) {
    if (add && !domElement[flag]) {
        for (const key of Object.keys(listeners)) {
            domElement.addEventListener(key, listeners[key]);
        }
        domElement[flag] = true;
    } else if (!add && domElement[flag]) {
        for (const key of Object.keys(listeners)) {
            domElement.removeEventListener(key, listeners[key]);
        }
        domElement[flag] = false;
    }
}
/**
 * Add|remove css classes to|from an Element.
 *
 * @param {Element} domElement
 * @param {array} classNames - List of css class names.
 * @param {boolean} add - Flag to add|remove the class names.
 * @param {string} flag - Name of the property to be added to the
 * element. It is used to check if css classes have been added to the
 * element.
 *
 * @example
 * const cssClasses = ['classA', 'classB'];
 * const element = document.getElementById('id');
 * const flag = 'has-extra-classes';
 *
 * handleStyleClasses(element, cssClasses, true, flag); // adds css classes
 * handleStyleClasses(element, cssClasses, false, flag); // removes css classes
 */
function handleStyleClasses(domElement, classNames, add, flag) {
    if (add && !domElement[flag]) {
        classNames.map(className => {
            addClassToStyle(domElement, className);
        });
        domElement[flag] = true;
    } else if (!add && domElement[flag]) {
        classNames.map(className => {
            removeClassFromStyle(domElement, className);
        });
        domElement[flag] = false;
    }
}
/**
 * Add a css class to an Element.
 *
 * @param {Element} domElement
 * @param {string} className - Css class name.
 *
 * @example
 * const element = document.getElementById('id');
 * const cssClass = 'classA';
 * addClassToStyle(element, cssClass);
 */
function addClassToStyle(domElement, className) {
    domElement.className += ' ' + className;
}
/**
 * Remove a css class from an Element.
 *
 * @param {Element} domElement
 * @param {string} className - Css class name.
 *
 * @example
 * const element = document.getElementById('id');
 * const cssClass = 'classA';
 * removeClassFromStyle(element, cssClass);
 */
function removeClassFromStyle(domElement, className) {
    const oldClass = domElement.className;
    const newClass = domElement.className.replace(new RegExp('\\b' + className + '\\b'), '');
    if (oldClass !== newClass) {
        domElement.className = newClass;
    }
}
/**
 * Create a HTMLCanvasElement.
 *
 * @param {string} id - Identifier for the canvas.
 * @returns {Canvas}
 *
 * @example
 * const canvas = createCanvas('new-canvas');
 */
function createCanvas(id) {
    const canvas = document.createElement('canvas');
    canvas.setAttribute('id', id);
    canvas.style.display = 'none';
    return canvas;
}
/**
 * Hide|show an Element.
 * It works by handling the css style of the element by using the
 * {@link CSS_CLASS_HIDE} css class, the {@link IS_HIDDEN} flag, and
 * the {@link handleStyleClasses} function.
 *
 * @param {Element} domElement
 * @param {boolean} toggle
 *
 * @example
 * const element = document.getElementById('id');
 * hideElement(element, true); // hide
 * hideElement(element, false); // show
 */
function hideElement(domElement, toggle) {
    handleStyleClasses(domElement, [CSS_CLASS_HIDE], toggle, IS_HIDDEN);
}
/**
 * Swap the original srcset parameter of an HTMLImageElement.
 * It uses the {@link IS_TOGGLED} flag.
 *
 * @param {HTMLImageElement} domElement
 * @param {boolean} toggle
 *
 * @example
 * const image = document.getElementById('id');
 * image.src = 'imageA.jpg'
 * image.srcset = 'imageA_4x.jpg 4x, imageA_2x.jpg 2x'
 *
 * handleSourceOfImage(element, true);
 *
 * console.log(image.src); // 'imageA.jpg'
 * console.log(image.srcset); // ''
 *
 * handleSourceOfImage(element, false);
 *
 * console.log(image.src); // 'imageA.jpg'
 * console.log(image.srcset); // 'imageA_4x.jpg 4x, imageA_2x.jpg 2x'
 */
function handleSourceOfImage(domElement, toggle) {
    if (toggle && !domElement.getAttribute(IS_TOGGLED)) {
        domElement.oldsrc = domElement.src;
        domElement.oldsrcset = domElement.srcset;
        // Do not set to empty string, otherwise the processing
        // will result in an empty image
        // el.src = el.srcset = '';

        // Empty string to make sure filtered images are displayed
        // in the img elements
        domElement.srcset = '';
        domElement.setAttribute(IS_TOGGLED, 'true');
    } else if (!toggle && domElement.getAttribute(IS_TOGGLED) === 'true') {
        const filteredSrc = domElement.src;
        const originalSrc = domElement.oldsrc;
        domElement.oldsrc = filteredSrc;
        domElement.src = originalSrc;
        domElement.srcset = domElement.oldsrcset;
        releaseFilteredResources(domElement);
    }
}
/**
 * Sets the {@link HAS_BACKGROUND_IMAGE} flag in an Element
 * by setting the {@link handleStyleClasses} function.
 *
 * @param {Element} domElement
 * @param {boolean} toggle
 *
 * @example
 * const element = document.getElementById('id');
 * console.log(element[HAS_BACKGROUND_IMAGE]); // undefined
 *
 * handleBackgroundForElement(element, true);
 * console.log(element[HAS_BACKGROUND_IMAGE]); // true
 *
 * handleBackgroundForElement(element, false);
 * console.log(element[HAS_BACKGROUND_IMAGE]); // false
 */
function handleBackgroundForElement(domElement, toggle) {
    if (!toggle) {
        releaseFilteredResources(domElement);
    }
    handleStyleClasses(domElement, [], toggle, HAS_BACKGROUND_IMAGE)
}
/**
 * Add|remove a listener for load event in an
 * HTMLImageElement.
 * The listener is meant to process the actual bitmap of the image.
 *
 * @param {HTMLImageElement} domElement
 * @param {function} callback
 * @param {boolean} toggle
 *
 * @example
 * const element = document.getElementById('id');
 * const processImage = () => {
 *      // Do stuff to process the image
 * };
 *
 * handleLoadProcessImageListener(element, processImage, true); // Add listener
 * handleLoadProcessImageListener(element, processImage, false); // Remove listener
 */
function handleLoadProcessImageListener(domElement, callback, toggle) {
    handleListeners(domElement, {
        'load': callback
    }, toggle, HAS_PROCESS_IMAGE_LISTENER);
}
/**
 * Add|remove a listener for load event in an
 * HTMLImageElement.
 *
 * @param {HTMLImageElement} domElement
 * @param {function} callback
 * @param {boolean} toggle
 *
 * @example
 * const element = document.getElementById('id');
 * const listener = () => {
 *      // Do stuff
 * };
 *
 * handleLoadProcessImageListener(element, listener, true); // Add listener
 * handleLoadProcessImageListener(element, listener, false); // Remove listener
 *
 */
function handleLoadEventListener(domElement, callback, toggle) {
    handleListeners(domElement, {
        'load': callback
    }, toggle, HAS_LOAD_LISTENER);
}
/**
 * Process the bitmap in an
 * HTMLImageElement.
 *
 * @param {HTMLImageElement} domElement
 * @param {HTMLCanvasElement} canvas - Canvas to make the processing.
 *
 * @example
 * const image = document.getElementById('image-to-process');
 * const canvas = document.getElementById('canvas-to-do-processing');
 * processDomImage(image, canvas);
 */
async function processDomImage(domElement, canvas) {
    const uuid = domElement.getAttribute(ATTR_UUID);
    if (domElement.oldsrc !== '') {
        //This was not done yet due to lazy loading
        handleSourceOfImage(domElement, true);
    }

    try {
        if (domElement.src.indexOf("=eyJ") != -1) {
            //Some images are protected by JWT tokens (like OWA attachments)
            //They need to be fetched first
            throw new Error("Fetch with token");
        }
        await filterImageElement(domElement, uuid, canvas);
    } catch (err) {
        try {
            const image = await fetchAndReadImage(domElement.src);
            await filterImageElement(image, uuid, canvas);
        } catch (proxyError) {
            console.error('FitnaFilter: failed to process image', proxyError);
        }
    }
}
/**
 * Process the bitmap of an
 * Element
 * that has been passed as url in the background-image css attribute.
 * The url is used to retrieve the image with an
 * {@link https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest|XHR}
 * object.
 *
 * @param {Element} domElement
 * @param {string} url - Url obtained from the background-image css
 * attribute in the style of the element.
 * @param {string} suffix - Remainder of URL not used in fetch like
 * gradient and size
 * @param {HTMLCanvasElement} canvas - Canvas to do the processing.
 *
 * @example
 * const element = document.getElementById('id');
 * const url = 'http://example.com/image.jpg';
 * const canvas = document.getElementById('canvas-id');
 *
 * processBackgroundImage(element, url, canvas);
 */
function processBackgroundImage(domElement, url, suffix, canvas) {
    const uuid = domElement.getAttribute(ATTR_UUID);

    fetchAndReadImage(url).then(image => {
        filterImageElementAsBackground(image, uuid, canvas, suffix);
    }).catch(error => {
        console.error('FitnaFilter: failed to process background image', error);
    });
}
/**
 * Fetch and read an image from an url.
 *
 * @param {string} url
 *
 * @returns {Promise}
 *
 * @example
 * const url = 'http://example.com/image.jpg';
 * fetchAndReadImage(url).then(image => {
 *      // do something
 * });
 */
async function fetchAndReadImage(url) {
    try {
        const response = await chrome.runtime.sendMessage({ r: 'fetchAndReadImage', url: url });
        if (!response || !response.success || !response.dataUrl) {
            throw new Error(response && response.error ? response.error : 'Unknown background fetch failure');
        }

        const image = new Image();
        image.crossOrigin = 'anonymous';

        return await new Promise((resolve, reject) => {
            image.onload = () => resolve(image);
            image.onerror = () => reject(new Error('Failed to load fetched image'));
            image.src = response.dataUrl;
        });
    } catch (error) {
        console.error('FitnaFilter: background image fetch failed', error);
        throw error;
    }
}
/**
 * Filter the bitmap in an HTMLImageElement and update the background-image
 * attribute in the style of the Element identified with an uuid.
 *
 * @param {HTMLImageElement} imgElement
 * @param {string} uuid - Unique identifier of the element which
 * background-image style attribute will be updated.
 * @param {HTMLCanvasElement} canvas - Canvas to do the filtering.
 * @param {string} suffix - Remainder of background-image not used in fetch
 *
 * @example
 * const element = document.getElementById('id');
 * const uuid = 'some-unique-identifier';
 * const canvas = document.getElementById('canvas-id');
 *
 * filterImageElementAsBackground(element, uuid, canvas);
 */
async function filterImageElementAsBackground(imgElement, uuid, canvas, suffix) {
    const base64Img = await applyImageFilters(imgElement, uuid, canvas);
    const newBackgroundImgUrl = "url('" + base64Img + "')";
    const actualElement = findElementByUuid(document, uuid);

    if (actualElement) {
        releaseFilteredResources(actualElement);
        actualElement[ATTR_BACKGROUND_OBJECT_URL] = base64Img;
        actualElement.style.backgroundImage = newBackgroundImgUrl;
        if (suffix) {
            actualElement.style.backgroundImage += ", " + suffix;
        }
        actualElement[IS_PROCESSED] = true;

        if (base64Img && typeof base64Img === 'string' && base64Img.startsWith('blob:')) {
            let tracker;
            const cleanupObjectUrl = () => {
                try {
                    URL.revokeObjectURL(base64Img);
                } catch (error) {
                    console.warn('FitnaFilter: failed to revoke background object URL', error);
                }
                if (actualElement[ATTR_BACKGROUND_OBJECT_URL] === base64Img) {
                    actualElement[ATTR_BACKGROUND_OBJECT_URL] = null;
                }
                if (tracker) {
                    tracker.onload = null;
                    tracker.onerror = null;
                }
            };

            tracker = new Image();
            tracker.onload = cleanupObjectUrl;
            tracker.onerror = cleanupObjectUrl;
            tracker.src = base64Img;
        }
    }
}
/**
 * Filter the bitmap in an HTMLImageElement.
 * and update the src attribute in the Element identified with an uuid.
 *
 * @param {HTMLImageElement} imgElement
 * @param {number} uuid - Unique identifier of the element which
 * src attribute will be updated.
 * @param {HTMLCanvasElement} canvas - Canvas to do the filtering.
 *
 * @example
 * const element = document.getElementById('id');
 * const uuid = 'some-unique-identifier';
 * const canvas = document.getElementById('canvas-id');
 *
 * filterImageElement(element, uuid, canvas);
 */
async function filterImageElement(imgElement, uuid, canvas) {
    const urlData = await applyImageFilters(imgElement, uuid, canvas);
    const actualElement = findElementByUuid(document, uuid);

    if (actualElement) {
        releaseFilteredResources(actualElement);
        actualElement[ATTR_OBJECT_URL] = urlData;
        actualElement.src = urlData;
        actualElement.srcset = '';
        actualElement.onload = () => {
            removeCssClass(actualElement, CSS_CLASS_HIDE);
            actualElement.setAttribute(IS_PROCESSED, 'true');
            actualElement[IS_PROCESSED] = true;
            handleBackgroundForElement(actualElement, true);

            if (urlData && typeof urlData === 'string' && urlData.startsWith('blob:')) {
                try {
                    URL.revokeObjectURL(urlData);
                } catch (error) {
                    console.warn('FitnaFilter: failed to revoke object URL for image', error);
                }
            }

            if (actualElement[ATTR_OBJECT_URL] === urlData) {
                actualElement[ATTR_OBJECT_URL] = null;
            }

            actualElement.onload = null;
        };
    }
}
/**
 * Find the Element in the corresponding Document by using element's uuid.
 *
 * @param {Document} doc
 * @param {string} uuid
 *
 * @returns {Element}
 *
 * @example
 * const uuid = 'some-unique-identifier';
 * const actualElement = findElementByUuid(document, uuid);
 */
function findElementByUuid(doc, uuid) {
    if (!uuid) {
        return null;
    }

    return doc.querySelector('[' + ATTR_UUID + '="' + uuid + '"]');
}

/**
 * Add a random uuid to an Element.
 *
 * @param {Element} domElement
 *
 * @example
 * const element = document.getElementById('id');
 * addRandomWizUuid(element);
 */
function addRandomWizUuid(domElement) {

    if (domElement.getAttribute(ATTR_UUID) === null) {

        domElement.setAttribute(ATTR_UUID, guid());

    }
}

/**
 * Release any blob URLs associated with a filtered element to avoid leaks.
 *
 * @param {Element} domElement
 */
function releaseFilteredResources(domElement) {
    if (!domElement) {
        return;
    }

    if (domElement[ATTR_OBJECT_URL] && typeof domElement[ATTR_OBJECT_URL] === 'string' &&
        domElement[ATTR_OBJECT_URL].startsWith('blob:')) {
        URL.revokeObjectURL(domElement[ATTR_OBJECT_URL]);
    }
    if (domElement[ATTR_BACKGROUND_OBJECT_URL] && typeof domElement[ATTR_BACKGROUND_OBJECT_URL] === 'string' &&
        domElement[ATTR_BACKGROUND_OBJECT_URL].startsWith('blob:')) {
        URL.revokeObjectURL(domElement[ATTR_BACKGROUND_OBJECT_URL]);
    }

    domElement[ATTR_OBJECT_URL] = null;
    domElement[ATTR_BACKGROUND_OBJECT_URL] = null;
}
/**
 * Generate an uuid.
 *
 * @returns {string}
 *
 * @example
 * const uuid = guid();
 */
function guid() {
    // See https://stackoverflow.com/a/105074/1065981
    function s4() {
        return Math.floor((1 + Math.random()) * 0x10000)
            .toString(16)
            .substring(1);
    }
    return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
        s4() + '-' + s4() + s4() + s4();
}
/**
 * Determine if a MouseEvent ocurred within the boundaries of a rectangle.
 *
 * @param {Event} event
 * @param {object} coords - Object defining the coordinates of a
 * rectangle.
 *
 * @example
 * const event = new MouseEvent();
 * event.x = 50;
 * event.y = 50;
 * const coords = {left: 10, top: 10, right: 100, bottom: 100};
 *
 * console.log(isMouseIn(event, coords)); // true
 */
function isMouseIn(event, coords) {
    return event.x >= coords.left && event.x < coords.right && event.y >= coords.top && event.y < coords.bottom;
}
