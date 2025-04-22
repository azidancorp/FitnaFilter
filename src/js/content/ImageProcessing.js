/**
 * Image processing functions for skin color filtering.
 * These functions were moved from domManipulation.js to separate image processing algorithms.
 */



/**
 * Convert RGB to HSV color space
 * @param {number} r - Red value (0-255)
 * @param {number} g - Green value (0-255)
 * @param {number} b - Blue value (0-255)
 * @returns {Object} HSV values {h, s, v}
 */
function rgbToHsv(r, g, b) {
    let rabs = r / 255;
    let gabs = g / 255;
    let babs = b / 255;
    let v = Math.max(rabs, gabs, babs);
    let diff = v - Math.min(rabs, gabs, babs);
    let diffc = c => (v - c) / 6 / diff + 1 / 2;
    let percentRoundFn = num => Math.round(num * 100) / 100;

    if (diff === 0) {
        return { h: 0, s: 0, v: percentRoundFn(v * 100) };
    }

    let s = diff / v;
    let rr = diffc(rabs);
    let gg = diffc(gabs);
    let bb = diffc(babs);

    let h;
    if (rabs === v) {
        h = bb - gg;
    } else if (gabs === v) {
        h = (1 / 3) + rr - bb;
    } else if (babs === v) {
        h = (2 / 3) + gg - rr;
    }

    if (h < 0) {
        h += 1;
    } else if (h > 1) {
        h -= 1;
    }

    return {
        h: Math.round(h * 360),
        s: percentRoundFn(s * 100),
        v: percentRoundFn(v * 100)
    };
}

/**
 * Filter the pixels with skin color in the bitmap of an HTMLImageElement.
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

        const r = rgbaArray[rIndex];
        const g = rgbaArray[gIndex];
        const b = rgbaArray[bIndex];

        //Djamila Dahmani, Mehdi Cheref, Slimane Larabi, Zero-sum game theory model for segmenting skin regions
        //Image and Vision Computing, Volume 99, 2020, 103925,ISSN 0262-8856, https://doi.org/10.1016/j.imavis.2020.103925.

        //Convert to YCbCr
        const y = (0.299 * r) + (0.587 * g) + (0.114 * b);
        const cb = 128 + (-0.169 * r) + (-0.331 * g) + (0.5 * b);
        const cr = 128 + (0.5 * r) + (-0.419 * g) + (-0.081 * b);

        // Convert to HSV
        const { h, s, v } = rgbToHsv(r, g, b);

        if (
            (h >= 0) && (h <= 32) && (s >= 15) && 
            (cb >= 85) && (cb <= 128) && (cr >= 142) && (cr < 180) &&
            (settings.isNoFaceFeatures || (r > 95 && g > 40 && b > 20))
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

/**
 * Convert a canvas to a blob URL
 * 
 * @param {HTMLCanvasElement} canvas - The canvas element to convert
 * @returns {Promise<string>} - Promise resolving to the blob URL
 */
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
 * Process an image by applying various filters. Currently just calls filterSkinColor.
 * This function will be expanded in the future to add more processing steps.
 *
 * @param {HTMLImageElement} imgElement - The image element to process
 * @param {string} uuid - Unique identifier for the image
 * @param {HTMLCanvasElement} canvas - Canvas to do the filtering
 *
 * @returns {Promise} Base64 string encoding the filtered bitmap
 *
 * @example
 * const element = document.getElementById('id');
 * const uuid = 'some-unique-identifier';
 * const canvas = document.getElementById('canvas-id');
 *
 * const base64Image = applyImageFilters(element, uuid, canvas);
 */
async function applyImageFilters(imgElement, uuid, canvas) {
    // For now, this is just a passthrough to filterSkinColor
    // More processing steps will be added here later
    return await filterSkinColor(imgElement, uuid, canvas);
}