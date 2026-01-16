// ===========================================
// MEMERADAR - DEV CHECKER MODULE
// Automated Developer Trust Score via Solscan & On-Chain Metrics
// ===========================================

// import { solanaRPC } from './rpc.js';

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
     * @param {Object} pairData - Current token pair data (optional)
     * @returns {Promise<Object>} - Dev analysis result
     */
    async analyzeDevWallet(tokenAddress, chainId, pairData = null) {
        // Only works for Solana currently
        if (chainId !== 'solana') {
            return this.getDefaultAnalysis("Only Solana Supported");
        }

        // Check cache first
        const cached = this.getCachedDevData(tokenAddress);
        if (cached) {
            return cached;
        }

        try {
            // Fetch token info from Solscan (free public endpoint) to get creator
            const tokenInfoUrl = `https://api.solscan.io/token/meta?token=${tokenAddress}`;
            const response = await fetch(tokenInfoUrl);
            const data = response.ok ? await response.json() : null;

            // Extract deployer/creator info
            const creator = data?.data?.creator || data?.data?.mintAuthority || null;

            // Calculate Trust Score based on available metrics
            const analysis = await this.calculateTrustScore(creator, pairData);

            const result = {
                status: 'analyzed',
                ...analysis,
                deployerWallet: creator || 'Unknown',
                solscanLink: creator ? `https://solscan.io/account/${creator}` : `https://solscan.io/token/${tokenAddress}`,
                tokenLink: `https://solscan.io/token/${tokenAddress}`
            };

            this.setCachedDevData(tokenAddress, result);
            return result;

        } catch (error) {
            console.error('Dev analysis error:', error);
            // Even on error, try to return a score based on pairData if available
            if (pairData) {
                const analysis = await this.calculateTrustScore(null, pairData);
                return {
                    status: 'partial',
                    ...analysis,
                    deployerWallet: 'Unknown',
                    solscanLink: `https://solscan.io/token/${tokenAddress}`
                };
            }
            return this.getDefaultAnalysis("API Error");
        }
    }

    /**
     * Calculate Trust Score and Badge
     * @returns {Promise<Object>}
     */
    async calculateTrustScore(creatorAddress, pairData) {
        let score = 0;
        let checks = 0;
        let walletBalance = 0;

        // 1. Check Wallet Balance - DISABLED TEMPORARILY due to RPC crash
        // if (creatorAddress) {
        //    try {
        //        walletBalance = await solanaRPC.getBalance(creatorAddress);
        //        ...
        //    } catch (e) { ... }
        // }

        // 2. Pump.fun History Check
        let pumpStats = { total: 0, rugged: 0, successful: 0 };
        if (creatorAddress) {
            try {
                pumpStats = await this.fetchPumpFunHistory(creatorAddress);
            } catch (e) {
                console.warn('Pump.fun fetch failed:', e);
            }
        }

        // 3. Liquidity Health (from pairData)
        if (pairData) {
            const liq = pairData.liquidity?.usd || 0;
            if (liq > 50000) score += 20;
            else if (liq > 10000) score += 10;
            else if (liq < 1000) score -= 20;
        }

        // 4. Volume (Active trading)
        if (pairData) {
            const vol = pairData.volume?.h24 || 0;
            if (vol > 100000) score += 20;
            else if (vol > 10000) score += 10;
        }

        // 5. Age (Older = Better)
        if (pairData && pairData.pairCreatedAt) {
            const hoursOld = (Date.now() - pairData.pairCreatedAt) / (1000 * 60 * 60);
            if (hoursOld > 72) score += 20; // > 3 days
            else if (hoursOld > 24) score += 10;
            else if (hoursOld < 1) score -= 10; // Brand new
        }

        // 6. Socials (If present)
        if (pairData && (pairData.info?.socials?.length > 0)) {
            score += 20;
        }

        // Adjust score based on Pump.fun history
        if (pumpStats.total > 0) {
            if (pumpStats.rugged > 0) score -= (pumpStats.rugged * 10); // Penalty for rugs
            if (pumpStats.successful > 0) score += (pumpStats.successful * 5); // Bonus for success
        }

        // Normalize Score (0-100)
        let finalScore = 40 + score;
        finalScore = Math.min(100, Math.max(0, finalScore));

        // Determine Badge
        let badge = 'UNKNOWN';
        let badgeClass = 'warning';

        if (finalScore >= 80) {
            badge = 'TRUSTED DEV 🟢';
            badgeClass = 'positive';
        } else if (finalScore >= 50) {
            badge = 'AVERAGE 🟡';
            badgeClass = 'warning';
        } else {
            badge = 'HIGH RISK 🔴';
            badgeClass = 'negative';
        }

        const successRate = pumpStats.total > 0
            ? Math.round((pumpStats.successful / pumpStats.total) * 100) + '%'
            : 'N/A';

        return {
            badge,
            badgeClass,
            message: `Trust Score: ${finalScore}/100`,
            otherTokens: pumpStats.total > 0 ? `${pumpStats.total} Coins` : '0 Found (Pump.fun)',
            rugCount: pumpStats.rugged > 0 ? `${pumpStats.rugged} Rugs ⚠️` : '0 Rugs ✅',
            successRate: successRate
        };
    }

    /**
     * Fetch Creator History from Pump.fun (Hidden API)
     * @param {string} creatorAddress 
     */
    async fetchPumpFunHistory(creatorAddress) {
        try {
            // Use the public frontend API
            const response = await fetch(`https://frontend-api.pump.fun/coins/user-created-coins/${creatorAddress}?offset=0&limit=50&include_nsfw=false`);

            if (!response.ok) return { total: 0, rugged: 0, successful: 0 };

            const coins = await response.json();

            if (!Array.isArray(coins)) return { total: 0, rugged: 0, successful: 0 };

            let rugged = 0;
            let successful = 0;

            coins.forEach(coin => {
                // Criteria for "Rugged": Market Cap < $500 AND not completed
                if (!coin.complete && coin.market_cap < 500) {
                    rugged++;
                }
                // Criteria for "Successful": Raydium bonded (complete) OR > $50k MC
                if (coin.complete || coin.market_cap > 50000) {
                    successful++;
                }
            });

            return {
                total: coins.length,
                rugged: rugged,
                successful: successful
            };
        } catch (e) {
            console.error('Pump.fun API error:', e);
            return { total: 0, rugged: 0, successful: 0 };
        }
    }

    /**
     * Get default analysis when data unavailable
     */
    getDefaultAnalysis(msg) {
        return {
            badge: 'VERIFY ⚠️',
            badgeClass: 'warning',
            message: msg || 'Check dev manually',
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
}

export default DevChecker;
