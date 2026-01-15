// ===========================================
// MEMERADAR - MAIN APPLICATION
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
    generateVerdict
} from './utils.js';
import { FreshPairsManager } from './freshPairs.js';
import { TrendingManager } from './trending.js';
import { DevChecker } from './devChecker.js';
import { URLRouter } from './router.js';

// Initialize API and modules
const api = new DexscreenerAPI();
const freshPairs = new FreshPairsManager();
const trending = new TrendingManager();
const devChecker = new DevChecker();
const router = new URLRouter();

// DOM Elements
const searchForm = document.getElementById('searchForm');
const tokenInput = document.getElementById('tokenInput');
const analyzeBtn = document.getElementById('analyzeBtn');
const loadingState = document.getElementById('loadingState');
const errorState = document.getElementById('errorState');
const errorMessage = document.getElementById('errorMessage');
const resultsSection = document.getElementById('resultsSection');
const trendingSection = document.getElementById('trendingSection');
const freshPairsList = document.getElementById('freshPairsList');
const shareBtn = document.getElementById('shareBtn');
const checkDevBtn = document.getElementById('checkDevBtn');
const copyAddressBtn = document.getElementById('copyAddressBtn');
const toast = document.getElementById('toast');

// Sidebar elements
const sidebar = document.getElementById('freshPairsSidebar');
const sidebarToggle = document.getElementById('sidebarToggle');
const sidebarRefresh = document.getElementById('sidebarRefresh');
const mobileSidebarBtn = document.getElementById('mobileSidebarBtn');

// State
let currentTokenData = null;

/**
 * Initialize the application
 */
function init() {
    // Initialize Fresh Pairs sidebar
    freshPairs.init(freshPairsList, (address) => {
        tokenInput.value = address;
        analyzeToken(address);
    });

    // Initialize trending section
    trending.init(trendingSection, (address) => {
        tokenInput.value = address;
        analyzeToken(address);
    });

    // Initialize URL router
    router.init((token) => {
        tokenInput.value = token;
        analyzeToken(token);
    });

    // Setup sidebar toggle
    setupSidebar();

    // Setup share button
    setupShareButton();

    // Setup dev check button
    setupDevCheckButton();

    // Setup copy address button
    setupCopyAddressButton();

    // Setup keyboard shortcuts
    setupKeyboardShortcuts();

    // Setup tab navigation
    setupTabs();
}

/**
 * Setup tab navigation
 */
function setupTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // This is a simplified version - tabs are visual only
            // All content stays visible for now
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Scroll to relevant section based on tab
            const tabName = btn.dataset.tab;
            let targetId = null;
            switch (tabName) {
                case 'overview': targetId = 'tokenCard'; break;
                case 'security': targetId = 'riskGauge'; break;
                case 'momentum': targetId = 'momentumScore'; break;
                case 'wallets': targetId = 'bubbleCanvas'; break;
            }
            if (targetId) {
                const el = document.getElementById(targetId);
                if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }
        });
    });
}

/**
 * Render wallet bubbles on canvas
 * @param {Object} risks - Risk analysis data
 */
function renderBubbleCanvas(risks) {
    const canvas = document.getElementById('bubbleCanvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Calculate holder percentages
    const top10Pct = risks.holderConcentration.level === 'HIGH' ? 60 :
        risks.holderConcentration.level === 'MEDIUM' ? 35 : 20;
    const top50Pct = 25;
    const othersPct = Math.max(0, 100 - top10Pct - top50Pct);

    // Generate bubbles based on holder distribution
    const bubbles = [];

    // Top 10 whales (large red bubbles)
    for (let i = 0; i < 8; i++) {
        const size = (top10Pct / 10) * (15 + Math.random() * 15);
        bubbles.push({
            x: 80 + Math.random() * 150,
            y: 60 + Math.random() * 180,
            r: Math.max(10, size),
            color: 'rgba(255, 68, 68, 0.7)',
            border: '#ff4444'
        });
    }

    // Top 11-50 holders (medium yellow bubbles)
    for (let i = 0; i < 15; i++) {
        const size = (top50Pct / 40) * (8 + Math.random() * 10);
        bubbles.push({
            x: 200 + Math.random() * 200,
            y: 50 + Math.random() * 200,
            r: Math.max(5, size),
            color: 'rgba(255, 170, 0, 0.6)',
            border: '#ffaa00'
        });
    }

    // Small holders (small green bubbles)
    for (let i = 0; i < 25; i++) {
        const size = (othersPct / 50) * (3 + Math.random() * 6);
        bubbles.push({
            x: 350 + Math.random() * 230,
            y: 40 + Math.random() * 220,
            r: Math.max(3, size),
            color: 'rgba(0, 255, 136, 0.5)',
            border: '#00ff88'
        });
    }

    // Draw connection lines between nearby bubbles
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let i = 0; i < bubbles.length; i++) {
        for (let j = i + 1; j < bubbles.length; j++) {
            const dist = Math.hypot(bubbles[i].x - bubbles[j].x, bubbles[i].y - bubbles[j].y);
            if (dist < 80) {
                ctx.beginPath();
                ctx.moveTo(bubbles[i].x, bubbles[i].y);
                ctx.lineTo(bubbles[j].x, bubbles[j].y);
                ctx.stroke();
            }
        }
    }

    // Draw bubbles
    bubbles.forEach(bubble => {
        ctx.beginPath();
        ctx.arc(bubble.x, bubble.y, bubble.r, 0, Math.PI * 2);
        ctx.fillStyle = bubble.color;
        ctx.fill();
        ctx.strokeStyle = bubble.border;
        ctx.lineWidth = 1;
        ctx.stroke();
    });

    // Add labels
    ctx.font = '11px JetBrains Mono';
    ctx.fillStyle = '#ff6666';
    ctx.fillText('WHALES', 60, 25);
    ctx.fillText(`~${top10Pct}%`, 60, 40);

    ctx.fillStyle = '#ffcc00';
    ctx.fillText('MID', 280, 25);
    ctx.fillText(`~${top50Pct}%`, 280, 40);

    ctx.fillStyle = '#00ff88';
    ctx.fillText('RETAIL', 480, 25);
    ctx.fillText(`~${othersPct}%`, 480, 40);
}

/**
 * Setup sidebar functionality
 */
function setupSidebar() {
    // Toggle sidebar on desktop
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
            sidebarToggle.querySelector('span').textContent =
                sidebar.classList.contains('collapsed') ? '▶' : '◀';
        });
    }

    // Mobile sidebar toggle
    if (mobileSidebarBtn) {
        mobileSidebarBtn.addEventListener('click', () => {
            sidebar.classList.toggle('mobile-open');
        });
    }

    // Refresh button
    if (sidebarRefresh) {
        sidebarRefresh.addEventListener('click', () => {
            freshPairs.refresh();
        });
    }

    // Close sidebar when clicking outside on mobile
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 768) {
            if (!sidebar.contains(e.target) && !mobileSidebarBtn.contains(e.target)) {
                sidebar.classList.remove('mobile-open');
            }
        }
    });
}

/**
 * Setup share button functionality
 */
function setupShareButton() {
    if (shareBtn) {
        shareBtn.addEventListener('click', async () => {
            const success = await router.copyShareLink();
            if (success) {
                showToast('Link copied! Share it on X 🚀');
            }
        });
    }
}

/**
 * Setup dev check button functionality
 */
function setupDevCheckButton() {
    if (checkDevBtn) {
        checkDevBtn.addEventListener('click', async () => {
            if (!currentTokenData) return;

            checkDevBtn.disabled = true;
            checkDevBtn.innerHTML = '⏳ Checking...';

            try {
                const analysis = await devChecker.analyzeDevWallet(
                    currentTokenData.pair.baseToken.address,
                    currentTokenData.pair.chainId
                );

                updateDevAnalysisUI(analysis);
            } catch (error) {
                console.error('Dev check error:', error);
            } finally {
                checkDevBtn.disabled = false;
                checkDevBtn.innerHTML = '🔍 Check Dev';
            }
        });
    }
}

/**
 * Setup copy address button functionality
 */
function setupCopyAddressButton() {
    if (copyAddressBtn) {
        copyAddressBtn.addEventListener('click', async () => {
            const address = document.getElementById('tokenAddress')?.textContent;
            if (!address || address === 'Contract Address') return;

            try {
                await navigator.clipboard.writeText(address);
                copyAddressBtn.classList.add('copied');
                copyAddressBtn.textContent = '✓';
                showToast('Contract address copied!');

                setTimeout(() => {
                    copyAddressBtn.classList.remove('copied');
                    copyAddressBtn.textContent = '📋';
                }, 2000);
            } catch (err) {
                console.error('Copy failed:', err);
            }
        });
    }
}

/**
 * Setup keyboard shortcuts for pro terminal feel
 */
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Don't trigger if typing in input
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            // Escape to blur input
            if (e.key === 'Escape') {
                e.target.blur();
            }
            return;
        }

        switch (e.key) {
            case '/':
                e.preventDefault();
                tokenInput.focus();
                break;
            case 'r':
            case 'R':
                e.preventDefault();
                if (currentTokenData) {
                    analyzeToken(currentTokenData.pair.baseToken.address);
                    showToast('Refreshing data...');
                } else {
                    freshPairs.refresh();
                    showToast('Refreshing fresh pairs...');
                }
                break;
            case 'Escape':
                tokenInput.value = '';
                tokenInput.blur();
                break;
        }
    });
}

/**
 * Update dev analysis UI with fetched data
 */
function updateDevAnalysisUI(analysis) {
    const devTrustEl = document.getElementById('devTrustScore');
    const devOtherCoins = document.getElementById('devOtherCoins');
    const devRugHistory = document.getElementById('devRugHistory');
    const devSuccessRate = document.getElementById('devSuccessRate');
    const deployerWallet = document.getElementById('deployerWallet');
    const devHistoryLink = document.getElementById('devHistoryLink');

    // Update badge
    if (analysis.badge) {
        const badgeColor = {
            positive: '#00ff88',
            warning: '#ffaa00',
            negative: '#ff4444'
        }[analysis.badgeClass] || '#ffaa00';

        devTrustEl.innerHTML = `<span class="dev-badge" style="color: ${badgeColor}; border-color: ${badgeColor};">${analysis.badge}</span>`;
    }

    // Update other fields
    if (analysis.deployerWallet) {
        deployerWallet.textContent = truncateAddress(analysis.deployerWallet, 6);
        if (devHistoryLink) {
            devHistoryLink.href = analysis.solscanLink || '#';
        }
    }

    if (analysis.otherTokens !== undefined) {
        devOtherCoins.textContent = analysis.otherTokens;
    }

    if (analysis.rugCount !== undefined) {
        devRugHistory.textContent = analysis.rugCount;
        if (analysis.rugCount !== 'Unknown' && parseInt(analysis.rugCount) > 0) {
            devRugHistory.classList.add('negative');
        }
    }

    if (analysis.successRate !== undefined) {
        devSuccessRate.textContent = analysis.successRate;
    }

    // Show message if available
    if (analysis.message) {
        showToast(analysis.message);
    }
}

/**
 * Show toast notification
 */
function showToast(message) {
    if (!toast) return;

    const toastMessage = document.getElementById('toastMessage');
    if (toastMessage) {
        toastMessage.textContent = message;
    }

    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

/**
 * Show loading state
 */
function showLoading() {
    loadingState.classList.add('active');
    errorState.classList.remove('active');
    resultsSection.classList.remove('active');
    trendingSection.style.display = 'none';
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
    trendingSection.style.display = 'block';
}

/**
 * Show results
 */
function showResults() {
    hideLoading();
    errorState.classList.remove('active');
    resultsSection.classList.add('active');
    trendingSection.style.display = 'none';
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
 * Update evidence badges with specific data
 * @param {Object} pair - Token pair data
 * @param {Object} risks - Risk analysis
 */
function updateEvidenceBadges(pair, risks) {
    const liquidity = pair.liquidity?.usd || 0;
    const pairAge = pair.pairCreatedAt ? Math.floor((Date.now() - pair.pairCreatedAt) / (1000 * 60 * 60 * 24)) : 0;

    // LP Badge
    const lpBadge = document.getElementById('evidenceLp');
    if (lpBadge) {
        const lpText = liquidity >= 100000 ? `LP: ${formatCurrency(liquidity)}` :
            liquidity >= 10000 ? `LP: ${formatCurrency(liquidity)}` :
                `LP: ${formatCurrency(liquidity)}`;
        lpBadge.textContent = lpText;
        lpBadge.classList.remove('safe', 'warning', 'danger');
        lpBadge.classList.add(liquidity >= 50000 ? 'safe' : liquidity >= 10000 ? 'warning' : 'danger');
    }

    // Top 10 Holders Badge
    const holdersBadge = document.getElementById('evidenceHolders');
    if (holdersBadge) {
        const top10Pct = risks.holderConcentration.level === 'HIGH' ? 60 :
            risks.holderConcentration.level === 'MEDIUM' ? 35 : 20;
        holdersBadge.textContent = `Top10: ~${top10Pct}%`;
        holdersBadge.classList.remove('safe', 'warning', 'danger');
        holdersBadge.classList.add(top10Pct <= 20 ? 'safe' : top10Pct <= 40 ? 'warning' : 'danger');
    }

    // Dev Badge
    const devBadge = document.getElementById('evidenceDev');
    if (devBadge) {
        devBadge.textContent = 'Dev: Check';
        devBadge.classList.remove('safe', 'warning', 'danger');
        devBadge.classList.add('warning');
    }

    // Age Badge
    const ageBadge = document.getElementById('evidenceAge');
    if (ageBadge) {
        let ageText = pairAge < 1 ? 'Age: <1d' :
            pairAge < 7 ? `Age: ${pairAge}d` :
                pairAge < 30 ? `Age: ${Math.floor(pairAge / 7)}w` :
                    `Age: ${Math.floor(pairAge / 30)}m`;
        ageBadge.textContent = ageText;
        ageBadge.classList.remove('safe', 'warning', 'danger');
        ageBadge.classList.add(pairAge >= 14 ? 'safe' : pairAge >= 3 ? 'warning' : 'danger');
    }
}

/**
 * Update status badge at top of token card
 * @param {string} strength - Verdict strength
 * @param {Object} risks - Risk analysis
 */
function updateStatusBadge(strength, risks) {
    const badge = document.getElementById('statusBadge');
    if (!badge) return;

    badge.classList.remove('bullish', 'neutral', 'danger');

    // Determine status based on multiple factors
    const riskScore = risks.overall.score;

    if (strength === 'Strong' && riskScore <= 4) {
        badge.textContent = '🟢 BULLISH';
        badge.classList.add('bullish');
    } else if (strength === 'Weak' || riskScore >= 7) {
        badge.textContent = '🔴 DANGER';
        badge.classList.add('danger');
    } else {
        badge.textContent = '🟡 CAUTION';
        badge.classList.add('neutral');
    }
}

/**
 * Render token data to UI
 * @param {Object} pair - Best trading pair data
 * @param {Object} aggregated - Aggregated data from all pairs
 */
function renderTokenData(pair, aggregated) {
    const token = pair.baseToken;

    // Update URL with token info
    router.updateURL(token.address, token.name, token.symbol);

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

    setElementText('totalSupply', 'See Solscan');

    // 3. On-Chain & Trading Metrics
    const buys = pair.txns?.h24?.buys || 0;
    const sells = pair.txns?.h24?.sells || 0;
    const totalTxns = aggregated?.totalBuys24h + aggregated?.totalSells24h || buys + sells;

    setElementText('txCount24h', formatNumber(totalTxns));
    setElementText('buys24h', formatNumber(aggregated?.totalBuys24h || buys));
    setElementText('sells24h', formatNumber(aggregated?.totalSells24h || sells));

    const ratio = sells > 0 ? (buys / sells).toFixed(2) : buys.toString();
    setElementText('buySellRatio', ratio);

    // Liquidity Lock Detection - provide clear Yes/No answer
    const liquidityLockEl = document.getElementById('liquidityLock');
    const liquidity = pair.liquidity?.usd || 0;
    const pairAge = pair.pairCreatedAt ? Math.floor((Date.now() - pair.pairCreatedAt) / (1000 * 60 * 60 * 24)) : 0;

    // Heuristics for lock detection:
    // - High liquidity (>$50k) + old pair (>30 days) = likely locked
    // - Very new (<3 days) with high liquidity = likely locked (launched properly)
    // - Low liquidity (<$10k) = likely NOT locked (high rug risk)
    // - Check for common lock indicators in pair info
    let lockStatus = 'VERIFY ⚠️';
    let lockClass = 'warning';

    if (liquidity >= 100000 && pairAge >= 30) {
        lockStatus = 'LIKELY LOCKED ✅';
        lockClass = 'positive';
    } else if (liquidity >= 50000 && pairAge >= 14) {
        lockStatus = 'PROBABLY LOCKED ✅';
        lockClass = 'positive';
    } else if (liquidity < 10000) {
        lockStatus = 'NOT LOCKED ❌';
        lockClass = 'negative';
    } else if (pairAge < 3) {
        lockStatus = 'TOO NEW - VERIFY ⚠️';
        lockClass = 'warning';
    } else {
        lockStatus = 'VERIFY ON SOLSCAN ⚠️';
        lockClass = 'warning';
    }

    liquidityLockEl.textContent = lockStatus;
    liquidityLockEl.classList.remove('positive', 'negative', 'warning');
    liquidityLockEl.classList.add(lockClass);

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

    // 5. 24-Hour Momentum Score
    renderMomentumScore(pair, sentiment);

    // 6. Risk Analysis - calculate first so we can use in Trust vs Hype
    const risks = calculateRiskAnalysis(pair);

    // Trust vs Hype Analysis
    renderTrustVsHype(pair, sentiment, risks);

    // Overall risk score with gauge needle animation
    const riskScoreEl = document.getElementById('overallRiskScore');
    riskScoreEl.textContent = `${risks.overall.score}/10`;
    riskScoreEl.style.color = RISK_LEVELS[risks.overall.level].color;

    // Animate the risk gauge needle (-90deg = 0, 0deg = 5, 90deg = 10)
    const riskNeedle = document.getElementById('riskNeedle');
    if (riskNeedle) {
        const rotation = -90 + (risks.overall.score * 18); // 18 degrees per point
        riskNeedle.style.transform = `translateX(-50%) rotate(${rotation}deg)`;
    }

    // Update evidence badges with specific data
    updateEvidenceBadges(pair, risks);

    // Render interactive wallet bubble canvas
    renderBubbleCanvas(risks);

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

    // Update status badge at top
    updateStatusBadge(verdict.strength, risks);

    // ========== ADVANCED FEATURES ==========

    // 8. Wallet Cluster Analysis
    renderWalletAnalysis(pair, token, risks);

    // 9. Social Pulse
    renderSocialPulse(pair, sentiment);

    // 10. Developer Analysis
    renderDevAnalysis(pair, token);

    // 11. Smart Money
    renderSmartMoney(pair, sentiment);
}

/**
 * Render 24-Hour Momentum Score
 */
function renderMomentumScore(pair, sentiment) {
    // Calculate momentum score (0-100)
    const volume24h = pair.volume?.h24 || 0;
    const txns24h = (pair.txns?.h24?.buys || 0) + (pair.txns?.h24?.sells || 0);
    const buys = pair.txns?.h24?.buys || 0;
    const sells = pair.txns?.h24?.sells || 0;
    const priceChange = pair.priceChange?.h24 || 0;

    // Score components
    let volumeScore = Math.min(30, Math.log10(volume24h + 1) * 5);
    let txScore = Math.min(25, Math.log10(txns24h + 1) * 8);
    let buyPressureScore = sells > 0 ? Math.min(25, (buys / sells) * 10) : 15;
    let momentumScore = priceChange > 0 ? Math.min(20, priceChange * 0.5) : Math.max(-10, priceChange * 0.3);

    let totalScore = Math.round(Math.max(0, Math.min(100, volumeScore + txScore + buyPressureScore + momentumScore + 25)));

    // Update UI
    document.getElementById('momentumScore').textContent = totalScore;
    document.getElementById('momentumIndicator').style.left = `${totalScore}%`;

    // Momentum label
    let label = 'WEAK';
    let color = '#ff4444';
    if (totalScore >= 70) { label = 'STRONG 🚀'; color = '#00ff88'; }
    else if (totalScore >= 50) { label = 'MODERATE'; color = '#ffaa00'; }
    else if (totalScore >= 30) { label = 'WEAK'; color = '#ff8844'; }
    else { label = 'VERY WEAK 📉'; color = '#ff4444'; }

    const labelEl = document.getElementById('momentumLabel');
    labelEl.textContent = label;
    labelEl.style.color = color;
    document.getElementById('momentumScore').style.color = color;

    // Volume surge
    const volumeChange = pair.volume?.h24 && pair.volume?.h6 ?
        Math.round(((pair.volume.h24 / 4) / (pair.volume.h6 || 1) - 1) * 100) : 0;
    const surgEl = document.getElementById('volumeSurge');
    surgEl.textContent = volumeChange >= 0 ? `+${volumeChange}%` : `${volumeChange}%`;
    surgEl.classList.remove('positive', 'negative');
    surgEl.classList.add(volumeChange >= 0 ? 'positive' : 'negative');

    // Buy pressure
    const ratio = sells > 0 ? buys / sells : buys;
    const pressureEl = document.getElementById('buyPressure');
    pressureEl.textContent = ratio > 1.5 ? 'Strong Buy' : ratio < 0.7 ? 'Sell Heavy' : 'Neutral';
    pressureEl.classList.remove('positive', 'negative', 'warning');
    pressureEl.classList.add(ratio > 1.5 ? 'positive' : ratio < 0.7 ? 'negative' : 'warning');

    // Whale activity
    setElementText('momentumWhales', sentiment.whaleActivity);

    // Momentum Strength (renamed from Moon Probability)
    const strengthEl = document.getElementById('momentumStrength');
    const strengthText = totalScore >= 70 ? 'Strong' : totalScore >= 50 ? 'Moderate' : 'Weak';
    strengthEl.textContent = strengthText;
    strengthEl.classList.remove('positive', 'negative', 'warning');
    strengthEl.classList.add(strengthText === 'Strong' ? 'positive' : strengthText === 'Weak' ? 'negative' : 'warning');
}

/**
 * Render Trust vs Hype Analysis
 */
function renderTrustVsHype(pair, sentiment, risks) {
    // THE TRUTH (Left side)
    // Dev Success History - based on token age (older = more trustworthy)
    const devSuccessEl = document.getElementById('trustDevSuccess');
    if (pair.chainId === 'solana') {
        devSuccessEl.textContent = 'Click "Check Dev" →';
        devSuccessEl.classList.add('warning');
    } else {
        devSuccessEl.textContent = 'Check Explorer →';
        devSuccessEl.classList.add('warning');
    }
    setElementText('trustRenounced', pair.chainId === 'solana' ? 'N/A (Solana)' : 'Check Explorer');

    const top10Pct = risks.holderConcentration.level === 'HIGH' ? 60 :
        risks.holderConcentration.level === 'MEDIUM' ? 35 : 20;
    const top10El = document.getElementById('trustTop10');
    top10El.textContent = `~${top10Pct}%`;
    top10El.classList.remove('positive', 'negative', 'warning');
    top10El.classList.add(top10Pct > 50 ? 'negative' : top10Pct > 30 ? 'warning' : 'positive');

    // Token age
    const pairCreatedAt = pair.pairCreatedAt;
    if (pairCreatedAt) {
        const ageDays = Math.floor((Date.now() - pairCreatedAt) / (1000 * 60 * 60 * 24));
        let ageText = ageDays < 1 ? '< 1 day ⚠️' : ageDays < 7 ? `${ageDays} days` :
            ageDays < 30 ? `${Math.floor(ageDays / 7)} weeks` : `${Math.floor(ageDays / 30)} months`;
        const ageEl = document.getElementById('trustAge');
        ageEl.textContent = ageText;
        ageEl.classList.remove('positive', 'negative', 'warning');
        ageEl.classList.add(ageDays < 3 ? 'negative' : ageDays < 14 ? 'warning' : 'positive');
    }

    // THE HYPE (Right side)
    const socialLinks = pair.info?.socials || [];
    const socialCount = socialLinks.length + (pair.info?.websites?.length || 0);
    setElementText('hypeSocial', socialCount > 0 ? `${socialCount} links` : 'None found');

    // Volume trend
    const hypeVolEl = document.getElementById('hypeVolume');
    hypeVolEl.textContent = sentiment.volumeTrend;
    hypeVolEl.classList.remove('positive', 'negative', 'warning');
    hypeVolEl.classList.add(sentiment.volumeTrend === 'Increasing' ? 'positive' :
        sentiment.volumeTrend === 'Decreasing' ? 'negative' : 'warning');

    // AI Sentiment
    const sentimentEl = document.getElementById('hypeSentiment');
    sentimentEl.textContent = sentiment.trendDirection;
    sentimentEl.classList.remove('positive', 'negative', 'warning');
    sentimentEl.classList.add(sentiment.trendDirection === 'Bullish' ? 'positive' :
        sentiment.trendDirection === 'Bearish' ? 'negative' : 'warning');

    // Hype score (reuse calculation)
    const volume24h = pair.volume?.h24 || 0;
    const txns24h = (pair.txns?.h24?.buys || 0) + (pair.txns?.h24?.sells || 0);
    let hypeScore = Math.min(100, Math.round((Math.log10(volume24h + 1) * 10) + (Math.log10(txns24h + 1) * 15)));
    const hypeScoreEl = document.getElementById('hypeScoreSmall');
    hypeScoreEl.textContent = `${hypeScore}/100`;
    hypeScoreEl.classList.remove('positive', 'negative', 'warning');
    hypeScoreEl.classList.add(hypeScore >= 70 ? 'positive' : hypeScore >= 40 ? 'warning' : 'negative');
}

/**
 * Render Wallet Cluster Analysis (Feature 8)
 */
function renderWalletAnalysis(pair, token, risks) {
    // Estimate holder distribution based on risk metrics
    const top10Pct = risks.holderConcentration.level === 'HIGH' ? 60 :
        risks.holderConcentration.level === 'MEDIUM' ? 35 : 20;
    const top50Pct = 25;
    const othersPct = 100 - top10Pct - top50Pct;

    setElementText('top10Holders', `~${top10Pct}% of supply`);
    setRiskClass('top10Holders', risks.holderConcentration.level);

    const whaleConc = risks.holderConcentration.level === 'HIGH' ? 'High Risk' :
        risks.holderConcentration.level === 'MEDIUM' ? 'Moderate' : 'Decentralized';
    setElementText('whaleConcentration', whaleConc);
    setRiskClass('whaleConcentration', risks.holderConcentration.level);

    const clusterRisk = risks.rugPull.level === 'HIGH' ? 'Cabal Likely' :
        risks.rugPull.level === 'MEDIUM' ? 'Monitor' : 'Low Risk';
    setElementText('clusterRisk', clusterRisk);
    setRiskClass('clusterRisk', risks.rugPull.level);

    // Update holder distribution bar
    document.getElementById('holderBar1').style.width = `${top10Pct}%`;
    document.getElementById('holderBar2').style.width = `${top50Pct}%`;
    document.getElementById('holderBar3').style.width = `${othersPct}%`;

    setElementText('top10Pct', `${top10Pct}%`);
    setElementText('top50Pct', `${top50Pct}%`);
    setElementText('othersPct', `${othersPct}%`);

    // External links
    const bubblemapsLink = document.getElementById('bubblemapsLink');
    bubblemapsLink.href = `${CONFIG.EXTERNAL.BUBBLEMAPS}/${pair.chainId}/token/${token.address}`;

    const holdersLink = document.getElementById('holdersLink');
    holdersLink.href = getExplorerHoldersLink(pair.chainId, token.address);
}

/**
 * Render Social Pulse (Feature 9)
 */
function renderSocialPulse(pair, sentiment) {
    // Calculate hype score based on trading activity
    const volume24h = pair.volume?.h24 || 0;
    const txns24h = (pair.txns?.h24?.buys || 0) + (pair.txns?.h24?.sells || 0);
    const priceChange = Math.abs(pair.priceChange?.h24 || 0);

    // Hype score formula (0-100)
    let hypeScore = Math.min(100, Math.round(
        (Math.log10(volume24h + 1) * 10) +
        (Math.log10(txns24h + 1) * 15) +
        (priceChange * 0.5)
    ));
    hypeScore = Math.max(0, hypeScore);

    document.getElementById('hypeScore').innerHTML =
        `${hypeScore}<span style="font-size: 1.5rem; color: var(--text-muted);">/100</span>`;
    document.getElementById('hypeMeterFill').style.width = `${hypeScore}%`;

    // Color based on score
    const hypeColor = hypeScore >= 70 ? '#00ff88' : hypeScore >= 40 ? '#ffaa00' : '#ff4444';
    document.getElementById('hypeScore').style.color = hypeColor;

    // Volume spike detection
    const volumeSpike = sentiment.volumeTrend === 'Increasing' ? '🔥 Spiking' :
        sentiment.volumeTrend === 'Decreasing' ? '📉 Declining' : 'Normal';
    setElementText('volumeSpike', volumeSpike);

    // Transaction velocity
    const txVelocity = txns24h > 1000 ? '⚡ Very High' :
        txns24h > 200 ? 'High' :
            txns24h > 50 ? 'Moderate' : 'Low';
    setElementText('txVelocity', txVelocity);

    // Social links from Dexscreener
    const socialContainer = document.getElementById('socialLinks');
    const links = pair.info?.socials || [];
    const website = pair.info?.websites?.[0];

    if (links.length > 0 || website) {
        let socialHtml = '';
        if (website) {
            socialHtml += `<a href="${website.url}" target="_blank" class="social-link">🌐 Website</a>`;
        }
        links.forEach(link => {
            const icon = link.type === 'twitter' ? '𝕏' :
                link.type === 'telegram' ? '📱' : '🔗';
            socialHtml += `<a href="${link.url}" target="_blank" class="social-link">${icon} ${link.type}</a>`;
        });
        socialContainer.innerHTML = socialHtml;
    } else {
        socialContainer.innerHTML = '<span class="verdict-tag" style="opacity: 0.5;">No social links found</span>';
    }
}

/**
 * Render Developer Analysis (Feature 10)
 */
function renderDevAnalysis(pair, token) {
    // Pair creation time
    const pairCreatedAt = pair.pairCreatedAt;
    if (pairCreatedAt) {
        const createdDate = new Date(pairCreatedAt);
        const now = new Date();
        const ageMs = now - createdDate;
        const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));

        let ageText = '';
        if (ageDays < 1) ageText = '< 1 day (NEW!)';
        else if (ageDays < 7) ageText = `${ageDays} days`;
        else if (ageDays < 30) ageText = `${Math.floor(ageDays / 7)} weeks`;
        else if (ageDays < 365) ageText = `${Math.floor(ageDays / 30)} months`;
        else ageText = `${Math.floor(ageDays / 365)} years`;

        setElementText('tokenAge', ageText);
        setElementText('pairCreated', createdDate.toLocaleDateString());

        // Tokens under 3 days old are higher risk
        const tokenAgeEl = document.getElementById('tokenAge');
        if (ageDays < 3) {
            tokenAgeEl.classList.add('negative');
        } else if (ageDays < 14) {
            tokenAgeEl.classList.add('warning');
        } else {
            tokenAgeEl.classList.add('positive');
        }
    } else {
        setElementText('tokenAge', 'Unknown');
        setElementText('pairCreated', 'Unknown');
    }

    // Deployer wallet (will be populated by dev check)
    setElementText('deployerWallet', 'Click "Check Dev"');

    // Reset dev check fields
    const devTrustEl = document.getElementById('devTrustScore');
    devTrustEl.innerHTML = '<span class="dev-badge" style="color: #ffaa00; border-color: #ffaa00;">Click Check Dev</span>';

    setElementText('devOtherCoins', 'Click "Check Dev"');
    setElementText('devRugHistory', 'Click "Check Dev"');
    setElementText('devSuccessRate', 'Click "Check Dev"');

    // Dev history links to explorer
    const devHistoryLink = document.getElementById('devHistoryLink');
    devHistoryLink.href = getExplorerLink(pair.chainId, pair.pairAddress);

    // Dev other tokens link
    const devTokensLink = document.getElementById('devTokensLink');
    devTokensLink.href = getExplorerTokensLink(pair.chainId, token.address);

    // Pump.fun link (Solana only) - link to token page which shows creator
    const pumpfunLink = document.getElementById('pumpfunLink');
    if (pair.chainId === 'solana') {
        // Use pump.fun token page which shows creator info and their other coins
        pumpfunLink.href = `https://pump.fun/coin/${token.address}`;
        pumpfunLink.style.display = 'inline-flex';
    } else {
        // Hide Pump.fun button for non-Solana tokens
        pumpfunLink.style.display = 'none';
    }
}

/**
 * Render Smart Money / Top Traders (Feature 11)
 */
function renderSmartMoney(pair, sentiment) {
    const buys = pair.txns?.h24?.buys || 0;
    const sells = pair.txns?.h24?.sells || 0;

    // Estimate large transactions (rough heuristic)
    const largeBuys = Math.floor(buys * 0.1); // Assume 10% are "large"
    const largeSells = Math.floor(sells * 0.1);

    setElementText('largeBuys', formatNumber(largeBuys));
    setElementText('largeSells', formatNumber(largeSells));

    // Whale trend
    const whaleTrend = sentiment.whaleActivity === 'Accumulation' ? '📈 Buying' :
        sentiment.whaleActivity === 'Distribution' ? '📉 Selling' : '➡️ Neutral';
    setElementText('whaleTrend', whaleTrend);
    setRiskClass('whaleTrend',
        sentiment.whaleActivity === 'Accumulation' ? 'LOW' :
            sentiment.whaleActivity === 'Distribution' ? 'HIGH' : 'MEDIUM'
    );

    // Smart money signal
    const ratio = sells > 0 ? buys / sells : buys;
    const signal = ratio > 1.5 ? '🟢 Bullish' :
        ratio < 0.7 ? '🔴 Bearish' : '🟡 Mixed';
    setElementText('smartMoneySignal', signal);

    // Fresh Wallets indicator (estimate based on buy/sell pattern)
    const freshWalletsEl = document.getElementById('freshWallets');
    const freshWalletIndicator = buys > sells * 1.3 ? 'Active 🔥' :
        buys > sells ? 'Some Activity' : 'Low Activity';
    freshWalletsEl.textContent = freshWalletIndicator;
    freshWalletsEl.classList.remove('positive', 'negative', 'warning');
    freshWalletsEl.classList.add(buys > sells * 1.3 ? 'positive' : buys > sells ? 'warning' : 'negative');

    // Inflow Signal (combine multiple factors)
    const inflowEl = document.getElementById('inflowSignal');
    const priceUp = (pair.priceChange?.h24 || 0) > 0;
    const volumeHigh = (pair.volume?.h24 || 0) > 100000;
    const buyPressure = ratio > 1.2;
    const inflowScore = (priceUp ? 1 : 0) + (volumeHigh ? 1 : 0) + (buyPressure ? 1 : 0);
    const inflowText = inflowScore >= 3 ? '🚀 Strong Inflow' :
        inflowScore >= 2 ? '📈 Moderate Inflow' :
            inflowScore >= 1 ? '➡️ Neutral' : '📉 Outflow';
    inflowEl.textContent = inflowText;
    inflowEl.classList.remove('positive', 'negative', 'warning');
    inflowEl.classList.add(inflowScore >= 3 ? 'positive' : inflowScore <= 0 ? 'negative' : 'warning');

    // External links
    const token = pair.baseToken;
    document.getElementById('birdeyeLink').href =
        `${CONFIG.EXTERNAL.BIRDEYE}/${token.address}?chain=${pair.chainId}`;
    document.getElementById('topTradersLink').href =
        `${CONFIG.EXTERNAL.DEXSCREENER}/${pair.chainId}/${pair.pairAddress}`;
}

/**
 * Get explorer link for a given chain and address
 */
function getExplorerLink(chainId, address) {
    switch (chainId) {
        case 'solana': return `${CONFIG.EXTERNAL.SOLSCAN}/account/${address}`;
        case 'ethereum': return `${CONFIG.EXTERNAL.ETHERSCAN}/address/${address}`;
        case 'bsc': return `${CONFIG.EXTERNAL.BSCSCAN}/address/${address}`;
        default: return `${CONFIG.EXTERNAL.DEXSCREENER}/${chainId}/${address}`;
    }
}

/**
 * Get explorer holders link
 */
function getExplorerHoldersLink(chainId, tokenAddress) {
    switch (chainId) {
        case 'solana': return `${CONFIG.EXTERNAL.SOLSCAN}/token/${tokenAddress}#holders`;
        case 'ethereum': return `${CONFIG.EXTERNAL.ETHERSCAN}/token/${tokenAddress}#balances`;
        case 'bsc': return `${CONFIG.EXTERNAL.BSCSCAN}/token/${tokenAddress}#balances`;
        default: return `${CONFIG.EXTERNAL.DEXSCREENER}/${chainId}/${tokenAddress}`;
    }
}

/**
 * Get explorer tokens link for dev wallet
 */
function getExplorerTokensLink(chainId, tokenAddress) {
    switch (chainId) {
        case 'solana': return `${CONFIG.EXTERNAL.SOLSCAN}/token/${tokenAddress}#txs`;
        case 'ethereum': return `${CONFIG.EXTERNAL.ETHERSCAN}/token/${tokenAddress}`;
        case 'bsc': return `${CONFIG.EXTERNAL.BSCSCAN}/token/${tokenAddress}`;
        default: return `${CONFIG.EXTERNAL.DEXSCREENER}/${chainId}/${tokenAddress}`;
    }
}

/**
 * Analyze a token
 * @param {string} query - Token ticker or address
 */
async function analyzeToken(query) {
    showLoading();

    try {
        // Search for the token
        let result = await api.searchToken(query);

        // If no results and query looks like a contract address, try direct lookup
        if ((!result.pairs || result.pairs.length === 0) && query.length >= 32) {
            console.log('Search failed, trying direct contract lookup on Solana...');
            try {
                // Try Solana token pairs endpoint directly
                const directResult = await api.getTokenPairs('solana', query);
                if (directResult && Array.isArray(directResult) && directResult.length > 0) {
                    result = { pairs: directResult };
                }
            } catch (directError) {
                console.log('Direct lookup also failed:', directError.message);
            }
        }

        if (!result.pairs || result.pairs.length === 0) {
            showError('❌ Token not found. This may be a very new launch not yet indexed. Try again in a few minutes or verify the contract address.');
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

// Initialize app
init();

// CRITICAL: Direct hash check - this GUARANTEES deep linking works
function checkHashAndLoad() {
    const hash = window.location.hash;
    console.log('[HASH CHECK] Current hash:', hash);

    if (hash && hash.length > 1) {
        const tokenAddress = hash.substring(1).replace('token=', '');
        console.log('[HASH CHECK] Token address extracted:', tokenAddress);

        // Only auto-load if it looks like a valid contract address (32+ chars)
        if (tokenAddress.length >= 32) {
            console.log('[HASH CHECK] Valid address, triggering analyze...');
            tokenInput.value = tokenAddress;
            analyzeToken(tokenAddress);
        }
    }
}

// Run hash check on multiple events to ensure it works
window.addEventListener('load', () => {
    console.log('[HASH CHECK] Window load event');
    setTimeout(checkHashAndLoad, 500);
});

// Also check hash immediately after a short delay
setTimeout(checkHashAndLoad, 800);

// Handle hash changes (when someone changes the URL)
window.addEventListener('hashchange', () => {
    console.log('[HASH CHECK] Hash changed!');
    checkHashAndLoad();
});

// Add some example tokens for easy testing
console.log('%c🤖 MemeRadar Loaded', 'color: #00ff88; font-size: 16px; font-weight: bold;');
console.log('%cTry searching for: WIF, BONK, POPCAT, or any Solana memecoin ticker', 'color: #a0a0b0;');
console.log('%cDeep linking enabled - share URLs with #ContractAddress', 'color: #a0a0b0;');

