// ===========================================
// MEMERADAR - URL ROUTER MODULE
// Deep Linking & Shareable URLs
// ===========================================

/**
 * URLRouter - Handles deep linking and URL state management
 */
export class URLRouter {
    constructor() {
        this.baseTitle = 'MemeRadar | Professional Memecoin Analyzer';
    }

    /**
     * Initialize the router
     * @param {Function} onTokenLoad - Callback to analyze a token
     */
    init(onTokenLoad) {
        this.onTokenLoad = onTokenLoad;

        // Check URL on load - use multiple strategies to ensure it works
        if (document.readyState === 'complete') {
            this.checkInitialRoute();
        } else {
            window.addEventListener('load', () => {
                this.checkInitialRoute();
            });
        }

        // Handle back/forward browser navigation
        window.addEventListener('popstate', (event) => {
            if (event.state?.token) {
                this.onTokenLoad(event.state.token);
            }
        });

        // Also check hash changes
        window.addEventListener('hashchange', () => {
            const hash = window.location.hash;
            if (hash) {
                const hashClean = hash.replace('#', '').replace('token=', '');
                if (hashClean.length >= 32 && this.onTokenLoad) {
                    this.onTokenLoad(hashClean);
                }
            }
        });
    }

    /**
     * Check if URL contains a token to analyze on page load
     */
    checkInitialRoute() {
        const path = window.location.pathname;
        const hash = window.location.hash;

        console.log('[Router] Checking initial route:', { path, hash });

        // Check path format: /token/ADDRESS
        const pathMatch = path.match(/\/token\/([a-zA-Z0-9]+)/);
        if (pathMatch && pathMatch[1]) {
            console.log('[Router] Found token in path:', pathMatch[1]);
            setTimeout(() => {
                if (this.onTokenLoad) {
                    this.onTokenLoad(pathMatch[1]);
                }
            }, 300);
            return;
        }

        // Check hash format: #ADDRESS or #token=ADDRESS
        if (hash && hash.length > 1) {
            const hashClean = hash.replace('#', '').replace('token=', '');
            console.log('[Router] Found hash:', hashClean, 'Length:', hashClean.length);
            if (hashClean.length >= 32) {
                console.log('[Router] Triggering token load from hash');
                setTimeout(() => {
                    if (this.onTokenLoad) {
                        this.onTokenLoad(hashClean);
                    }
                }, 300);
                return;
            }
        }

        // Check query params: ?token=ADDRESS
        const params = new URLSearchParams(window.location.search);
        const tokenParam = params.get('token') || params.get('address') || params.get('ca');
        if (tokenParam && tokenParam.length >= 32) {
            console.log('[Router] Found token in query params:', tokenParam);
            setTimeout(() => {
                if (this.onTokenLoad) {
                    this.onTokenLoad(tokenParam);
                }
            }, 300);
        }
    }

    /**
     * Update URL when a token is analyzed
     * @param {string} tokenAddress - Token contract address
     * @param {string} tokenName - Token name for title
     * @param {string} tokenSymbol - Token symbol
     */
    updateURL(tokenAddress, tokenName, tokenSymbol) {
        if (!tokenAddress) return;

        // Use hash-based routing for static hosting compatibility
        const newURL = `${window.location.origin}${window.location.pathname}#${tokenAddress}`;

        // Update page title
        const newTitle = tokenSymbol
            ? `$${tokenSymbol} Analysis | MemeRadar`
            : this.baseTitle;

        document.title = newTitle;

        // Update URL without page reload
        window.history.pushState(
            { token: tokenAddress, name: tokenName },
            newTitle,
            newURL
        );

        // Update meta tags for social sharing
        this.updateMetaTags(tokenAddress, tokenName, tokenSymbol);
    }

    /**
     * Update meta tags for social sharing
     * @param {string} tokenAddress - Token address
     * @param {string} tokenName - Token name
     * @param {string} tokenSymbol - Token symbol
     */
    updateMetaTags(tokenAddress, tokenName, tokenSymbol) {
        // Update Open Graph tags
        this.updateMetaTag('og:title', `$${tokenSymbol || 'Token'} Analysis | MemeRadar`);
        this.updateMetaTag('og:description', `AI-powered analysis of ${tokenName || 'this memecoin'}. Risk score, momentum, and verdict.`);
        this.updateMetaTag('og:url', window.location.href);

        // Twitter card
        this.updateMetaTag('twitter:title', `$${tokenSymbol || 'Token'} Analysis | MemeRadar`);
        this.updateMetaTag('twitter:description', `Check out the MemeRadar AI verdict on ${tokenName || 'this token'}!`);
    }

    /**
     * Update or create a meta tag
     * @param {string} property - Meta property name
     * @param {string} content - Meta content value
     */
    updateMetaTag(property, content) {
        let meta = document.querySelector(`meta[property="${property}"]`) ||
            document.querySelector(`meta[name="${property}"]`);

        if (!meta) {
            meta = document.createElement('meta');
            meta.setAttribute(property.startsWith('og:') ? 'property' : 'name', property);
            document.head.appendChild(meta);
        }

        meta.setAttribute('content', content);
    }

    /**
     * Get shareable link for current token
     * @returns {string} - Shareable URL
     */
    getShareableLink() {
        return window.location.href;
    }

    /**
     * Copy share link to clipboard
     * @returns {Promise<boolean>} - Success status
     */
    async copyShareLink() {
        try {
            await navigator.clipboard.writeText(this.getShareableLink());
            return true;
        } catch (error) {
            console.error('Copy failed:', error);
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = this.getShareableLink();
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            return true;
        }
    }

    /**
     * Reset URL to base state
     */
    resetURL() {
        document.title = this.baseTitle;
        window.history.pushState({}, this.baseTitle, window.location.pathname);
    }
}

export default URLRouter;
