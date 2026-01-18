// ===========================================
// MEMERADAR - DEV CHECKER MODULE
// Complete Dev Analysis with Automated Trust Score
// ===========================================

/**
 * DevChecker - Handles developer wallet analysis
 * Now uses comprehensive server-side API for all checks
 */
class DevChecker {
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
            const cacheKey = `${this.cacheKey}_${address}`;
            const cached = localStorage.getItem(cacheKey);
            if (!cached) return null;

            const { data, timestamp } = JSON.parse(cached);
            if (Date.now() - timestamp > this.cacheTTL) {
                localStorage.removeItem(cacheKey);
                return null;
            }

            return data;
        } catch (e) {
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
            const cacheKey = `${this.cacheKey}_${address}`;
            localStorage.setItem(cacheKey, JSON.stringify({
                data,
                timestamp: Date.now()
            }));
        } catch (e) {
            console.log('Could not cache dev data:', e);
        }
    }

    /**
     * Analyze developer wallet for a token - MAIN ENTRY POINT
     * @param {string} tokenAddress - Token contract address (mint)
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
            // Call the comprehensive API with the mint address
            const apiData = await this.fetchComprehensiveDevAnalysis(tokenAddress);

            // Build the analysis result from API response
            const result = {
                status: 'analyzed',
                badge: this.getBadgeFromScore(apiData.trustScore, apiData.riskLevel),
                badgeClass: apiData.riskLevel === 'LOW' ? 'positive' :
                    apiData.riskLevel === 'DANGER' ? 'negative' : 'warning',
                message: `Trust Score: ${apiData.trustScore}/100`,

                // Deployer info
                deployerWallet: apiData.deployerWallet || 'Unknown',
                walletAge: apiData.walletAge || 'Unknown',

                // Trust metrics
                trustScore: apiData.trustScore,
                riskLevel: apiData.riskLevel,
                riskFlags: apiData.riskFlags || [],

                // Security flags
                mintAuthorityEnabled: apiData.mintAuthorityEnabled,
                freezeAuthorityEnabled: apiData.freezeAuthorityEnabled,

                // Holder info
                top10HolderPercent: apiData.top10HolderPercent,

                // Dev history
                otherTokens: apiData.totalCreated > 0 ? `${apiData.totalCreated} Coins` : '0 Found',
                rugCount: apiData.rugged > 0 ? `${apiData.rugged} Rugs ⚠️` : '0 Rugs ✅',
                successRate: apiData.totalCreated > 0
                    ? Math.round((apiData.successful / apiData.totalCreated) * 100) + '%'
                    : 'N/A',
                avgPeakMarketCap: apiData.avgPeakMarketCap > 0
                    ? `$${apiData.avgPeakMarketCap.toLocaleString()}`
                    : 'N/A',
                tokenHistory: apiData.tokens || [],

                // Social
                hasSocialLinks: apiData.hasSocialLinks,

                // Links
                solscanLink: apiData.deployerWallet && apiData.deployerWallet !== 'Unknown'
                    ? `https://solscan.io/account/${apiData.deployerWallet}`
                    : `https://solscan.io/token/${tokenAddress}`,
                tokenLink: `https://solscan.io/token/${tokenAddress}`
            };

            this.setCachedDevData(tokenAddress, result);
            return result;

        } catch (error) {
            console.error('Dev analysis error:', error);
            return this.getDefaultAnalysis("API Error - Try Again");
        }
    }

    /**
     * Fetch comprehensive dev analysis from our secure API
     * @param {string} mintAddress - Token mint address
     */
    async fetchComprehensiveDevAnalysis(mintAddress) {
        // Check if running on localhost - use direct calls for testing
        const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

        if (isLocalhost) {
            console.log('Running on localhost: Using direct API calls');
            return await this.fetchLocalDevAnalysis(mintAddress);
        }

        // Production: Call secure API endpoint
        const response = await fetch('/api/check-dev', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mintAddress })
        });

        if (!response.ok) {
            throw new Error('API request failed');
        }

        return await response.json();
    }

    /**
     * Local fallback for testing - makes direct Helius calls
     * @param {string} mintAddress
     */
    async fetchLocalDevAnalysis(mintAddress) {
        const apiKey = "9b583a75-fa36-4da9-932d-db8e4e06ae35";
        const heliusRpc = `https://mainnet.helius-rpc.com/?api-key=${apiKey}`;

        let trustScore = 100;
        let riskFlags = [];
        let deployerWallet = null;

        try {
            // Step 1: Get signatures to find deployer
            const sigsResponse = await fetch(heliusRpc, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 1,
                    method: 'getSignaturesForAddress',
                    params: [mintAddress, { limit: 100 }]
                })
            });
            const sigsData = await sigsResponse.json();

            // Step 2: Check asset for authorities
            const assetResponse = await fetch(heliusRpc, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 1,
                    method: 'getAsset',
                    params: { id: mintAddress }
                })
            });
            const assetData = await assetResponse.json();

            let mintAuthorityEnabled = false;
            let freezeAuthorityEnabled = false;

            if (assetData.result && assetData.result.authorities) {
                mintAuthorityEnabled = assetData.result.authorities.some(
                    a => a.scopes && a.scopes.includes('mint')
                );
                freezeAuthorityEnabled = assetData.result.authorities.some(
                    a => a.scopes && a.scopes.includes('freeze')
                );

                if (mintAuthorityEnabled) {
                    trustScore -= 50;
                    riskFlags.push("🚨 Mint Authority Enabled");
                }
                if (freezeAuthorityEnabled) {
                    trustScore -= 50;
                    riskFlags.push("🚨 Freeze Authority Enabled");
                }
            }

            // Step 3: Get holder concentration
            let top10HolderPercent = 0;
            try {
                const holdersResponse = await fetch(heliusRpc, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        jsonrpc: '2.0',
                        id: 1,
                        method: 'getTokenLargestAccounts',
                        params: [mintAddress]
                    })
                });
                const holdersData = await holdersResponse.json();

                if (holdersData.result && holdersData.result.value) {
                    const top10 = holdersData.result.value.slice(0, 10);
                    const top10Amount = top10.reduce((acc, h) => acc + parseFloat(h.uiAmount || 0), 0);
                    top10HolderPercent = Math.round((top10Amount / 1000000000) * 100);

                    if (top10HolderPercent > 30) {
                        trustScore -= 30;
                        riskFlags.push(`⚠️ Top 10 hold ${top10HolderPercent}%`);
                    }
                }
            } catch (e) { /* skip */ }

            const riskLevel = trustScore >= 70 ? 'LOW' : trustScore >= 40 ? 'MEDIUM' : 'DANGER';

            return {
                deployerWallet: deployerWallet || 'Auto-Scan Pending',
                walletAge: 'Scanning...',
                trustScore: Math.max(0, trustScore),
                riskLevel: riskLevel,
                riskFlags: riskFlags,
                mintAuthorityEnabled: mintAuthorityEnabled,
                freezeAuthorityEnabled: freezeAuthorityEnabled,
                top10HolderPercent: top10HolderPercent,
                totalCreated: 0,
                rugged: 0,
                successful: 0,
                avgPeakMarketCap: 0,
                tokens: [],
                hasSocialLinks: false
            };

        } catch (e) {
            console.error('Local analysis error:', e);
            throw e;
        }
    }

    /**
     * Get badge text from trust score
     */
    getBadgeFromScore(score, riskLevel) {
        if (riskLevel === 'LOW' || score >= 70) {
            return 'TRUSTED DEV 🟢';
        } else if (riskLevel === 'DANGER' || score < 40) {
            return 'HIGH RISK 🔴';
        } else {
            return 'CAUTION 🟡';
        }
    }

    /**
     * Get default analysis when data unavailable
     */
    getDefaultAnalysis(msg) {
        return {
            status: 'error',
            badge: 'UNKNOWN',
            badgeClass: 'warning',
            message: msg,
            trustScore: 0,
            riskLevel: 'UNKNOWN',
            riskFlags: [],
            deployerWallet: 'Scanning...',
            walletAge: 'Scanning...',
            otherTokens: 'Scanning...',
            rugCount: 'Scanning...',
            successRate: 'N/A',
            avgPeakMarketCap: 'N/A',
            top10HolderPercent: 0,
            mintAuthorityEnabled: null,
            freezeAuthorityEnabled: null,
            hasSocialLinks: null,
            tokenHistory: []
        };
    }

    /**
     * Get the badge HTML based on analysis
     * @param {Object} analysis - Dev analysis result
     * @returns {string} - Badge HTML
     */
    getBadgeHTML(analysis) {
        const { badge, badgeClass, message, riskFlags } = analysis;

        let flagsHtml = '';
        if (riskFlags && riskFlags.length > 0) {
            flagsHtml = `<div style="font-size: 0.7rem; margin-top: 0.25rem; color: var(--text-muted);">${riskFlags.length} flag${riskFlags.length > 1 ? 's' : ''}</div>`;
        }

        return `
            <span class="dev-badge ${badgeClass}" title="${message}">
                ${badge}
            </span>
            ${flagsHtml}
        `;
    }
}

export { DevChecker };
export default DevChecker;
