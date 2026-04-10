/**
 * Image processing functions for skin color filtering.
 * These functions were moved from domManipulation.js to separate image processing algorithms.
 */

'use strict';

const HUE_MIN = 0, HUE_MAX = 32;
const SAT_MIN = 15;
const CB_MIN = 85, CB_MAX = 128;
const CR_MIN = 142, CR_MAX = 180;

/**
 * Convert RGB to YCbCr color space.
 * @param {number} r - Red value (0-255)
 * @param {number} g - Green value (0-255)
 * @param {number} b - Blue value (0-255)
 * @returns {{y: number, cb: number, cr: number}} YCbCr values
 */
function rgbToYCbCr(r, g, b) {
    const y = (0.299 * r) + (0.587 * g) + (0.114 * b);
    const cb = 128 + (-0.169 * r) + (-0.331 * g) + (0.5 * b);
    const cr = 128 + (0.5 * r) + (-0.419 * g) + (-0.081 * b);
    
    return { y, cb, cr };
}

/**
 * Convert RGB to HSV color space.
 * Hue is represented in degrees (0-360), Saturation and Value as percentages (0-100).
 * @param {number} r - Red value (0-255)
 * @param {number} g - Green value (0-255)
 * @param {number} b - Blue value (0-255)
 * @returns {{h: number, s: number, v: number}} HSV values {h: 0-360, s: 0-100, v: 0-100}
 */
function rgbToHsv(r, g, b) {
    const redNormalized = r / 255;
    const greenNormalized = g / 255;
    const blueNormalized = b / 255;
    const maxValue = Math.max(redNormalized, greenNormalized, blueNormalized);
    const minValue = Math.min(redNormalized, greenNormalized, blueNormalized);
    const difference = maxValue - minValue;
    const calculateComponent = component => (maxValue - component) / 6 / difference + 1 / 2;
    const roundToPercent = num => Math.round(num * 100) / 100;

    if (difference === 0) {
        // Achromatic (gray) - hue and saturation are 0
        return { h: 0, s: 0, v: roundToPercent(maxValue * 100) };
    }

    const saturation = difference / maxValue;
    const redComponent = calculateComponent(redNormalized);
    const greenComponent = calculateComponent(greenNormalized);
    const blueComponent = calculateComponent(blueNormalized);

    let hue;
    if (redNormalized === maxValue) {
        hue = blueComponent - greenComponent;
    } else if (greenNormalized === maxValue) {
        hue = (1 / 3) + redComponent - blueComponent;
    } else if (blueNormalized === maxValue) {
        hue = (2 / 3) + greenComponent - redComponent;
    }

    // Ensure hue is within [0, 1) range before scaling to degrees
    if (hue < 0) {
        hue += 1;
    } else if (hue > 1) {
        hue -= 1;
    }

    return {
        h: Math.round(hue * 360),
        s: roundToPercent(saturation * 100),
        v: roundToPercent(maxValue * 100)
    };
}

/**
 * Determine whether a pixel is skin based on thresholds.
 * @param {number} r
 * @param {number} g
 * @param {number} b
 * @param {number} hue
 * @param {number} saturation
 * @param {number} cb
 * @param {number} cr
 * @returns {boolean}
 */
function isSkinPixel(r, g, b, hue, saturation, cb, cr, isNoFaceFeatures) {
    return hue >= HUE_MIN && hue <= HUE_MAX &&
           saturation >= SAT_MIN &&
           cb >= CB_MIN && cb <= CB_MAX &&
           cr >= CR_MIN && cr < CR_MAX &&
           (isNoFaceFeatures || (r > 95 && g > 40 && b > 20));
}

function getReplacementRgb(filterColor) {
    switch (filterColor) {
        case 'white':
            return { red: 255, green: 255, blue: 255 };
        case 'black':
            return { red: 0, green: 0, blue: 0 };
        case 'grey':
        default:
            return { red: 127, green: 127, blue: 127 };
    }
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
async function filterSkinColor(imgElement, uuid, canvas, filterColor, isNoFaceFeatures) {
    const { width, height } = imgElement;

    if (!width || !height) {
        throw new Error('Image has invalid dimensions');
    }

    const ownerDocument = (canvas && canvas.ownerDocument) ||
        (imgElement && imgElement.ownerDocument) ||
        document;
    const workingCanvas = ownerDocument.createElement('canvas');
    const normalizedFilterColor = filterColor || 'grey';
    const replacement = getReplacementRgb(normalizedFilterColor);
    const shouldRemoveFaceFeatures = !!isNoFaceFeatures;

    try {
        workingCanvas.width = width;
        workingCanvas.height = height;

        const context = workingCanvas.getContext('2d', { willReadFrequently: true });
        if (!context) {
            throw new Error('Canvas 2D context could not be created');
        }

        context.drawImage(imgElement, 0, 0, imgElement.width, imgElement.height);

        const imageData = context.getImageData(0, 0, width, height);
        const pixelData = imageData.data;

        for (let pixelIndex = 0; pixelIndex < pixelData.length; pixelIndex += 4) {
            const redIndex = pixelIndex;
            const greenIndex = pixelIndex + 1;
            const blueIndex = pixelIndex + 2;
            const alphaIndex = pixelIndex + 3;

            const redValue = pixelData[redIndex];
            const greenValue = pixelData[greenIndex];
            const blueValue = pixelData[blueIndex];

            //Djamila Dahmani, Mehdi Cheref, Slimane Larabi, Zero-sum game theory model for segmenting skin regions
            //Image and Vision Computing, Volume 99, 2020, 103925,ISSN 0262-8856, https://doi.org/10.1016/j.imavis.2020.103925.

            const { cb: blueChrominance, cr: redChrominance } = rgbToYCbCr(redValue, greenValue, blueValue);
            const { h: hue, s: saturation } = rgbToHsv(redValue, greenValue, blueValue);

            if (isSkinPixel(
                redValue,
                greenValue,
                blueValue,
                hue,
                saturation,
                blueChrominance,
                redChrominance,
                shouldRemoveFaceFeatures
            )) {
                pixelData[redIndex] = replacement.red;
                pixelData[greenIndex] = replacement.green;
                pixelData[blueIndex] = replacement.blue;
                pixelData[alphaIndex] = 255;
            }
        }

        context.putImageData(imageData, 0, 0);
        return await canvasBlobify(workingCanvas);
    } catch (error) {
        // TODO: Investigate whether we can detect/refetch cross-origin images earlier
        // so expected tainted-canvas failures do not spam the console first.
        console.warn('FitnaFilter: canvas filtering failed', error);
        throw error;
    } finally {
        try {
            workingCanvas.width = 0;
            workingCanvas.height = 0;
        } catch (cleanupError) {
            console.warn('FitnaFilter: failed to reset canvas after processing', cleanupError);
        }
    }
}

/**
 * Convert a canvas to a blob URL
 * 
 * @param {HTMLCanvasElement} canvas - The canvas element to convert
 * @returns {Promise<string>} - Promise resolving to the blob URL
 */
function canvasBlobify(canvas) {
    return new Promise((resolve, reject) => {
        try {
            canvas.toBlob(function(blob){
                if (!blob) {
                    reject(new Error('Canvas toBlob returned null'));
                    return;
                }
                const blobUrl = URL.createObjectURL(blob);
                resolve(blobUrl);
            }, 'image/png');
        } catch (error) {
            reject(error);
        }
    });
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
    const filterColor = settings && settings.filterColor ? settings.filterColor : 'grey';
    const isNoFaceFeatures = !!(settings && settings.isNoFaceFeatures);
    return filterSkinColor(imgElement, uuid, canvas, filterColor, isNoFaceFeatures);
}
