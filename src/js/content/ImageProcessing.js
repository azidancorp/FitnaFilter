/**
 * Image processing functions for skin color filtering.
 * These functions were moved from domManipulation.js to separate image processing algorithms.
 */

'use strict';

const HUE_MIN = 0, HUE_MAX = 38;
const SAT_MIN = 15;
const CB_MIN = 85, CB_MAX = 128;
const CR_MIN = 142, CR_MAX = 180;

const HIGHLIGHT_HUE_MIN = 18, HIGHLIGHT_HUE_MAX = 42;
const HIGHLIGHT_SAT_MIN = 8, HIGHLIGHT_SAT_MAX = 30;
const HIGHLIGHT_Y_MIN = 200;
const HIGHLIGHT_CB_MIN = 105, HIGHLIGHT_CB_MAX = 125;
const HIGHLIGHT_CR_MIN = 132, HIGHLIGHT_CR_MAX = 146;
const HIGHLIGHT_RED_MIN = 221;
const HIGHLIGHT_GREEN_MIN = 190;
const HIGHLIGHT_BLUE_MIN = 160;
const HIGHLIGHT_CHANNEL_TOLERANCE = 4;
const HIGHLIGHT_RED_BLUE_GAP_MIN = 20;
const HIGHLIGHT_RED_GREEN_GAP_MAX = 36;

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
 * @param {number} y
 * @param {number} cb
 * @param {number} cr
 * @returns {boolean}
 */
function isSkinPixel(r, g, b, hue, saturation, y, cb, cr, isNoFaceFeatures) {
    const hasSkinRgbBaseline = isNoFaceFeatures || (r > 95 && g > 40 && b > 20);
    if (!hasSkinRgbBaseline) {
        return false;
    }

    const isStandardSkinTone =
        hue >= HUE_MIN && hue <= HUE_MAX &&
        saturation >= SAT_MIN &&
        cb >= CB_MIN && cb <= CB_MAX &&
        cr >= CR_MIN && cr < CR_MAX;

    const isBrightWarmHighlight =
        y >= HIGHLIGHT_Y_MIN &&
        hue >= HIGHLIGHT_HUE_MIN && hue <= HIGHLIGHT_HUE_MAX &&
        saturation >= HIGHLIGHT_SAT_MIN && saturation <= HIGHLIGHT_SAT_MAX &&
        cb >= HIGHLIGHT_CB_MIN && cb <= HIGHLIGHT_CB_MAX &&
        cr >= HIGHLIGHT_CR_MIN && cr <= HIGHLIGHT_CR_MAX &&
        r >= HIGHLIGHT_RED_MIN &&
        g >= HIGHLIGHT_GREEN_MIN &&
        b >= HIGHLIGHT_BLUE_MIN &&
        r >= g - HIGHLIGHT_CHANNEL_TOLERANCE &&
        g >= b &&
        r - b >= HIGHLIGHT_RED_BLUE_GAP_MIN &&
        r - g <= HIGHLIGHT_RED_GREEN_GAP_MAX;

    return isStandardSkinTone || isBrightWarmHighlight;
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
    const width = imgElement.naturalWidth || imgElement.width;
    const height = imgElement.naturalHeight || imgElement.height;

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

        if (typeof imgElement.decode === 'function' && imgElement.complete) {
            await imgElement.decode();
        }

        context.drawImage(imgElement, 0, 0, width, height);

        const imageData = context.getImageData(0, 0, width, height);
        const pixelData = imageData.data;
        const replacementRed = replacement.red;
        const replacementGreen = replacement.green;
        const replacementBlue = replacement.blue;
        let sourceOpaquePixels = 0;

        // Skin classification reference: Djamila Dahmani, Mehdi Cheref, Slimane Larabi,
        // "Zero-sum game theory model for segmenting skin regions," Image and Vision Computing,
        // Volume 99, 2020, 103925. https://doi.org/10.1016/j.imavis.2020.103925.
        // Math is inlined and gated by cheap RGB/YCbCr early-exits before HSV to avoid per-pixel
        // object allocation in this hot loop (~4M pixels for a 1080p image).
        for (let pixelIndex = 0; pixelIndex < pixelData.length; pixelIndex += 4) {
            const r = pixelData[pixelIndex];
            const g = pixelData[pixelIndex + 1];
            const b = pixelData[pixelIndex + 2];
            const a = pixelData[pixelIndex + 3];

            if (a > 0) {
                sourceOpaquePixels++;
            }

            if (!shouldRemoveFaceFeatures && !(r > 95 && g > 40 && b > 20)) {
                continue;
            }

            const cb = 128 + (-0.169 * r) + (-0.331 * g) + (0.5 * b);
            const cr = 128 + (0.5 * r) + (-0.419 * g) + (-0.081 * b);

            const inStandardCbCr =
                cb >= CB_MIN && cb <= CB_MAX &&
                cr >= CR_MIN && cr < CR_MAX;
            const inHighlightCbCr =
                cb >= HIGHLIGHT_CB_MIN && cb <= HIGHLIGHT_CB_MAX &&
                cr >= HIGHLIGHT_CR_MIN && cr <= HIGHLIGHT_CR_MAX;

            if (!inStandardCbCr && !inHighlightCbCr) {
                continue;
            }

            const luminance = (0.299 * r) + (0.587 * g) + (0.114 * b);
            const highlightCandidate =
                inHighlightCbCr &&
                luminance >= HIGHLIGHT_Y_MIN &&
                r >= HIGHLIGHT_RED_MIN &&
                g >= HIGHLIGHT_GREEN_MIN &&
                b >= HIGHLIGHT_BLUE_MIN &&
                r >= g - HIGHLIGHT_CHANNEL_TOLERANCE &&
                g >= b &&
                r - b >= HIGHLIGHT_RED_BLUE_GAP_MIN &&
                r - g <= HIGHLIGHT_RED_GREEN_GAP_MAX;

            if (!inStandardCbCr && !highlightCandidate) {
                continue;
            }

            const redNormalized = r / 255;
            const greenNormalized = g / 255;
            const blueNormalized = b / 255;
            const maxValue = redNormalized > greenNormalized
                ? (redNormalized > blueNormalized ? redNormalized : blueNormalized)
                : (greenNormalized > blueNormalized ? greenNormalized : blueNormalized);
            const minValue = redNormalized < greenNormalized
                ? (redNormalized < blueNormalized ? redNormalized : blueNormalized)
                : (greenNormalized < blueNormalized ? greenNormalized : blueNormalized);
            const difference = maxValue - minValue;

            let hue;
            let saturation;
            if (difference === 0) {
                hue = 0;
                saturation = 0;
            } else {
                saturation = Math.round((difference / maxValue) * 100 * 100) / 100;
                let hueFraction;
                if (redNormalized === maxValue) {
                    hueFraction = ((maxValue - blueNormalized) - (maxValue - greenNormalized)) / 6 / difference;
                } else if (greenNormalized === maxValue) {
                    hueFraction = (1 / 3) + ((maxValue - redNormalized) - (maxValue - blueNormalized)) / 6 / difference;
                } else {
                    hueFraction = (2 / 3) + ((maxValue - greenNormalized) - (maxValue - redNormalized)) / 6 / difference;
                }
                if (hueFraction < 0) {
                    hueFraction += 1;
                } else if (hueFraction > 1) {
                    hueFraction -= 1;
                }
                hue = Math.round(hueFraction * 360);
            }

            const isStandardSkinTone =
                inStandardCbCr &&
                hue >= HUE_MIN && hue <= HUE_MAX &&
                saturation >= SAT_MIN;
            const isBrightWarmHighlight =
                highlightCandidate &&
                hue >= HIGHLIGHT_HUE_MIN && hue <= HIGHLIGHT_HUE_MAX &&
                saturation >= HIGHLIGHT_SAT_MIN && saturation <= HIGHLIGHT_SAT_MAX;

            if (isStandardSkinTone || isBrightWarmHighlight) {
                pixelData[pixelIndex] = replacementRed;
                pixelData[pixelIndex + 1] = replacementGreen;
                pixelData[pixelIndex + 2] = replacementBlue;
                pixelData[pixelIndex + 3] = 255;
            }
        }

        if (sourceOpaquePixels === 0) {
            throw new Error('Canvas draw produced a transparent image');
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
