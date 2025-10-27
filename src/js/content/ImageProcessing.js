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
function isSkinPixel(r, g, b, hue, saturation, cb, cr) {
    return hue >= HUE_MIN && hue <= HUE_MAX &&
           saturation >= SAT_MIN &&
           cb >= CB_MIN && cb <= CB_MAX &&
           cr >= CR_MIN && cr < CR_MAX &&
           (settings.isNoFaceFeatures || (r > 95 && g > 40 && b > 20));
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
    const fallbackSrc = imgElement && typeof imgElement.src === 'string' ? imgElement.src : null;

    if (!width || !height) {
        return fallbackSrc;
    }

    let shouldResetCanvas = false;

    try {
        canvas.width = width;
        canvas.height = height;

        const context = canvas.getContext('2d', { willReadFrequently: true });
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

            // Convert to YCbCr
            const { y: luminance, cb: blueChrominance, cr: redChrominance } = rgbToYCbCr(redValue, greenValue, blueValue);
            // Convert to HSV
            const { h: hue, s: saturation, v: value } = rgbToHsv(redValue, greenValue, blueValue);

            if (isSkinPixel(redValue, greenValue, blueValue, hue, saturation, blueChrominance, redChrominance)) {
                // Apply the selected filter color based on settings
                const filterColor = settings.filterColor || 'grey';

                switch (filterColor) {
                    case 'white':
                        pixelData[redIndex] = 255;
                        pixelData[greenIndex] = 255;
                        pixelData[blueIndex] = 255;
                        break;
                    case 'black':
                        pixelData[redIndex] = 0;
                        pixelData[greenIndex] = 0;
                        pixelData[blueIndex] = 0;
                        break;
                    case 'grey':
                    default:
                        pixelData[redIndex] = 127;
                        pixelData[greenIndex] = 127;
                        pixelData[blueIndex] = 127;
                        break;
                }

                pixelData[alphaIndex] = 255;
            }
        }

        context.putImageData(imageData, 0, 0);
        return await canvasBlobify(canvas);
    } catch (error) {
        shouldResetCanvas = true;
        console.warn('FitnaFilter: canvas filtering failed, falling back to original image', error);
        return fallbackSrc;
    } finally {
        if (shouldResetCanvas) {
            try {
                // Reset canvas to avoid leaving tainted state when filtering fails.
                canvas.width = 0;
                canvas.height = 0;
            } catch (cleanupError) {
                console.warn('FitnaFilter: failed to reset canvas after error', cleanupError);
            }
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
    // For now, this is just a passthrough to filterSkinColor
    // More processing steps will be added here later
    return filterSkinColor(imgElement, uuid, canvas);
}
