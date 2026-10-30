import { toast } from 'frappe-ui';

/**
 * Copy text to clipboard with fallback for non-secure or restricted environments.
 * @param {string} text
 * @returns {Promise<boolean>}
 */
export async function copyToClipboard(text) {
	if (!text) return false;

	// Modern navigator.clipboard API (requires HTTPS / localhost secure context)
	if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText && window.isSecureContext) {
		try {
			await navigator.clipboard.writeText(text);
			return true;
		} catch (err) {
			// Fall back to execCommand below
		}
	}

	// Fallback using document.execCommand('copy')
	try {
		const textArea = document.createElement('textarea');
		textArea.value = text;
		textArea.setAttribute('readonly', '');
		textArea.style.position = 'fixed';
		textArea.style.top = '0';
		textArea.style.left = '0';
		textArea.style.width = '2em';
		textArea.style.height = '2em';
		textArea.style.padding = '0';
		textArea.style.border = 'none';
		textArea.style.outline = 'none';
		textArea.style.boxShadow = 'none';
		textArea.style.background = 'transparent';
		textArea.style.opacity = '0';
		document.body.appendChild(textArea);
		textArea.focus();
		textArea.select();
		textArea.setSelectionRange(0, 99999);
		const successful = document.execCommand('copy');
		document.body.removeChild(textArea);
		return successful;
	} catch (err) {
		return false;
	}
}

/**
 * Share a URL using the native Web Share API where supported, or copy to clipboard fallback.
 * @param {Object} options
 * @param {string} options.title
 * @param {string} [options.text]
 * @param {string} options.url
 * @returns {Promise<{ shared?: boolean, copied?: boolean, cancelled?: boolean }>}
 */
export async function shareUrl({ title, text, url }) {
	const shareData = {
		title: title || 'Promot Wiki',
		url: url || window.location.href,
	};
	if (text) {
		shareData.text = text;
	}

	// Check if Web Share API is available and can share this data
	if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
		let canShare = true;
		if (typeof navigator.canShare === 'function') {
			try {
				canShare = navigator.canShare(shareData);
			} catch {
				canShare = true;
			}
		}

		if (canShare) {
			try {
				await navigator.share(shareData);
				return { shared: true };
			} catch (err) {
				if (err && (err.name === 'AbortError' || err.code === 20)) {
					// User cancelled/closed share sheet without picking a destination
					return { cancelled: true };
				}
				// Any other error falls through to clipboard fallback
			}
		}
	}

	// Clipboard fallback
	const copied = await copyToClipboard(shareData.url);
	if (copied) {
		return { copied: true };
	}

	throw new Error('Could not copy link to clipboard');
}

/**
 * Handle share action with user toast notifications.
 * @param {Object} options
 * @param {string} options.title
 * @param {string} [options.text]
 * @param {string} options.url
 */
export async function handleShare({ title, text, url }) {
	const _t = (msg) => (typeof __ === 'function' ? __(msg) : msg);
	try {
		const res = await shareUrl({ title, text, url });
		if (res.copied) {
			toast.success(_t('Link copied to clipboard'));
		}
	} catch (err) {
		toast.error(_t('Failed to copy link to clipboard'));
	}
}

/**
 * Build canonical URL for a Wiki Space.
 * @param {string} spaceId
 * @returns {string}
 */
export function getSpaceCanonicalUrl(spaceId) {
	if (!spaceId) return window.location.href;
	return `${window.location.origin}/wiki-app/spaces/${encodeURIComponent(spaceId)}`;
}

/**
 * Build canonical URL for an individual Wiki Document page.
 * @param {string} spaceId
 * @param {string} pageId
 * @param {Object} [options]
 * @param {Object} [options.query]
 * @param {string} [options.hash]
 * @returns {string}
 */
export function getPageCanonicalUrl(spaceId, pageId, options = {}) {
	if (!spaceId || !pageId) return window.location.href;
	const url = new URL(`${window.location.origin}/wiki-app/spaces/${encodeURIComponent(spaceId)}/page/${encodeURIComponent(pageId)}`);
	if (options.query && typeof options.query === 'object') {
		for (const [k, v] of Object.entries(options.query)) {
			if (v !== undefined && v !== null && v !== '') {
				url.searchParams.set(k, String(v));
			}
		}
	}
	if (options.hash) {
		url.hash = options.hash.startsWith('#') ? options.hash : `#${options.hash}`;
	}
	return url.toString();
}

/**
 * Build canonical URL for a Wiki Draft page.
 * @param {string} spaceId
 * @param {string} docKey
 * @param {Object} [options]
 * @param {Object} [options.query]
 * @param {string} [options.hash]
 * @returns {string}
 */
export function getDraftCanonicalUrl(spaceId, docKey, options = {}) {
	if (!spaceId || !docKey) return window.location.href;
	const url = new URL(`${window.location.origin}/wiki-app/spaces/${encodeURIComponent(spaceId)}/draft/${encodeURIComponent(docKey)}`);
	if (options.query && typeof options.query === 'object') {
		for (const [k, v] of Object.entries(options.query)) {
			if (v !== undefined && v !== null && v !== '') {
				url.searchParams.set(k, String(v));
			}
		}
	}
	if (options.hash) {
		url.hash = options.hash.startsWith('#') ? options.hash : `#${options.hash}`;
	}
	return url.toString();
}

