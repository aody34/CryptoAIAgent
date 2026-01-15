// ===========================================
// MEMERADAR - DEV CHECKER MODULE
// Automated Developer Trust Score via Solscan & On-Chain Metrics
// ===========================================

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

        // 1. Check Wallet Balance (if creator known)
        if (creatorAddress) {
            try {
                const accountUrl = `https://api.solscan.io/account?address=${creatorAddress}`;
                const resp = await fetch(accountUrl);
                if (resp.ok) {
                    const data = await resp.json();
                    walletBalance = (data?.data?.lamports || 0) / 1e9;

                    if (walletBalance > 5) score += 20; // Rich dev = likely legit or long-term
                    else if (walletBalance > 1) score += 10;
                    else if (walletBalance < 0.1) score -= 10; // Dust wallet = sus
                }
            } catch (e) { console.log('Balance check failed'); }
        }

        // 2. Liquidity Health (from pairData)
        if (pairData) {
            const liq = pairData.liquidity?.usd || 0;
            if (liq > 50000) score += 20;
            else if (liq > 10000) score += 10;
            else if (liq < 1000) score -= 20;
        }

        // 3. Volume (Active trading)
        if (pairData) {
            const vol = pairData.volume?.h24 || 0;
            if (vol > 100000) score += 20;
            else if (vol > 10000) score += 10;
        }

        // 4. Age (Older = Better)
        if (pairData && pairData.pairCreatedAt) {
            const hoursOld = (Date.now() - pairData.pairCreatedAt) / (1000 * 60 * 60);
            if (hoursOld > 72) score += 20; // > 3 days
            else if (hoursOld > 24) score += 10;
            else if (hoursOld < 1) score -= 10; // Brand new
        }

        // 5. Socials (If present)
        if (pairData && (pairData.info?.socials?.length > 0)) {
            score += 20;
        }

        // Normalize Score (0-100)
        // Base is 50
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

        return {
            badge,
            badgeClass,
            message: `Trust Score: ${finalScore}/100 based on On-Chain Data`,
            otherTokens: 'Scan Required (Pro)',
            rugCount: 'Scan Required (Pro)',
            successRate: `${finalScore}%` // Proxy for success rate
        };
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
