/**
 * Translate an element.
 *
 * Translate the element's text content and attributes. Some HTML markup is
 * allowed in the translation. The element's children with the data-l10n-name
 * attribute will be treated as arguments to the translation. If the
 * translation defines the same children, their attributes and text contents
 * will be used for translating the matching source child.
 *
 * @param   {Element} element
 * @param   {Object} translation
 * @private
 */
export default function translateElement(element: Element, translation: Object): void;
