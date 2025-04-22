/**
 * Image processing functions for skin color filtering.
 * These functions were moved from domManipulation.js to separate image processing algorithms.
 */

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
            (settings.isNoFaceFeatures || (r > 95 && g > 40 && b > 20))
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