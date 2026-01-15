// ===========================================
// MEMERADAR - FRESH PAIRS MODULE
// Live Feed of New Solana Pools
// ===========================================

import { CONFIG } from './config.js';

/**
 * FreshPairsManager - Handles the live feed of new trading pairs
 */
export class FreshPairsManager {
    constructor() {
        this.container = null;
        this.pairs = [];
        this.refreshInterval = null;
        this.onPairClick = null;
        this.isLoading = false;
    }

    /**
     * Initialize the fresh pairs sidebar
     * @param {HTMLElement} container - Container element for the feed
     * @param {Function} onPairClick - Callback when a pair is clicked
     */
    init(container, onPairClick) {
        this.container = container;
        this.onPairClick = onPairClick;
        this.startAutoRefresh();
        this.fetchFreshPairs();
    }

    /**
     * Fetch latest pairs from Dexscreener
     */
    async fetchFreshPairs() {
        if (this.isLoading) return;
        this.isLoading = true;

        try {
            // Use the token-boosts endpoint for trending/new tokens
            const response = await fetch(`${CONFIG.API.DEXSCREENER_BASE}/token-boosts/top/v1`);

            if (!response.ok) {
                throw new Error('Failed to fetch fresh pairs');
            }

            const data = await response.json();

            // Filter to Solana pairs only and get recent ones
            this.pairs = (data || [])
                .filter(item => item.chainId === 'solana')
                .slice(0, 15)
                .map(item => {
                    const iconUrl = item.icon ||
                        (item.tokenAddress ? `https://dd.dexscreener.com/ds-data/tokens/solana/${item.tokenAddress}.png` : null);

                    return {
                        address: item.tokenAddress,
                        name: item.description || item.tokenAddress.slice(0, 8),
                        symbol: item.symbol || '???',
                        icon: iconUrl,
                        url: item.url,
                        score: this.calculateQuickScore(item)
                    };
                });

            this.render();
        } catch (error) {
            console.error('Fresh pairs fetch error:', error);
            // Try fallback to profiles endpoint
            await this.fetchFallbackPairs();
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * Fallback fetch using token profiles
     */
    async fetchFallbackPairs() {
        try {
            const response = await fetch(`${CONFIG.API.DEXSCREENER_BASE}/token-profiles/latest/v1`);

            if (!response.ok) return;

            const data = await response.json();

            this.pairs = (data || [])
                .filter(item => item.chainId === 'solana')
                .slice(0, 15)
                .map(item => ({
                    address: item.tokenAddress,
                    name: item.description?.slice(0, 20) || 'New Token',
                    symbol: '🆕',
                    icon: item.icon,
                    url: item.url,
                    score: Math.floor(Math.random() * 30 + 40) // Placeholder score
                }));

            this.render();
        } catch (error) {
            console.error('Fallback fetch error:', error);
        }
    }

    /**
     * Calculate quick MemeRadar score for sidebar display
     * @param {Object} item - Token data
     * @returns {number} - Score 0-100
     */
    calculateQuickScore(item) {
        // Quick heuristic score based on available data
        let score = 50;

        if (item.totalAmount) {
            score += Math.min(20, Math.log10(item.totalAmount + 1) * 5);
        }
        if (item.amount) {
            score += Math.min(15, Math.log10(item.amount + 1) * 3);
        }

        return Math.min(100, Math.max(0, Math.round(score)));
    }

    /**
     * Get score color based on value
     * @param {number} score - Score value
     * @returns {string} - CSS color
     */
    getScoreColor(score) {
        if (score >= 70) return '#00ff88';
        if (score >= 50) return '#ffaa00';
        return '#ff4444';
    }

    /**
     * Render the pairs list
     */
    render() {
        if (!this.container) return;

        if (this.pairs.length === 0) {
            this.container.innerHTML = `
                <div class="fresh-pairs-empty">
                    <span>🔍</span>
                    <p>Loading fresh pairs...</p>
                </div>
            `;
            return;
        }

        const html = this.pairs.map(pair => `
            <div class="fresh-pair-item" data-address="${pair.address}">
                <div class="fresh-pair-content" onclick="selectToken('${pair.address}')">
                    <div class="fresh-pair-icon">
                        ${pair.icon ? `<img src="${pair.icon}" alt="" onerror="this.style.display='none'">` : '🪙'}
                    </div>
                    <div class="fresh-pair-info">
                        <div class="fresh-pair-name">${this.truncate(pair.name, 12)}</div>
                        <div class="fresh-pair-address">${pair.address.slice(0, 4)}...${pair.address.slice(-4)}</div>
                    </div>
                    <div class="fresh-pair-score" style="color: ${this.getScoreColor(pair.score)}">
                        ${pair.score}
                    </div>
                </div>
                <div class="fresh-pair-actions">
                    <a href="https://axiom.exchange/t/${pair.address}" target="_blank" title="Trade on Axiom" class="action-btn axiom">⚔️</a>
                    <a href="https://dexscreener.com/solana/${pair.address}" target="_blank" title="View on Dexscreener" class="action-btn ds">🦅</a>
                </div>
            </div>
        `).join('');

        this.container.innerHTML = html;

        // Add click handler for the main content area (not buttons)
        this.container.querySelectorAll('.fresh-pair-content').forEach(el => {
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                const item = el.closest('.fresh-pair-item');
                const address = item.dataset.address;
                if (window.selectToken) {
                    window.selectToken(address);
                } else if (this.onPairClick && address) {
                    this.onPairClick(address);
                }
            });
        });
    }

    /**
     * Truncate text
     * @param {string} text - Text to truncate
     * @param {number} length - Max length
     * @returns {string} - Truncated text
     */
    truncate(text, length) {
        if (!text) return '';
        return text.length > length ? text.slice(0, length) + '...' : text;
    }

    /**
     * Start auto-refresh interval
     */
    startAutoRefresh() {
        // Refresh every 30 seconds
        this.refreshInterval = setInterval(() => {
            this.fetchFreshPairs();
        }, 30000);
    }

    /**
     * Stop auto-refresh
     */
    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }

    /**
     * Manually trigger refresh
     */
    refresh() {
        this.pairs = []; // Clear current pairs to show loading state
        this.render();
        this.fetchFreshPairs();
    }
}

export default FreshPairsManager;
