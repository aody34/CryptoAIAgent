// ===========================================
// CRYPTO AI AGENT - UTILITY FUNCTIONS
// ===========================================

import { CONFIG, RISK_LEVELS } from './config.js';

/**
 * Format a number as currency (USD)
 * @param {number} value - Number to format
 * @param {number} decimals - Decimal places
 * @returns {string} - Formatted string
 */
export function formatCurrency(value, decimals = 2) {
    if (value === null || value === undefined) return 'N/A';

    if (value >= 1_000_000_000) {
        return `$${(value / 1_000_000_000).toFixed(2)}B`;
    }
    if (value >= 1_000_000) {
        return `$${(value / 1_000_000).toFixed(2)}M`;
    }
    if (value >= 1_000) {
        return `$${(value / 1_000).toFixed(2)}K`;
    }
    if (value < 0.01) {
        return `$${value.toFixed(8)}`;
    }
    return `$${value.toFixed(decimals)}`;
}

/**
 * Format a price with appropriate decimals
 * @param {number} price - Price to format
 * @returns {string} - Formatted price
 */
export function formatPrice(price) {
    if (price === null || price === undefined) return 'N/A';

    if (price >= 1) {
        return `$${price.toFixed(2)}`;
    }
    if (price >= 0.01) {
        return `$${price.toFixed(4)}`;
    }
    if (price >= 0.0001) {
        return `$${price.toFixed(6)}`;
    }
    // For very small prices, use scientific-like notation
    const zeros = -Math.floor(Math.log10(price)) - 1;
    if (zeros >= 4) {
        const significand = price * Math.pow(10, zeros + 4);
        return `$0.0{${zeros}}${significand.toFixed(0)}`;
    }
    return `$${price.toFixed(8)}`;
}

/**
 * Format a percentage
 * @param {number} value - Percentage value
 * @returns {string} - Formatted percentage with sign
 */
export function formatPercentage(value) {
    if (value === null || value === undefined) return 'N/A';

    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
}

/**
 * Format large numbers with K/M/B suffix
 * @param {number} value - Number to format
 * @returns {string} - Formatted string
 */
export function formatNumber(value) {
    if (value === null || value === undefined) return 'N/A';

    if (value >= 1_000_000_000) {
        return `${(value / 1_000_000_000).toFixed(2)}B`;
    }
    if (value >= 1_000_000) {
        return `${(value / 1_000_000).toFixed(2)}M`;
    }
    if (value >= 1_000) {
        return `${(value / 1_000).toFixed(2)}K`;
    }
    return value.toFixed(0);
}

/**
 * Truncate address for display
 * @param {string} address - Full address
 * @param {number} chars - Characters to show on each end
 * @returns {string} - Truncated address
 */
export function truncateAddress(address, chars = 6) {
    if (!address) return 'N/A';
    if (address.length <= chars * 2) return address;
    return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

/**
 * Check if input is a valid contract address
 * @param {string} input - User input
 * @returns {boolean} - Is valid address
 */
export function isContractAddress(input) {
    if (!input) return false;

    // Ethereum-style address (0x...)
    if (/^0x[a-fA-F0-9]{40}$/.test(input)) return true;

    // Solana address (base58, 32-44 chars)
    if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(input)) return true;

    return false;
}

/**
 * Check if token is in blocked list
 * @param {string} ticker - Token ticker
 * @returns {boolean} - Is blocked
 */
export function isBlockedToken(ticker) {
    if (!ticker) return false;
    const upper = ticker.toUpperCase().trim();
    return CONFIG.BLOCKED_TOKENS.includes(upper);
}

/**
 * Validate user input
 * @param {string} input - User input
 * @returns {Object} - { valid: boolean, error: string|null, type: 'ticker'|'address' }
 */
export function validateInput(input) {
    if (!input || input.trim() === '') {
        return { valid: false, error: 'Please enter a token ticker or contract address', type: null };
    }

    const trimmed = input.trim();

    // Check for multiple tokens
    if (trimmed.includes(',') || trimmed.includes(' ')) {
        return { valid: false, error: 'Please enter only ONE token at a time', type: null };
    }

    // Check if it's a contract address
    if (isContractAddress(trimmed)) {
        return { valid: true, error: null, type: 'address' };
    }

    // Check if it's a blocked ticker
    if (isBlockedToken(trimmed)) {
        return {
            valid: false,
            error: 'This AI Agent only analyzes MEMECOINS. Large-cap tokens like BTC, ETH, SOL are not supported.',
            type: null
        };
    }

    // Assume it's a ticker
    return { valid: true, error: null, type: 'ticker' };
}

/**
 * Calculate risk scores based on token metrics
 * @param {Object} tokenData - Token data from API
 * @returns {Object} - Risk analysis
 */
export function calculateRiskAnalysis(tokenData) {
    const risks = {
        rugPull: { level: 'LOW', score: 2 },
        liquidity: { level: 'LOW', score: 2 },
        holderConcentration: { level: 'MEDIUM', score: 5 },
        volatility: { level: 'MEDIUM', score: 5 },
        overall: { level: 'MEDIUM', score: 5 }
    };

    const liquidity = tokenData.liquidity?.usd || 0;
    const volume24h = tokenData.volume?.h24 || 0;
    const priceChange24h = Math.abs(tokenData.priceChange?.h24 || 0);
    const buys = tokenData.txns?.h24?.buys || 0;
    const sells = tokenData.txns?.h24?.sells || 0;

    // Liquidity risk
    if (liquidity < CONFIG.RISK.LIQUIDITY_LOW) {
        risks.liquidity = { level: 'HIGH', score: 9 };
        risks.rugPull = { level: 'HIGH', score: 8 };
    } else if (liquidity < CONFIG.RISK.LIQUIDITY_MEDIUM) {
        risks.liquidity = { level: 'MEDIUM', score: 6 };
        risks.rugPull = { level: 'MEDIUM', score: 5 };
    }

    // Volatility risk based on 24h price change
    if (priceChange24h > 50) {
        risks.volatility = { level: 'HIGH', score: 9 };
    } else if (priceChange24h > 20) {
        risks.volatility = { level: 'MEDIUM', score: 6 };
    } else {
        risks.volatility = { level: 'LOW', score: 3 };
    }

    // Holder concentration (estimated from buy/sell ratio)
    const totalTxns = buys + sells;
    if (totalTxns < 50) {
        risks.holderConcentration = { level: 'HIGH', score: 8 };
    } else if (totalTxns < 200) {
        risks.holderConcentration = { level: 'MEDIUM', score: 5 };
    } else {
        risks.holderConcentration = { level: 'LOW', score: 3 };
    }

    // Calculate overall risk score (weighted average)
    const overallScore = Math.round(
        (risks.rugPull.score * 0.3 +
            risks.liquidity.score * 0.25 +
            risks.holderConcentration.score * 0.25 +
            risks.volatility.score * 0.2)
    );

    if (overallScore >= 7) {
        risks.overall = { level: 'HIGH', score: overallScore };
    } else if (overallScore >= 4) {
        risks.overall = { level: 'MEDIUM', score: overallScore };
    } else {
        risks.overall = { level: 'LOW', score: overallScore };
    }

    return risks;
}

/**
 * Analyze market sentiment and momentum
 * @param {Object} tokenData - Token data from API
 * @returns {Object} - Sentiment analysis
 */
export function analyzeSentiment(tokenData) {
    const volume24h = tokenData.volume?.h24 || 0;
    const volume6h = tokenData.volume?.h6 || volume24h / 4;
    const volume1h = tokenData.volume?.h1 || volume24h / 24;
    const priceChange24h = tokenData.priceChange?.h24 || 0;
    const priceChange6h = tokenData.priceChange?.h6 || 0;
    const priceChange1h = tokenData.priceChange?.h1 || 0;
    const buys = tokenData.txns?.h24?.buys || 0;
    const sells = tokenData.txns?.h24?.sells || 0;

    // Volume trend
    let volumeTrend = 'Stable';
    const recentVolumeRatio = (volume1h * 24) / volume24h;
    if (recentVolumeRatio > 1.5) volumeTrend = 'Increasing';
    else if (recentVolumeRatio < 0.5) volumeTrend = 'Decreasing';

    // Whale activity (based on transaction patterns)
    let whaleActivity = 'Neutral';
    const buySellRatio = sells > 0 ? buys / sells : buys;
    if (buySellRatio > 2) whaleActivity = 'Accumulation';
    else if (buySellRatio < 0.5) whaleActivity = 'Distribution';

    // Community hype level
    let hypeLevel = 'Medium';
    const totalTxns = buys + sells;
    if (totalTxns > 1000 && volume24h > 100000) hypeLevel = 'High';
    else if (totalTxns < 100 || volume24h < 10000) hypeLevel = 'Low';

    // Price volatility
    let volatility = 'Medium';
    const maxChange = Math.max(
        Math.abs(priceChange24h),
        Math.abs(priceChange6h) * 4,
        Math.abs(priceChange1h) * 24
    );
    if (maxChange > 50) volatility = 'High';
    else if (maxChange < 10) volatility = 'Low';

    // Overall trend direction
    let trendDirection = 'Neutral';
    if (priceChange24h > 10 && priceChange6h > 0) trendDirection = 'Bullish';
    else if (priceChange24h < -10 && priceChange6h < 0) trendDirection = 'Bearish';

    return {
        volumeTrend,
        whaleActivity,
        hypeLevel,
        volatility,
        trendDirection,
        buySellRatio: buySellRatio.toFixed(2),
        transactionCount: totalTxns
    };
}

/**
 * Generate 6-month price predictions (SPECULATIVE)
 * @param {Object} tokenData - Token data from API
 * @returns {Object} - Prediction scenarios
 */
export function generatePredictions(tokenData) {
    const currentPrice = parseFloat(tokenData.priceUsd) || 0;
    const marketCap = tokenData.marketCap || tokenData.fdv || 0;
    const liquidity = tokenData.liquidity?.usd || 0;
    const volume24h = tokenData.volume?.h24 || 0;

    // Base multipliers based on market conditions
    // These are SPECULATIVE and for entertainment only
    const liquidityRatio = liquidity / (marketCap || 1);
    const volumeRatio = volume24h / (marketCap || 1);

    // Bullish scenario (requires certain conditions)
    const bullishMultiplier = 2 + Math.min(volumeRatio * 10, 3);
    const bullish = {
        conditions: [
            'Sustained volume increase',
            'Major exchange listings',
            'Strong community growth',
            'Positive market sentiment'
        ],
        priceRange: {
            low: currentPrice * (bullishMultiplier * 0.5),
            high: currentPrice * bullishMultiplier
        },
        marketCapRange: {
            low: marketCap * (bullishMultiplier * 0.5),
            high: marketCap * bullishMultiplier
        }
    };

    // Neutral scenario
    const neutralMultiplier = 0.8 + Math.random() * 0.4; // 0.8x to 1.2x
    const neutral = {
        description: 'Sideways trading with normal market fluctuations',
        priceRange: {
            low: currentPrice * 0.5,
            high: currentPrice * 1.5
        },
        marketCapRange: {
            low: marketCap * 0.5,
            high: marketCap * 1.5
        }
    };

    // Bearish scenario
    const bearish = {
        triggers: [
            'Loss of community interest',
            'Broader market downturn',
            'Liquidity withdrawal',
            'Competition from similar tokens'
        ],
        priceRange: {
            low: currentPrice * 0.05,
            high: currentPrice * 0.3
        },
        marketCapRange: {
            low: marketCap * 0.05,
            high: marketCap * 0.3
        }
    };

    return { bullish, neutral, bearish };
}

/**
 * Generate AI verdict summary
 * @param {Object} tokenData - Token data
 * @param {Object} risks - Risk analysis
 * @param {Object} sentiment - Sentiment analysis
 * @returns {Object} - Verdict
 */
export function generateVerdict(tokenData, risks, sentiment) {
    const liquidity = tokenData.liquidity?.usd || 0;
    const volume24h = tokenData.volume?.h24 || 0;
    const priceChange24h = tokenData.priceChange?.h24 || 0;

    let strength = 'Moderate';
    let suitableFor = [];
    let summary = '';

    // Determine project strength
    if (risks.overall.score <= 4 && liquidity > 100000) {
        strength = 'Strong';
        suitableFor = ['Mid-term holders', 'Memecoin investors'];
        summary = 'This token shows relatively healthy metrics with adequate liquidity and trading activity. ';
    } else if (risks.overall.score >= 7 || liquidity < 10000) {
        strength = 'Weak';
        suitableFor = ['High-risk speculators only'];
        summary = 'This token carries significant risk factors. Low liquidity and/or concerning metrics suggest extreme caution. ';
    } else {
        strength = 'Moderate';
        suitableFor = ['Short-term traders', 'High-risk memecoin investors'];
        summary = 'This token shows mixed signals with moderate risk levels. ';
    }

    // Add sentiment-based commentary
    if (sentiment.trendDirection === 'Bullish') {
        summary += 'Current momentum appears positive with buying pressure outweighing selling. ';
    } else if (sentiment.trendDirection === 'Bearish') {
        summary += 'Current momentum shows selling pressure which may indicate profit-taking or declining interest. ';
    }

    // Add volume commentary
    if (sentiment.volumeTrend === 'Increasing') {
        summary += 'Volume is trending upward, suggesting growing interest.';
    } else if (sentiment.volumeTrend === 'Decreasing') {
        summary += 'Volume is declining, which may impact price stability.';
    }

    return {
        strength,
        suitableFor,
        summary,
        riskScore: risks.overall.score,
        riskLevel: risks.overall.level
    };
}

export default {
    formatCurrency,
    formatPrice,
    formatPercentage,
    formatNumber,
    truncateAddress,
    isContractAddress,
    isBlockedToken,
    validateInput,
    calculateRiskAnalysis,
    analyzeSentiment,
    generatePredictions,
    generateVerdict
};
