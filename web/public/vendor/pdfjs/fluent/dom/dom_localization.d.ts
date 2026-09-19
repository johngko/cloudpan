/**
 * The `DOMLocalization` class is responsible for fetching resources and
 * formatting translations.
 *
 * It implements the fallback strategy in case of errors encountered during the
 * formatting of translations and methods for observing DOM
 * trees with a `MutationObserver`.
 */
export default class DOMLocalization extends Localization {
    /**
     * @param {Array<String>}    resourceIds     - List of resource IDs
     * @param {Function}         generateBundles - Function that returns a
     *                                             generator over FluentBundles
     * @returns {DOMLocalization}
     */
    constructor(resourceIds: Array<string>, generateBundles: Function);
    roots: Set<any>;
    pendingrAF: any;
    pendingElements: Set<any>;
    windowElement: (Window & typeof globalThis) | null;
    mutationObserver: MutationObserver | null;
    observerConfig: {
        attributes: boolean;
        characterData: boolean;
        childList: boolean;
        subtree: boolean;
        attributeFilter: string[];
    };
    /**
     * Set the `data-l10n-id` and `data-l10n-args` attributes on DOM elements.
     * FluentDOM makes use of mutation observers to detect changes
     * to `data-l10n-*` attributes and translate elements asynchronously.
     * `setAttributes` is a convenience method which allows to translate
     * DOM elements declaratively.
     *
     * You should always prefer to use `data-l10n-id` on elements (statically in
     * HTML or dynamically via `setAttributes`) over manually retrieving
     * translations with `format`.  The use of attributes ensures that the
     * elements can be retranslated when the user changes their language
     * preferences.
     *
     * ```javascript
     * localization.setAttributes(
     *   document.querySelector('#welcome'), 'hello', { who: 'world' }
     * );
     * ```
     *
     * This will set the following attributes on the `#welcome` element.
     * The MutationObserver will pick up this change and will localize the element
     * asynchronously.
     *
     * ```html
     * <p id='welcome'
     *   data-l10n-id='hello'
     *   data-l10n-args='{"who": "world"}'>
     * </p>
     * ```
     *
     * @param {Element}                element - Element to set attributes on
     * @param {string}                 id      - l10n-id string
     * @param {Object<string, string>} args    - KVP list of l10n arguments
     * @returns {Element}
     */
    setAttributes(element: Element, id: string, args: {
        [x: string]: string;
    }): Element;
    /**
     * Get the `data-l10n-*` attributes from DOM elements.
     *
     * ```javascript
     * localization.getAttributes(
     *   document.querySelector('#welcome')
     * );
     * // -> { id: 'hello', args: { who: 'world' } }
     * ```
     *
     * @param   {Element}  element - HTML element
     * @returns {{id: string, args: Object}}
     */
    getAttributes(element: Element): {
        id: string;
        args: Object;
    };
    /**
     * Add `newRoot` to the list of roots managed by this `DOMLocalization`.
     *
     * Additionally, if this `DOMLocalization` has an observer, start observing
     * `newRoot` in order to translate mutations in it.
     *
     * @param {Element | DocumentFragment}      newRoot - Root to observe.
     */
    connectRoot(newRoot: Element | DocumentFragment): void;
    /**
     * Remove `root` from the list of roots managed by this `DOMLocalization`.
     *
     * Additionally, if this `DOMLocalization` has an observer, stop observing
     * `root`.
     *
     * Returns `true` if the root was the last one managed by this
     * `DOMLocalization`.
     *
     * @param   {Element | DocumentFragment} root - Root to disconnect.
     * @returns {boolean}
     */
    disconnectRoot(root: Element | DocumentFragment): boolean;
    /**
     * Translate all roots associated with this `DOMLocalization`.
     *
     * @returns {Promise}
     */
    translateRoots(): Promise<any>;
    /**
     * Pauses the `MutationObserver`.
     */
    pauseObserving(): void;
    /**
     * Resumes the `MutationObserver`.
     */
    resumeObserving(): void;
    /**
     * Translate mutations detected by the `MutationObserver`.
     *
     * @private
     */
    private translateMutations;
    /**
     * Translate a DOM element or fragment asynchronously using this
     * `DOMLocalization` object.
     *
     * Manually trigger the translation (or re-translation) of a DOM fragment.
     * Use the `data-l10n-id` and `data-l10n-args` attributes to mark up the DOM
     * with information about which translations to use.
     *
     * Returns a `Promise` that gets resolved once the translation is complete.
     *
     * @param   {Element | DocumentFragment} frag - Element or DocumentFragment to be translated
     * @returns {Promise}
     */
    translateFragment(frag: Element | DocumentFragment): Promise<any>;
    /**
     * Translate a list of DOM elements asynchronously using this
     * `DOMLocalization` object.
     *
     * Manually trigger the translation (or re-translation) of a list of elements.
     * Use the `data-l10n-id` and `data-l10n-args` attributes to mark up the DOM
     * with information about which translations to use.
     *
     * Returns a `Promise` that gets resolved once the translation is complete.
     *
     * @param   {Array<Element>} elements - List of elements to be translated
     * @returns {Promise}
     */
    translateElements(elements: Array<Element>): Promise<any>;
    /**
     * Applies translations onto elements.
     *
     * @param {Array<Element>} elements
     * @param {Array<Object>}  translations
     * @private
     */
    private applyTranslations;
    /**
     * Collects all translatable child elements of the element.
     *
     * @param {Element | DocumentFragment} element
     * @returns {Array<Element>}
     * @private
     */
    private getTranslatables;
    /**
     * Get the `data-l10n-*` attributes from DOM elements as a two-element
     * array.
     *
     * @param {Element} element
     * @returns {Object}
     * @private
     */
    private getKeysForElement;
}
import Localization from "./localization.js";
