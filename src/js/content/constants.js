'use strict';

/**
 * Identifier for the global HTMLCanvasElement to process and gray out webpage images.
 */
const CANVAS_GLOBAL_ID = 'skf-canvas-global';

/**
 * Attribute to set a UUID for an Element to be processed. This attribute is set in the html tag.
 */
const ATTR_UUID = 'skf-uuid';

/**
 * Attribute to set the bounding rectangle of an Element. This attribute is set in the html tag.
 */
const ATTR_RECTANGLE = 'skf-rectangle';

/**
 * Attribute to keep track of blob URLs assigned to inline images.
 */
const ATTR_OBJECT_URL = 'skf-object-url';

/**
 * Attribute to keep track of blob URLs assigned to background images.
 */
const ATTR_BACKGROUND_OBJECT_URL = 'skf-background-object-url';

/**
 * Attribute to store the original background-image value before FitnaFilter overrides it.
 */
const ATTR_ORIGINAL_BACKGROUND_IMAGE = 'skf-original-background-image';

/**
 * Attribute to store an image element's original src before it is filtered.
 */
const ATTR_ORIGINAL_SRC = 'skf-original-src';

/**
 * Attribute to store an image element's original srcset before it is filtered.
 */
const ATTR_ORIGINAL_SRCSET = 'skf-original-srcset';

/**
 * Property that stores the active placeholder overlay for an image.
 */
const ATTR_PLACEHOLDER_ELEMENT = 'skf-placeholder-element';

/**
 * Property that stores the placeholder overlay container for an image.
 */
const ATTR_PLACEHOLDER_CONTAINER = 'skf-placeholder-container';

/**
 * Property that stores the placeholder container's original inline position.
 */
const ATTR_PLACEHOLDER_CONTAINER_POSITION = 'skf-placeholder-container-position';

/**
 * Attribute to set the background-image value of an Element's CSS style. This attribute is set in the html tag.
 */
const ATTR_LAST_CHECKED_SRC = 'skf-last-checked-src';

/**
 * Flag to determine if an Element has been hidden. This flag is set in the javascript object.
 */
const IS_HIDDEN = 'skf-is-hidden';

/**
 * Flag to determine if an HTMLImageElement's src attribute has been toggled. This flag is set in the javascript object.
 */
const IS_TOGGLED = 'skf-is-toggled';

/**
 * Flag to determine if an Element has been processed for skin color filtering. This flag is set in the javascript object as well as in the html tag.
 */
const IS_PROCESSED = 'skf-is-processed';

/**
 * Flag to determine if an Element is currently showing its original unfiltered image. This flag is set in the javascript object.
 */
const IS_REVEALED = 'skf-is-revealed';

/**
 * Counter used to ignore source mutations triggered by FitnaFilter itself.
 */
const ATTR_IGNORE_SOURCE_MUTATIONS = 'skf-ignore-source-mutations';

/**
 * Counter used to ignore background-image mutations triggered by FitnaFilter itself.
 */
const ATTR_IGNORE_BACKGROUND_MUTATIONS = 'skf-ignore-background-mutations';

/**
 * Flag used when the mouse pointer is hovering over an Element. This flag is set in the javascript object.
 */
const HAS_HOVER = 'skf-has-hover';

/**
 * Flag to determine if the show icon should be displayed on an Element. This flag is set in the javascript object.
 */
const HAS_HOVER_VISUAL = 'skf-has-hover-visual';

/**
 * Flag to determine if an Element has a load event listener. This flag is set in the javascript object.
 */
const HAS_LOAD_LISTENER = 'skf-has-load-listener';

/**
 * Flag to determine if an Element has an error event listener. This flag is set in the javascript object.
 */
const HAS_ERROR_LISTENER = 'skf-has-error-listener';

/**
 * Flag to determine if an Element has a load event listener for skin filtering. This flag is set in the javascript object.
 */
const HAS_PROCESS_IMAGE_LISTENER = 'skf-has-process-image-listener';

/**
 * Flag to determine if an Element has mouse event listeners. This flag is set in the javascript object.
 */
const HAS_MOUSE_LISTENERS = 'skf-has-mouse-listeners';

/**
 * Flag to determine if an HTMLImageElement has title and size attributes. This flag is set in the javascript object.
 */
const HAS_TITLE_AND_SIZE = 'skf-has-title-and-size';

/**
 * Flag to determine if an Element has a CSS class defining a background image. This flag is set in the javascript object.
 */
const HAS_BACKGROUND_IMAGE = 'skf-has-background-image';

/**
 * Attribute to set a timeout for positioning the show icon. This flag is set in the javascript object.
 */
const ATTR_CLEAR_HOVER_VISUAL_TIMER = 'skf-clear-hover-visual-timer';

/**
 * CSS class name to hide an Element.
 */
const CSS_CLASS_HIDE = 'skf-hide';

/**
 * CSS class name for the neutral loading placeholder overlay.
 */
const CSS_CLASS_PLACEHOLDER = 'skf-placeholder';

const IMAGE_DISPLAY_MODE_STRICT = 'strict';
const IMAGE_DISPLAY_MODE_PLACEHOLDER = 'placeholder';
const IMAGE_DISPLAY_MODE_PROGRESSIVE = 'progressive';
