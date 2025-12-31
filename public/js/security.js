/**
 * Security utilities for XSS protection
 */

/**
 * Escapes HTML special characters to prevent XSS attacks
 * @param {string} unsafe - Potentially unsafe string from user input
 * @returns {string} - Sanitized string safe for HTML insertion
 */
export function escapeHtml(unsafe) {
    if (unsafe === null || unsafe === undefined) return '';
    return String(unsafe)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/**
 * Sanitizes an object's string properties recursively
 * Useful for sanitizing entire data objects before rendering
 * @param {Object} obj - Object to sanitize
 * @param {Array<string>} skipKeys - Keys to skip (e.g., 'content' for rich text)
 * @returns {Object} - Sanitized object
 */
export function sanitizeObject(obj, skipKeys = []) {
    if (!obj || typeof obj !== 'object') return obj;

    const sanitized = Array.isArray(obj) ? [] : {};

    for (const key in obj) {
        if (skipKeys.includes(key)) {
            sanitized[key] = obj[key]; // Keep as-is for rich content
        } else if (typeof obj[key] === 'string') {
            sanitized[key] = escapeHtml(obj[key]);
        } else if (typeof obj[key] === 'object') {
            sanitized[key] = sanitizeObject(obj[key], skipKeys);
        } else {
            sanitized[key] = obj[key];
        }
    }

    return sanitized;
}

/**
 * Creates a text node safely (alternative to innerHTML)
 * @param {string} text - Text to display
 * @returns {Text} - DOM text node
 */
export function createTextNode(text) {
    return document.createTextNode(text || '');
}

/**
 * Sets text content safely on an element
 * @param {HTMLElement} element - Target element
 * @param {string} text - Text to set
 */
export function setTextSafe(element, text) {
    if (element) {
        element.textContent = text || '';
    }
}

/**
 * Validates and sanitizes URL to prevent javascript: protocol attacks
 * @param {string} url - URL to validate
 * @returns {string} - Safe URL or empty string
 */
export function sanitizeUrl(url) {
    if (!url) return '';
    const urlStr = String(url).trim().toLowerCase();

    // Block dangerous protocols
    if (urlStr.startsWith('javascript:') ||
        urlStr.startsWith('data:') ||
        urlStr.startsWith('vbscript:')) {
        return '';
    }

    return url;
}

/**
 * Sanitizes HTML attributes
 * @param {string} attr - Attribute value
 * @returns {string} - Sanitized attribute
 */
export function sanitizeAttribute(attr) {
    if (!attr) return '';
    return String(attr)
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}
