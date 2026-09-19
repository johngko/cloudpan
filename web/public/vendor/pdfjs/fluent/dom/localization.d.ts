/**
 * The `Localization` class is a central high-level API for vanilla
 * JavaScript use of Fluent.
 * It combines language negotiation, FluentBundle and I/O to
 * provide a scriptable API to format translations.
 */
export default class Localization {
    /**
     * @param {Array<String>} resourceIds     - List of resource IDs
     * @param {Function}      generateBundles - Function that returns a
     *                                          generator over FluentBundles
     *
     * @returns {Localization}
     */
    constructor(resourceIds: Array<string> | undefined, generateBundles: Function);
    resourceIds: string[];
    generateBundles: Function;
    addResourceIds(resourceIds: any, eager?: boolean): number;
    removeResourceIds(resourceIds: any): number;
    /**
     * Format translations and handle fallback if needed.
     *
     * Format translations for `keys` from `FluentBundle` instances on this
     * DOMLocalization. In case of errors, fetch the next context in the
     * fallback chain.
     *
     * @param   {Array<Object>}         keys    - Translation keys to format.
     * @param   {Function}              method  - Formatting function.
     * @returns {Promise<Array<string|Object>>}
     * @private
     */
    private formatWithFallback;
    /**
     * Format translations into `{value, attributes}` objects.
     *
     * The fallback logic is the same as in `formatValues`
     * but it returns `{value, attributes}` objects
     * which are suitable for the translation of DOM elements.
     *
     * Returns a Promise resolving to an array of the translation strings.
     *
     * @example
     * ```js
     * docL10n.formatMessages([
     *   {id: 'hello', args: { who: 'Mary' }},
     *   {id: 'welcome'}
     * ]).then(console.log);
     *
     * // [
     * //   { value: 'Hello, Mary!', attributes: null },
     * //   {
     * //     value: 'Welcome!',
     * //     attributes: [ { name: "title", value: 'Hello' } ]
     * //   }
     * // ]
     * ```
     *
     * @param   {Array<Object>} keys
     * @returns {Promise<Array<{value: string, attributes: Object}>>}
     * @private
     */
    private formatMessages;
    /**
     * Retrieve translations corresponding to the passed keys.
     *
     * A generalized version of `DOMLocalization.formatValue`. Keys must
     * be `{id, args}` objects.
     *
     * Returns a Promise resolving to an array of the translation strings.
     *
     * @example
     * ```js
     * docL10n.formatValues([
     *   {id: 'hello', args: { who: 'Mary' }},
     *   {id: 'hello', args: { who: 'John' }},
     *   {id: 'welcome'}
     * ]).then(console.log);
     *
     * // ['Hello, Mary!', 'Hello, John!', 'Welcome!']
     * ```
     *
     * @param   {Array<Object>} keys
     * @returns {Promise<Array<string>>}
     */
    formatValues(keys: Array<Object>): Promise<Array<string>>;
    /**
     * Retrieve the translation corresponding to the `id` identifier.
     *
     * If passed, `args` is a simple hash object with a list of variables that
     * will be interpolated in the value of the translation.
     *
     * Returns a Promise resolving to the translation string.
     *
     * Use this sparingly for one-off messages which don't need to be
     * retranslated when the user changes their language preferences, e.g. in
     * notifications.
     *
     * @example
     * ```js
     * docL10n.formatValue(
     *   'hello', { who: 'world' }
     * ).then(console.log);
     *
     * // 'Hello, world!'
     * ```
     *
     * @param   {string}  id     - Identifier of the translation to format
     * @param   {Object}  [args] - Optional external arguments
     * @returns {Promise<string>}
     */
    formatValue(id: string, args?: Object): Promise<string>;
    handleEvent(): void;
    /**
     * This method should be called when there's a reason to believe
     * that language negotiation or available resources changed.
     */
    onChange(eager?: boolean): void;
    bundles: any;
}
