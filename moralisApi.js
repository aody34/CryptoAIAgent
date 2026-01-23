// ===========================================
// MEMERADAR - MORALIS API SERVICE
// Wallet Analysis & Smart Money Detection
// ===========================================

import { CONFIG } from './config.js';

/**
 * MoralisAPI - Client-side module for wallet analysis
 * Calls our secure serverless endpoint (doesn't expose API key)
 */
class MoralisAPI {
    constructor() {
        this.baseUrl = CONFIG.API.MORALIS_WALLET || '/api/wallet-analysis';
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    }

    /**
     * Get cached data if still valid
     * @param {string} key - Cache key
     * @returns {Object|null} - Cached data or null
     */
    getCached(key) {
        const cached = this.cache.get(key);
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            return cached.data;
        }
        return null;
    }

    /**
     * Set cache data
     * @param {string} key - Cache key
     * @param {Object} data - Data to cache
     */
    setCache(key, data) {
        this.cache.set(key, { data, timestamp: Date.now() });
    }

    /**
     * Clear cache for an address or all cache
     * @param {string} address - Optional address to clear (clears all if not provided)
     */
    clearCache(address = null) {
        if (address) {
            // Clear specific address cache
            const keysToDelete = [];
            for (const key of this.cache.keys()) {
                if (key.startsWith(address)) {
                    keysToDelete.push(key);
                }
            }
            keysToDelete.forEach(key => this.cache.delete(key));
            console.log(`[MoralisAPI] Cleared cache for ${address.slice(0, 8)}...`);
        } else {
            // Clear all cache
            this.cache.clear();
            console.log('[MoralisAPI] Cleared all cache');
        }
    }

    /**
     * Make API request to our serverless function
     * @param {string} address - Wallet address
     * @param {string} type - Request type
     * @returns {Promise<Object>} - API response
     */
    async request(address, type) {
        const cacheKey = `${address}_${type}`;
        const cached = this.getCached(cacheKey);
        if (cached) {
            console.log(`[MoralisAPI] Cache hit for ${type}: ${address.slice(0, 8)}...`);
            return cached;
        }

        try {
            const url = `${this.baseUrl}?address=${encodeURIComponent(address)}&type=${type}`;
            const response = await fetch(url);

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || `API request failed: ${response.status}`);
            }

            const result = await response.json();

            if (result.success) {
                this.setCache(cacheKey, result.data);
                return result.data;
            } else {
                throw new Error(result.error || 'Unknown error');
            }
        } catch (error) {
            console.error(`[MoralisAPI] ${type} error:`, error.message);
            throw error;
        }
    }

    /**
     * Get wallet portfolio with total USD value
     * @param {string} address - Wallet address
     * @returns {Promise<Object>} - Portfolio data
     */
    async getWalletPortfolio(address) {
        return this.request(address, 'portfolio');
    }

    /**
     * Get all SPL tokens in wallet
     * @param {string} address - Wallet address
     * @returns {Promise<Object>} - Tokens data
     */
    async getWalletTokens(address) {
        return this.request(address, 'tokens');
    }

    /**
     * Get wallet transaction history (decoded)
     * @param {string} address - Wallet address
     * @returns {Promise<Object>} - Transactions data
     */
    async getWalletTransactions(address) {
        return this.request(address, 'transactions');
    }

    /**
     * Get native SOL balance
     * @param {string} address - Wallet address
     * @returns {Promise<Object>} - Balance data
     */
    async getWalletBalance(address) {
        return this.request(address, 'balance');
    }

    /**
     * Get full wallet analysis (all data + risk indicators)
     * @param {string} address - Wallet address
     * @returns {Promise<Object>} - Full analysis
     */
    async getFullAnalysis(address) {
        return this.request(address, 'full');
    }

    /**
     * Check if wallet is a potential whale
     * @param {string} address - Wallet address
     * @returns {Promise<boolean>} - Is whale
     */
    async isWhale(address) {
        try {
            const portfolio = await this.getWalletPortfolio(address);
            return (portfolio.totalNetWorthUSD || 0) >= (CONFIG.WHALE?.MIN_VALUE_USD || 100000);
        } catch {
            return false;
        }
    }

    /**
     * Check if wallet is a burner (created recently)
     * @param {string} address - Wallet address
     * @returns {Promise<Object>} - Age info with isBurner flag
     */
    async getWalletAge(address) {
        try {
            const txData = await this.getWalletTransactions(address);
            return txData.walletAge || { isBurner: false, days: null };
        } catch {
            return { isBurner: false, days: null, error: true };
        }
    }

    /**
     * Get human-readable wallet summary
     * @param {string} address - Wallet address
     * @returns {Promise<Object>} - Readable summary
     */
    async getWalletSummary(address) {
        try {
            const data = await this.getFullAnalysis(address);

            return {
                address,
                shortAddress: `${address.slice(0, 4)}...${address.slice(-4)}`,
                netWorthUSD: data.portfolio?.totalNetWorthUSD || 0,
                solBalance: data.balance?.solana || 0,
                tokenCount: data.tokens?.count || 0,
                topTokens: (data.tokens?.tokens || []).slice(0, 5),
                transactionCount: data.transactions?.totalCount || 0,
                walletAge: data.transactions?.walletAge || null,
                riskIndicators: data.riskIndicators || {},
                isWhale: data.riskIndicators?.isWhale || false,
                isBurner: data.riskIndicators?.isBurner || false,
                trustScore: data.riskIndicators?.trustScore || 50,
                flags: data.riskIndicators?.flags || []
            };
        } catch (error) {
            console.error('[MoralisAPI] Summary error:', error.message);
            return {
                address,
                shortAddress: `${address.slice(0, 4)}...${address.slice(-4)}`,
                error: error.message,
                netWorthUSD: 0,
                tokenCount: 0,
                trustScore: 0
            };
        }
    }
}

// Singleton instance
const moralisAPI = new MoralisAPI();

// Expose to window for debugging (allows console: moralisAPI.clearCache())
if (typeof window !== 'undefined') {
    window.moralisAPI = moralisAPI;
}

export { MoralisAPI, moralisAPI };
export default moralisAPI;
