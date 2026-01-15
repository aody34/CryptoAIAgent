// ===========================================
// MEMERADAR - DEV CHECKER MODULE
// Automated Developer Trust Score via Solscan
// ===========================================

import { CONFIG } from './config.js';

/**
 * DevChecker - Handles developer wallet analysis
 */
export class DevChecker {
    constructor() {
        this.cacheKey = 'memeradar_dev_cache';
        this.cacheTTL = 10 * 60 * 1000; // 10 minutes
    }

    /**
     * Get cached dev data
     * @param {string} address - Token address
     */
    getCachedDevData(address) {
        try {
            const cache = JSON.parse(localStorage.getItem(this.cacheKey) || '{}');
            const entry = cache[address];
            if (!entry) return null;
            if (Date.now() - entry.timestamp > this.cacheTTL) {
                delete cache[address];
                localStorage.setItem(this.cacheKey, JSON.stringify(cache));
                return null;
            }
            return entry.data;
        } catch {
            return null;
        }
    }

    /**
     * Cache dev data
     * @param {string} address - Token address
     * @param {Object} data - Dev data
     */
    setCachedDevData(address, data) {
        try {
            const cache = JSON.parse(localStorage.getItem(this.cacheKey) || '{}');
            cache[address] = { data, timestamp: Date.now() };
            localStorage.setItem(this.cacheKey, JSON.stringify(cache));
        } catch (e) {
            console.warn('Dev cache write failed:', e);
        }
    }

    /**
     * Analyze developer wallet for a token
     * @param {string} tokenAddress - Token contract address
     * @param {string} chainId - Chain identifier
     * @returns {Promise<Object>} - Dev analysis result
     */
    async analyzeDevWallet(tokenAddress, chainId) {
        // Only works for Solana currently
        if (chainId !== 'solana') {
            return {
                status: 'unsupported',
                message: 'Dev check only available for Solana',
                badge: null,
                deployerWallet: null,
                otherTokens: 0,
                rugCount: 0,
                successRate: null
            };
        }

        // Check cache first
        const cached = this.getCachedDevData(tokenAddress);
        if (cached) {
            return cached;
        }

        try {
            // Fetch token info from Solscan (free public endpoint)
            const tokenInfoUrl = `https://api.solscan.io/token/meta?token=${tokenAddress}`;
            const response = await fetch(tokenInfoUrl);

            if (!response.ok) {
                throw new Error('Solscan API error');
            }

            const data = await response.json();

            // Extract deployer/creator info if available
            const creator = data?.data?.creator || data?.data?.mintAuthority || null;

            if (!creator) {
                const result = {
                    status: 'unknown',
                    message: 'Creator wallet not found',
                    badge: 'UNVERIFIED',
                    badgeClass: 'warning',
                    deployerWallet: null,
                    otherTokens: 0,
                    rugCount: 0,
                    successRate: null,
                    solscanLink: `https://solscan.io/token/${tokenAddress}`
                };
                this.setCachedDevData(tokenAddress, result);
                return result;
            }

            // Try to get creator's other tokens
            const devAnalysis = await this.analyzeCreatorHistory(creator);

            const result = {
                status: 'analyzed',
                ...devAnalysis,
                deployerWallet: creator,
                solscanLink: `https://solscan.io/account/${creator}`,
                tokenLink: `https://solscan.io/token/${tokenAddress}`
            };

            this.setCachedDevData(tokenAddress, result);
            return result;

        } catch (error) {
            console.error('Dev analysis error:', error);

            const result = {
                status: 'error',
                message: 'Unable to fetch dev data',
                badge: 'CHECK MANUALLY',
                badgeClass: 'warning',
                deployerWallet: null,
                otherTokens: 0,
                rugCount: 0,
                successRate: null,
                solscanLink: `https://solscan.io/token/${tokenAddress}`
            };

            return result;
        }
    }

    /**
     * Analyze creator's token history
     * @param {string} creatorAddress - Creator wallet address
     * @returns {Promise<Object>} - Analysis result
     */
    async analyzeCreatorHistory(creatorAddress) {
        try {
            // Try to get SPL token accounts created by this wallet
            // Note: Full analysis would require Solscan Pro API
            // For now, we'll use heuristics based on available data

            const accountUrl = `https://api.solscan.io/account?address=${creatorAddress}`;
            const response = await fetch(accountUrl);

            if (!response.ok) {
                return this.getDefaultAnalysis();
            }

            const data = await response.json();

            // Check account age and activity
            const accountData = data?.data || {};
            const lamports = accountData.lamports || 0;
            const solBalance = lamports / 1e9;

            // Heuristics for trust score:
            // - Very low balance after launch = might have dumped
            // - Account with history = more trustworthy

            let badge = 'UNVERIFIED';
            let badgeClass = 'warning';
            let message = 'Manual verification recommended';

            if (solBalance > 10) {
                badge = 'ACTIVE DEV';
                badgeClass = 'positive';
                message = 'Developer wallet has significant balance';
            } else if (solBalance > 1) {
                badge = 'MODERATE';
                badgeClass = 'warning';
                message = 'Developer wallet has some activity';
            } else if (solBalance < 0.1) {
                badge = 'LOW BALANCE ⚠️';
                badgeClass = 'negative';
                message = 'Developer wallet nearly empty - potential dump risk';
            }

            return {
                badge,
                badgeClass,
                message,
                otherTokens: 'Check Solscan',
                rugCount: 'Unknown',
                successRate: 'Verify manually'
            };

        } catch (error) {
            console.error('Creator history error:', error);
            return this.getDefaultAnalysis();
        }
    }

    /**
     * Get default analysis when data unavailable
     */
    getDefaultAnalysis() {
        return {
            badge: 'VERIFY ⚠️',
            badgeClass: 'warning',
            message: 'Check dev history manually',
            otherTokens: 'Unknown',
            rugCount: 'Unknown',
            successRate: 'Unknown'
        };
    }

    /**
     * Get the badge HTML based on analysis
     * @param {Object} analysis - Dev analysis result
     * @returns {string} - Badge HTML
     */
    getBadgeHTML(analysis) {
        const colorMap = {
            positive: '#00ff88',
            warning: '#ffaa00',
            negative: '#ff4444'
        };

        const color = colorMap[analysis.badgeClass] || colorMap.warning;

        return `<span class="dev-badge" style="color: ${color}; border-color: ${color};">${analysis.badge}</span>`;
    }

    /**
     * Check if a dev appears to be a serial rugger
     * @param {Object} analysis - Dev analysis result
     * @returns {boolean}
     */
    isSerialRugger(analysis) {
        // If we detected low balance immediately after launch, flag as potential rugger
        return analysis.badge === 'LOW BALANCE ⚠️' || analysis.badge === 'SERIAL RUGGER';
    }
}

export default DevChecker;
