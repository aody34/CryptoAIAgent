// ===========================================
// MEMERADAR - API SERVICE
// Dexscreener Integration
// ===========================================

import { CONFIG } from './config.js';

/**
 * DexscreenerAPI - Handles all API interactions with Dexscreener
 */
export class DexscreenerAPI {
    constructor() {
        this.baseUrl = CONFIG.API.DEXSCREENER_BASE;
    }

    /**
     * Search for tokens by ticker symbol or name
     * @param {string} query - Token ticker or name
     * @returns {Promise<Object>} - Token data
     */
    async searchToken(query) {
        try {
            const response = await fetch(
                `${this.baseUrl}${CONFIG.API.DEXSCREENER_SEARCH}?q=${encodeURIComponent(query)}`
            );

            if (!response.ok) {
                throw new Error(`API Error: ${response.status}`);
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Dexscreener search error:', error);
            throw error;
        }
    }

    /**
     * Get token data by contract address
     * @param {string} address - Token contract address
     * @returns {Promise<Object>} - Token data
     */
    async getTokenByAddress(address) {
        try {
            // First try to search by the address
            const response = await fetch(
                `${this.baseUrl}${CONFIG.API.DEXSCREENER_SEARCH}?q=${encodeURIComponent(address)}`
            );

            if (!response.ok) {
                throw new Error(`API Error: ${response.status}`);
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Dexscreener token lookup error:', error);
            throw error;
        }
    }

    /**
     * Get token pairs by chain and token address
     * @param {string} chainId - Chain identifier
     * @param {string} tokenAddress - Token contract address
     * @returns {Promise<Object>} - Pairs data
     */
    async getTokenPairs(chainId, tokenAddress) {
        try {
            const response = await fetch(
                `${this.baseUrl}/token-pairs/v1/${chainId}/${tokenAddress}`
            );

            if (!response.ok) {
                throw new Error(`API Error: ${response.status}`);
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Dexscreener pairs error:', error);
            throw error;
        }
    }

    /**
     * Get latest token profiles (for images/metadata)
     * @returns {Promise<Array>} - Token profiles
     */
    async getTokenProfiles() {
        try {
            const response = await fetch(
                `${this.baseUrl}${CONFIG.API.DEXSCREENER_PROFILES}`
            );

            if (!response.ok) {
                throw new Error(`API Error: ${response.status}`);
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Dexscreener profiles error:', error);
            throw error;
        }
    }
}

/**
 * Find the best trading pair from results
 * Prioritizes by liquidity and volume
 * @param {Array} pairs - Array of trading pairs
 * @returns {Object|null} - Best pair or null
 */
export function findBestPair(pairs) {
    if (!pairs || pairs.length === 0) return null;

    // Sort by liquidity (USD) descending
    const sorted = [...pairs].sort((a, b) => {
        const liqA = a.liquidity?.usd || 0;
        const liqB = b.liquidity?.usd || 0;
        return liqB - liqA;
    });

    return sorted[0];
}

/**
 * Aggregate data from multiple pairs for the same token
 * @param {Array} pairs - Array of trading pairs
 * @returns {Object} - Aggregated metrics
 */
export function aggregatePairData(pairs) {
    if (!pairs || pairs.length === 0) return null;

    const aggregated = {
        totalLiquidity: 0,
        totalVolume24h: 0,
        totalBuys24h: 0,
        totalSells24h: 0,
        pairCount: pairs.length,
        chains: new Set(),
        dexes: new Set(),
    };

    pairs.forEach(pair => {
        aggregated.totalLiquidity += pair.liquidity?.usd || 0;
        aggregated.totalVolume24h += pair.volume?.h24 || 0;
        aggregated.totalBuys24h += pair.txns?.h24?.buys || 0;
        aggregated.totalSells24h += pair.txns?.h24?.sells || 0;
        aggregated.chains.add(pair.chainId);
        aggregated.dexes.add(pair.dexId);
    });

    aggregated.chains = Array.from(aggregated.chains);
    aggregated.dexes = Array.from(aggregated.dexes);

    return aggregated;
}

/**
 * Check if token exists on Axiom Exchange
 * Since Axiom doesn't have public API, we just generate a link
 * @param {string} address - Token address
 * @param {string} chain - Chain ID
 * @returns {string} - Axiom URL
 */
export function getAxiomLink(address, chain) {
    if (chain === 'solana') {
        return `${CONFIG.EXTERNAL.AXIOM}/t/${address}`;
    }
    return null;
}

/**
 * Get Dexscreener link for a token
 * @param {string} chainId - Chain identifier
 * @param {string} pairAddress - Pair address
 * @returns {string} - Dexscreener URL
 */
export function getDexscreenerLink(chainId, pairAddress) {
    return `${CONFIG.EXTERNAL.DEXSCREENER}/${chainId}/${pairAddress}`;
}

export default DexscreenerAPI;
