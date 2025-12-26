// ===========================================
// CRYPTO AI AGENT - MAIN APPLICATION
// Professional Memecoin Analyzer
// ===========================================

import { DexscreenerAPI, findBestPair, getAxiomLink, getDexscreenerLink, aggregatePairData } from './api.js';
import { CONFIG, CHAIN_NAMES, RISK_LEVELS } from './config.js';
import {
    formatCurrency,
    formatPrice,
    formatPercentage,
    formatNumber,
    truncateAddress,
    validateInput,
    calculateRiskAnalysis,
    analyzeSentiment,
    generatePredictions,
    generateVerdict
} from './utils.js';

// Initialize API
const api = new DexscreenerAPI();

// DOM Elements
const searchForm = document.getElementById('searchForm');
const tokenInput = document.getElementById('tokenInput');
const analyzeBtn = document.getElementById('analyzeBtn');
const loadingState = document.getElementById('loadingState');
const errorState = document.getElementById('errorState');
const errorMessage = document.getElementById('errorMessage');
const resultsSection = document.getElementById('resultsSection');

// State
let currentTokenData = null;

/**
 * Show loading state
 */
function showLoading() {
    loadingState.classList.add('active');
    errorState.classList.remove('active');
    resultsSection.classList.remove('active');
    analyzeBtn.disabled = true;
}

/**
 * Hide loading state
 */
function hideLoading() {
    loadingState.classList.remove('active');
    analyzeBtn.disabled = false;
}

/**
 * Show error state
 * @param {string} message - Error message
 */
function showError(message) {
    hideLoading();
    errorMessage.textContent = message;
    errorState.classList.add('active');
    resultsSection.classList.remove('active');
}

/**
 * Show results
 */
function showResults() {
    hideLoading();
    errorState.classList.remove('active');
    resultsSection.classList.add('active');
}

/**
 * Update element text safely
 * @param {string} id - Element ID
 * @param {string} value - Value to set
 */
function setElementText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

/**
 * Update element class based on value
 * @param {string} id - Element ID
 * @param {string} level - Risk level (LOW, MEDIUM, HIGH)
 */
function setRiskClass(id, level) {
    const el = document.getElementById(id);
    if (el) {
        el.classList.remove('positive', 'negative', 'warning');
        if (level === 'LOW') el.classList.add('positive');
        else if (level === 'HIGH') el.classList.add('negative');
        else el.classList.add('warning');
    }
}

/**
 * Update risk meter fill
 * @param {string} id - Meter element ID
 * @param {string} level - Risk level
 */
function setRiskMeter(id, level) {
    const el = document.getElementById(id);
    if (el) {
        el.classList.remove('low', 'medium', 'high');
        el.classList.add(level.toLowerCase());
    }
}

/**
 * Render token data to UI
 * @param {Object} pair - Best trading pair data
 * @param {Object} aggregated - Aggregated data from all pairs
 */
function renderTokenData(pair, aggregated) {
    const token = pair.baseToken;

    // 1. Token Identification
    const tokenImage = document.getElementById('tokenImage');
    if (pair.info?.imageUrl) {
        tokenImage.src = pair.info.imageUrl;
        tokenImage.style.display = 'block';
    } else {
        tokenImage.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%2312121a" width="100" height="100"/><text x="50" y="60" text-anchor="middle" fill="%2300ff88" font-size="40">' + (token.symbol?.[0] || '?') + '</text></svg>';
    }

    setElementText('tokenName', token.name || 'Unknown Token');
    setElementText('tokenTicker', `($${token.symbol || '???'})`);
    setElementText('tokenAddress', token.address || 'N/A');
    setElementText('chainName', CHAIN_NAMES[pair.chainId] || pair.chainId);

    // External links
    const dexLink = document.getElementById('dexscreenerLink');
    const axiomLinkEl = document.getElementById('axiomLink');

    dexLink.href = getDexscreenerLink(pair.chainId, pair.pairAddress);

    const axiomUrl = getAxiomLink(token.address, pair.chainId);
    if (axiomUrl) {
        axiomLinkEl.href = axiomUrl;
        axiomLinkEl.style.display = 'block';
    } else {
        axiomLinkEl.style.display = 'none';
    }

    // 2. Live Market Data
    setElementText('currentPrice', formatPrice(parseFloat(pair.priceUsd)));
    setElementText('marketCap', formatCurrency(pair.marketCap || pair.fdv));
    setElementText('liquidity', formatCurrency(pair.liquidity?.usd));
    setElementText('volume24h', formatCurrency(pair.volume?.h24));

    const priceChange = pair.priceChange?.h24 || 0;
    const priceChangeEl = document.getElementById('priceChange24h');
    priceChangeEl.textContent = formatPercentage(priceChange);
    priceChangeEl.classList.remove('positive', 'negative');
    priceChangeEl.classList.add(priceChange >= 0 ? 'positive' : 'negative');

    setElementText('totalSupply', 'N/A'); // Not available from Dexscreener

    // 3. On-Chain & Trading Metrics
    const buys = pair.txns?.h24?.buys || 0;
    const sells = pair.txns?.h24?.sells || 0;
    const totalTxns = aggregated?.totalBuys24h + aggregated?.totalSells24h || buys + sells;

    setElementText('txCount24h', formatNumber(totalTxns));
    setElementText('buys24h', formatNumber(aggregated?.totalBuys24h || buys));
    setElementText('sells24h', formatNumber(aggregated?.totalSells24h || sells));

    const ratio = sells > 0 ? (buys / sells).toFixed(2) : buys.toString();
    setElementText('buySellRatio', ratio);

    setElementText('liquidityLock', 'Unknown');
    setElementText('riskFlags', 'See Risk Analysis');

    // 4. Market Sentiment & Momentum
    const sentiment = analyzeSentiment(pair);

    setElementText('volumeTrend', sentiment.volumeTrend);
    setElementText('whaleActivity', sentiment.whaleActivity);
    setElementText('communityHype', sentiment.hypeLevel);
    setElementText('volatility', sentiment.volatility);
    setElementText('trendDirection', sentiment.trendDirection);
    setElementText('pairCount', aggregated?.pairCount || 1);

    // Apply sentiment coloring
    const trendEl = document.getElementById('trendDirection');
    trendEl.classList.remove('positive', 'negative', 'warning');
    if (sentiment.trendDirection === 'Bullish') trendEl.classList.add('positive');
    else if (sentiment.trendDirection === 'Bearish') trendEl.classList.add('negative');

    // 5. 6-Month Price Prediction
    const predictions = generatePredictions(pair);

    setElementText('bullishPrice', `${formatPrice(predictions.bullish.priceRange.low)} - ${formatPrice(predictions.bullish.priceRange.high)}`);
    setElementText('bullishMcap', `${formatCurrency(predictions.bullish.marketCapRange.low)} - ${formatCurrency(predictions.bullish.marketCapRange.high)}`);

    setElementText('neutralPrice', `${formatPrice(predictions.neutral.priceRange.low)} - ${formatPrice(predictions.neutral.priceRange.high)}`);
    setElementText('neutralMcap', `${formatCurrency(predictions.neutral.marketCapRange.low)} - ${formatCurrency(predictions.neutral.marketCapRange.high)}`);

    setElementText('bearishPrice', `${formatPrice(predictions.bearish.priceRange.low)} - ${formatPrice(predictions.bearish.priceRange.high)}`);
    setElementText('bearishMcap', `${formatCurrency(predictions.bearish.marketCapRange.low)} - ${formatCurrency(predictions.bearish.marketCapRange.high)}`);

    // 6. Risk Analysis
    const risks = calculateRiskAnalysis(pair);

    // Overall risk score
    const riskScoreEl = document.getElementById('overallRiskScore');
    riskScoreEl.innerHTML = `${risks.overall.score}<span>/10</span>`;
    riskScoreEl.style.color = RISK_LEVELS[risks.overall.level].color;

    // Individual risks
    setElementText('rugPullRisk', RISK_LEVELS[risks.rugPull.level].label);
    setRiskClass('rugPullRisk', risks.rugPull.level);
    setRiskMeter('rugPullMeter', risks.rugPull.level);

    setElementText('liquidityRisk', RISK_LEVELS[risks.liquidity.level].label);
    setRiskClass('liquidityRisk', risks.liquidity.level);
    setRiskMeter('liquidityMeter', risks.liquidity.level);

    setElementText('holderRisk', RISK_LEVELS[risks.holderConcentration.level].label);
    setRiskClass('holderRisk', risks.holderConcentration.level);
    setRiskMeter('holderMeter', risks.holderConcentration.level);

    setElementText('volatilityRisk', RISK_LEVELS[risks.volatility.level].label);
    setRiskClass('volatilityRisk', risks.volatility.level);
    setRiskMeter('volatilityMeter', risks.volatility.level);

    // 7. Final AI Verdict
    const verdict = generateVerdict(pair, risks, sentiment);

    const verdictIcon = document.getElementById('verdictIcon');
    if (verdict.strength === 'Strong') verdictIcon.textContent = '✅';
    else if (verdict.strength === 'Weak') verdictIcon.textContent = '⚠️';
    else verdictIcon.textContent = '⚖️';

    setElementText('projectStrength', verdict.strength);
    const strengthEl = document.getElementById('projectStrength');
    strengthEl.classList.remove('positive', 'negative', 'warning');
    if (verdict.strength === 'Strong') strengthEl.classList.add('positive');
    else if (verdict.strength === 'Weak') strengthEl.classList.add('negative');
    else strengthEl.classList.add('warning');

    setElementText('verdictSummary', verdict.summary);

    // Suitable for tags
    const tagsContainer = document.getElementById('suitableTags');
    tagsContainer.innerHTML = verdict.suitableFor
        .map(tag => `<span class="verdict-tag">${tag}</span>`)
        .join('');
}

/**
 * Analyze a token
 * @param {string} query - Token ticker or address
 */
async function analyzeToken(query) {
    showLoading();

    try {
        // Search for the token
        const result = await api.searchToken(query);

        if (!result.pairs || result.pairs.length === 0) {
            showError('❌ Token not found on Dexscreener or Axiom Exchange. Please check the ticker or contract address.');
            return;
        }

        // Filter to supported chains and memecoins
        const filteredPairs = result.pairs.filter(pair => {
            // Check if it's on a supported chain
            if (!CONFIG.SUPPORTED_CHAINS.includes(pair.chainId)) return false;

            // Check if market cap is too large (not a memecoin)
            const mcap = pair.marketCap || pair.fdv || 0;
            if (mcap > CONFIG.LARGE_CAP_THRESHOLD) {
                return false;
            }

            return true;
        });

        if (filteredPairs.length === 0) {
            showError('This AI Agent only analyzes MEMECOINS. This token appears to be a large-cap or is not listed on supported chains.');
            return;
        }

        // Get the best pair (highest liquidity)
        const bestPair = findBestPair(filteredPairs);

        // Aggregate data from all pairs
        const aggregated = aggregatePairData(filteredPairs);

        // Store current data
        currentTokenData = { pair: bestPair, aggregated };

        // Render the data
        renderTokenData(bestPair, aggregated);
        showResults();

        // Scroll to results
        resultsSection.scrollIntoView({ behavior: 'smooth' });

    } catch (error) {
        console.error('Analysis error:', error);
        showError('An error occurred while fetching data. Please try again.');
    }
}

// Event Listeners
searchForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const query = tokenInput.value.trim();

    // Validate input
    const validation = validateInput(query);
    if (!validation.valid) {
        showError(validation.error);
        return;
    }

    await analyzeToken(query);
});

// Handle input focus
tokenInput.addEventListener('focus', () => {
    errorState.classList.remove('active');
});

// Add some example tokens for easy testing
console.log('%c🤖 Crypto AI Agent Loaded', 'color: #00ff88; font-size: 16px; font-weight: bold;');
console.log('%cTry searching for: WIF, BONK, POPCAT, or any Solana memecoin ticker', 'color: #a0a0b0;');
