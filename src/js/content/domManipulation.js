/**
 * Add css style to the head of a
 * {@link https://developer.mozilla.org/en-US/docs/Web/API/Document|document}.
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
 * Remove css style from the head of a
 * {@link https://developer.mozilla.org/en-US/docs/Web/API/Document|document}.
 *
 * @param {Document} doc - Document that holds the style to be
 * removed.
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
 * Add script to the head of a
 * {@link https://developer.mozilla.org/en-US/docs/Web/API/Document|document}.
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
 * Add css class to an
 * {@link https://developer.mozilla.org/en-US/docs/Web/API/Element|element}.
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
 * Remove css class from an
 * {@link https://developer.mozilla.org/en-US/docs/Web/API/Element|element}.
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
 * Add|remove listeners to|from an
 * {@link https://developer.mozilla.org/en-US/docs/Web/API/Element|element}.
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
 * Add|remove css classes to|from an
 * {@link https://developer.mozilla.org/en-US/docs/Web/API/Element|element}.
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
 * Add a css class to an
 * {@link https://developer.mozilla.org/en-US/docs/Web/API/Element|element}.
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
 * Remove a css class from an
 * {@link https://developer.mozilla.org/en-US/docs/Web/API/Element|element}.
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
 * Create a
 * {@link https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement|canvas}.
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
 * Hide|show an
 * {@link https://developer.mozilla.org/en-US/docs/Web/API/Element|element}.
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
 * Swap the original srcset parameter of an
 * {@link https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement|image}.
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
        const oldsrc = domElement.oldsrc;
        domElement.oldsrc = domElement.src;
        domElement.src = oldsrc;
        domElement.srcset = domElement.oldsrcset;
    }
}
/**
 * Sets the {@link HAS_BACKGROUND_IMAGE} flag in an
 * {@link https://developer.mozilla.org/en-US/docs/Web/API/Element|element}
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
    handleStyleClasses(domElement, [], toggle, HAS_BACKGROUND_IMAGE)
}
/**
 * Add|remove a listener for load event in an
 * {@link https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement|image}.
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
 * {@link https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement|image}.
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
 * {@link https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement|image}.
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
        if (domElement.src.indexOf("=eyJ") != -1 ) {
            //Some images are protected by JWT tokens (like OWA attachments)
            //They need to be fetched first
            throw new Error("Fetch with token");
        }
        await filterImageElement(domElement, uuid, canvas);
    } catch (err) {
        //console.log(domElement.src);
        fetchAndReadImage(domElement.src).then(image => {
            filterImageElement(image, uuid, canvas);
        });
    }
}
/**
 * Process the bitmap of an
 * {@link https://developer.mozilla.org/en-US/docs/Web/API/Element|element}
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
      return chrome.runtime.sendMessage({ r: 'fetchAndReadImage', url: url }).then(response => {
            const image = new Image();
            image.crossOrigin = 'anonymous';
            image.src = response;

            return new Promise((resolve, reject) => {
                image.onload = () => resolve(image);
            })
        });
}
/**
 * Filter the bitmap in an
 * {@link https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement|image}.
 * and update the background-image attribute in the style of the
 * {@link https://developer.mozilla.org/en-US/docs/Web/API/Element|element}
 * identified with an uuid.
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
    const base64Img = await filterSkinColor(imgElement, uuid, canvas);
    const newBackgroundImgUrl = "url('" + base64Img + "')";
    const actualElement = findElementByUuid(document, uuid);

    if (actualElement) {
        actualElement.style.backgroundImage = newBackgroundImgUrl;
        if (suffix) {
            actualElement.style.backgroundImage += ", " + suffix;
        }
        actualElement[IS_PROCESSED] = true;
    }
}
/**
 * Filter the bitmap in an
 * {@link https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement|image}.
 * and update the src attribute in the
 * {@link https://developer.mozilla.org/en-US/docs/Web/API/Element|element}
 * identified with an uuid.
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
    const urlData = await filterSkinColor(imgElement, uuid, canvas)
    const actualElement = findElementByUuid(document, uuid);

    if (actualElement) {
        actualElement.src = urlData;
        actualElement.srcset = '';
        actualElement.onload = () => {
            removeCssClass(actualElement, CSS_CLASS_HIDE);
            actualElement.setAttribute(IS_PROCESSED, 'true');
            actualElement[IS_PROCESSED] = true;
            handleBackgroundForElement(actualElement, true);
        }
    }
}
/**
 * Find the
 * {@link https://developer.mozilla.org/en-US/docs/Web/API/Element|element}
 * in the corresponding
 * {@link https://developer.mozilla.org/en-US/docs/Web/API/Document|document}
 * by using element's uuid.
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
    let elements = doc.querySelectorAll('[' + ATTR_UUID + ']');
    elements = [...elements];

    elements = elements.filter((element) => {
        return element.getAttribute(ATTR_UUID) === uuid;
    });

    if (elements.length > 0) {
        return elements[0];
    }

    return null;
}
/**
 * Filter the pixels with skin color in the bitmap of an
 * {@link https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement|image}.
 *
 * @param {HTMLImageElement} imgElement
 * @param {string} uuid
 * @param {HTMLCanvasElement} canvas - Canvas to do the filtering.
 *
 * @returns {Promise} Base64 string encoding the filtered bitmap.
 *
 * @example
 * const element = document.getElementById('id');
 * const uuid = 'some-unique-identifier';
 * const canvas = document.getElementById('canvas-id');
 *
 * const base64Image = filterSkinColor(element, uuid, canvas);
 */
async function filterSkinColor(imgElement, uuid, canvas) {
    const { width, height } = imgElement;
    canvas.setAttribute('width', width);
    canvas.setAttribute('height', height);

    const context = canvas.getContext('2d', {willReadFrequently: true});
    context.drawImage(imgElement, 0, 0, imgElement.width, imgElement.height);

    const imageData = context.getImageData(0, 0, width, height);
    const rgbaArray = imageData.data;

    for (let i = 0; i < rgbaArray.length; i += 4) {
        const rIndex = i;
        const gIndex = i + 1;
        const bIndex = i + 2;
        const aIndex = i + 3;

        r = rgbaArray[rIndex];
        g = rgbaArray[gIndex];
        b = rgbaArray[bIndex];

        //Djamila Dahmani, Mehdi Cheref, Slimane Larabi, Zero-sum game theory model for segmenting skin regions
        //Image and Vision Computing, Volume 99, 2020, 103925,ISSN 0262-8856, https://doi.org/10.1016/j.imavis.2020.103925.

        //Convert to YCbCr
        const y = (0.299 * r) + (0.587 * g) + (0.114 * b);
        const cb = 128 + (-0.169 * r) + (-0.331 * g) + (0.5 * b);
        const cr = 128 + (0.5 * r) + (-0.419 * g) + (-0.081 * b);

        // Convert to HSV

        let rabs, gabs, babs, rr, gg, bb, h, s, v, diff, diffc, percentRoundFn;
        rabs = r / 255;
        gabs = g / 255;
        babs = b / 255;
        v = Math.max(rabs, gabs, babs),
        diff = v - Math.min(rabs, gabs, babs);
        diffc = c => (v - c) / 6 / diff + 1 / 2;
        percentRoundFn = num => Math.round(num * 100) / 100;
        if (diff == 0) {
            h = s = 0;
        } else {
            s = diff / v;
            rr = diffc(rabs);
            gg = diffc(gabs);
            bb = diffc(babs);

            if (rabs === v) {
                h = bb - gg;
            } else if (gabs === v) {
                h = (1 / 3) + rr - bb;
            } else if (babs === v) {
                h = (2 / 3) + gg - rr;
            }
            if (h < 0) {
                h += 1;
            }else if (h > 1) {
                h -= 1;
            }
        }

        h = Math.round(h * 360),
        s = percentRoundFn(s * 100),
        v = percentRoundFn(v * 100)

        if (
            (h >= 0) && (h <= 32) && (s >= 15) && //(s <= 85) && 
            (cb >= 85) && (cb <= 128) && (cr >= 142) && (cr < 180) &&
            (r > 95 && g > 40 && b > 20)
            //&&
            //(Math.max(r, g, b) - Math.min(r, g, b) > 15) &&
            //(Math.abs(r - g) > 15 && r > g && r > b)
        ) {
            rgbaArray[rIndex] = 127;
            rgbaArray[gIndex] = 127;
            rgbaArray[bIndex] = 127;
            rgbaArray[aIndex] = 255;
        }
    }

    imageData.data.set(rgbaArray);
    context.putImageData(imageData, 0, 0);
    base64Img = await canvasBlobify(canvas);
    return base64Img;
}

function canvasBlobify(canvas) {
    return new Promise ((resolve, reject) => {
        try {
            canvas.toBlob(function(blob){
                base64Img = URL.createObjectURL(blob);
                resolve(base64Img);
            },'image/png');
        } catch (error) {
            reject(error)
        }
        
    })
}
/**
 * Add a random uuid to an
 * {@link https://developer.mozilla.org/en-US/docs/Web/API/Element|element}.
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
 * Determine if a
 * {@link https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent|mouse event}
 * ocurred within the boundaries of a rectangle.
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