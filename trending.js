// ===========================================
// MEMERADAR - TRENDING TOKENS MODULE
// Default Dashboard View
// ===========================================

import { CONFIG } from './config.js';

/**
 * TrendingManager - Handles the trending/featured tokens view
 */
export class TrendingManager {
    constructor() {
        this.container = null;
        this.tokens = [];
        this.onTokenClick = null;
        this.cacheKey = 'memeradar_trending_cache';
        this.cacheTTL = 5 * 60 * 1000; // 5 minutes
    }

    /**
     * Initialize trending tokens section
     * @param {HTMLElement} container - Container element
     * @param {Function} onTokenClick - Callback when token is clicked
     */
    async init(container, onTokenClick) {
        this.container = container;
        this.onTokenClick = onTokenClick;
        await this.fetchTrending();
    }

    /**
     * Check if cache is valid
     */
    getCachedData() {
        try {
            const cached = localStorage.getItem(this.cacheKey);
            if (!cached) return null;

            const { data, timestamp } = JSON.parse(cached);
            if (Date.now() - timestamp > this.cacheTTL) {
                localStorage.removeItem(this.cacheKey);
                return null;
            }
            return data;
        } catch {
            return null;
        }
    }

    /**
     * Cache the data
     * @param {Array} data - Data to cache
     */
    setCachedData(data) {
        try {
            localStorage.setItem(this.cacheKey, JSON.stringify({
                data,
                timestamp: Date.now()
            }));
        } catch (e) {
            console.warn('Cache write failed:', e);
        }
    }

    /**
     * Fetch trending tokens
     */
    async fetchTrending() {
        // Check cache first
        const cached = this.getCachedData();
        if (cached && cached.length > 0) {
            this.tokens = cached;
            this.render();
            return;
        }

        try {
            // Use boosted tokens as trending indicator
            const response = await fetch(`${CONFIG.API.DEXSCREENER_BASE}/token-boosts/top/v1`);

            if (!response.ok) throw new Error('Failed to fetch trending');

            const data = await response.json();

            // Filter and format
            this.tokens = (data || [])
                .filter(item => item.chainId === 'solana')
                .slice(0, 6)
                .map(item => ({
                    address: item.tokenAddress,
                    name: item.description?.slice(0, 25) || 'Trending Token',
                    symbol: item.symbol || '🔥',
                    icon: item.icon || null,
                    chainId: item.chainId
                }));

            this.setCachedData(this.tokens);
            this.render();
        } catch (error) {
            console.error('Trending fetch error:', error);
            this.renderError();
        }
    }

    /**
     * Render trending tokens grid
     */
    render() {
        if (!this.container) return;

        if (this.tokens.length === 0) {
            this.renderError();
            return;
        }

        const html = `
            <div class="trending-header">
                <h3>🔥 Trending Now</h3>
                <span class="trending-subtitle">Click to analyze</span>
            </div>
            <div class="trending-grid">
                ${this.tokens.map(token => `
                    <div class="trending-card" data-address="${token.address}">
                        <div class="trending-icon">
                            ${token.icon ? `<img src="${token.icon}" alt="" onerror="this.parentElement.innerHTML='🪙'">` : '🪙'}
                        </div>
                        <div class="trending-info">
                            <div class="trending-name">${this.truncate(token.name, 18)}</div>
                            <div class="trending-address">${token.address.slice(0, 6)}...${token.address.slice(-4)}</div>
                        </div>
                        <div class="trending-arrow">→</div>
                    </div>
                `).join('')}
            </div>
        `;

        this.container.innerHTML = html;

        // Add click handlers
        this.container.querySelectorAll('.trending-card').forEach(card => {
            card.addEventListener('click', () => {
                const address = card.dataset.address;
                if (this.onTokenClick && address) {
                    this.onTokenClick(address);
                }
            });
        });
    }

    /**
     * Render error/empty state
     */
    renderError() {
        if (!this.container) return;

        this.container.innerHTML = `
            <div class="trending-header">
                <h3>🔥 Trending Now</h3>
            </div>
            <div class="trending-empty">
                <p>Enter a token address or ticker above to start analyzing</p>
            </div>
        `;
    }

    /**
     * Truncate text
     */
    truncate(text, length) {
        if (!text) return '';
        return text.length > length ? text.slice(0, length) + '...' : text;
    }

    /**
     * Show the trending section
     */
    show() {
        if (this.container) {
            this.container.style.display = 'block';
        }
    }

    /**
     * Hide the trending section
     */
    hide() {
        if (this.container) {
            this.container.style.display = 'none';
        }
    }
}

export default TrendingManager;
