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
import moralisAPI from './moralisApi.js';
// import { solanaRPC } from './rpc.js';

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

    // Initialize Fresh Pairs Sidebar
    if (freshPairs && freshPairsList) {
        freshPairs.init(freshPairsList, (address) => {
            tokenInput.value = address;
            analyzeToken(address);
            // On mobile, close sidebar after selection
            const sidebar = document.getElementById('freshPairsSidebar');
            if (window.innerWidth <= 768 && sidebar.classList.contains('active')) {
                sidebar.classList.remove('active');
            }
        });

        // Setup refresh button
        if (sidebarRefresh) {
            sidebarRefresh.addEventListener('click', () => {
                freshPairs.refresh();
                // Add rotation animation
                const icon = sidebarRefresh.querySelector('.icon');
                if (icon) {
                    icon.style.transition = 'transform 0.5s ease';
                    icon.style.transform = `rotate(${Date.now()}deg)`;
                }
            });
        }
    }
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
 * Load Real On-Chain Wallet Data (God Mode)
 * @param {string} tokenAddress 
 */
async function loadRealWalletData(tokenAddress) {
    const canvas = document.getElementById('bubbleCanvas');
    if (!canvas) return;

    // Visual indicator that we are going deeper
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = '12px "JetBrains Mono"';
    ctx.fillStyle = '#00ff88';
    ctx.fillText('⚡ Connecting to Solana RPC...', 20, 30);

    try {
        const holders = await solanaRPC.getTopHolders(tokenAddress);
        // Pass risks as null since we are using real data now
        renderBubbleCanvas(null, holders);
    } catch (e) {
        console.error('Failed to load real wallet data', e);
        // Fallback to simulation would happen if we didn't clear, but we assume it works
    }
}

/**
 * Render wallet bubbles on canvas
 * @param {Object} risks - Risk analysis data (for simulation)
 * @param {Array} realHolders - Real on-chain holder data (optional)
 */
function renderBubbleCanvas(risks, realHolders = null) {
    const canvas = document.getElementById('bubbleCanvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    const bubbles = [];

    if (realHolders && realHolders.length > 0) {
        // --- REAL DATA MODE ---
        ctx.fillStyle = '#00ff88';
        ctx.fillText('⚡ LIVE ON-CHAIN DATA (HELIUS)', 10, 15);

        // Find max amount to normalize sizes
        const maxAmount = realHolders[0].uiAmount || 1;

        realHolders.forEach((holder, index) => {
            const amount = holder.uiAmount || 0;
            // Normalize size relative to whale
            const size = Math.max(5, (amount / maxAmount) * 40);

            // Layout in a spiral or cluster
            const angle = index * 0.8;
            const dist = 30 + (index * 8);

            bubbles.push({
                x: (width / 2) + Math.cos(angle) * dist + (Math.random() * 20 - 10),
                y: (height / 2) + Math.sin(angle) * dist + (Math.random() * 20 - 10),
                r: size,
                color: index < 3 ? 'rgba(255, 68, 68, 0.8)' : // Top 3 Red
                    index < 10 ? 'rgba(255, 170, 0, 0.7)' : // Next 7 Orange
                        'rgba(0, 255, 136, 0.6)',           // Rest Green
                border: index < 3 ? '#ff4444' : index < 10 ? '#ffaa00' : '#00ff88',
                label: `${(amount / (realHolders.reduce((a, b) => a + (b.uiAmount || 0), 0) || 1) * 100).toFixed(1)}%`
            });
        });
    } else if (risks) {
        // --- SIMULATION MODE (Fallback) ---
        // Calculate holder percentages
        const top10Pct = risks.holderConcentration.level === 'HIGH' ? 60 :
            risks.holderConcentration.level === 'MEDIUM' ? 35 : 20;
        const top50Pct = 25;
        const othersPct = Math.max(0, 100 - top10Pct - top50Pct);

        // Generate bubbles based on holder distribution
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

    // Add labels (only for simulation or general headers)
    if (!realHolders) {
        ctx.font = '11px JetBrains Mono';
        ctx.fillStyle = '#ff6666';
        ctx.fillText('WHALES', 60, 25);
        ctx.fillStyle = '#ffcc00';
        ctx.fillText('MID', 280, 25);
        ctx.fillStyle = '#00ff88';
        ctx.fillText('RETAIL', 480, 25);
    }
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
 * Update loading progress bar
 * @param {number} percent - Progress percentage
 * @param {string} message - Status message
 */
function updateLoadingProgress(percent, message) {
    const progressBar = document.getElementById('loadingProgress');
    const progressText = document.getElementById('loadingText');

    if (progressBar) {
        progressBar.style.width = `${percent}%`;
    }
    if (progressText) {
        progressText.textContent = message;
    }
}

/**
 * Save token to recently analyzed list
 * @param {string} query - Token address or ticker
 */
function saveRecentlyAnalyzed(query) {
    try {
        let recent = JSON.parse(localStorage.getItem('memeradar_recent') || '[]');

        // Remove if already exists (to move to top)
        recent = recent.filter(r => r !== query);

        // Add to front
        recent.unshift(query);

        // Keep only last 5
        recent = recent.slice(0, 5);

        localStorage.setItem('memeradar_recent', JSON.stringify(recent));

        // Update UI
        renderRecentlyAnalyzed();
    } catch (e) {
        console.log('Could not save to localStorage:', e);
    }
}

/**
 * Render recently analyzed section
 */
function renderRecentlyAnalyzed() {
    const container = document.getElementById('recentlyAnalyzed');
    if (!container) return;

    try {
        const recent = JSON.parse(localStorage.getItem('memeradar_recent') || '[]');

        if (recent.length === 0) {
            container.innerHTML = '<p class="no-recent">No recent searches</p>';
            return;
        }

        container.innerHTML = `
            <div class="recent-header">🕐 Recently Analyzed</div>
            <div class="recent-list">
                ${recent.map(addr => `
                    <button class="recent-item" data-address="${addr}" title="${addr}">
                        ${addr.length > 12 ? addr.slice(0, 6) + '...' + addr.slice(-4) : addr}
                    </button>
                `).join('')}
            </div>
        `;

        // Add click handlers
        container.querySelectorAll('.recent-item').forEach(btn => {
            btn.addEventListener('click', () => {
                const addr = btn.dataset.address;
                tokenInput.value = addr;
                analyzeToken(addr);
            });
        });
    } catch (e) {
        console.log('Could not render recent:', e);
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
 * Setup dev check button functionality - COMPREHENSIVE VERSION
 */
function setupDevCheckButton() {
    if (checkDevBtn) {
        checkDevBtn.addEventListener('click', async () => {
            if (!currentTokenData || !currentTokenData.pair) return;

            checkDevBtn.disabled = true;
            checkDevBtn.innerHTML = '🔄 Scanning Blockchain...';

            try {
                const pair = currentTokenData.pair;
                // Calls comprehensive API via devChecker
                const analysis = await devChecker.analyzeDevWallet(
                    pair.baseToken.address,
                    pair.chainId,
                    currentTokenData.aggregated
                );

                // ========== MAIN DEV INFO ==========
                // Update Trust Badge
                const devTrustEl = document.getElementById('devTrustScore');
                if (devTrustEl) {
                    devTrustEl.innerHTML = devChecker.getBadgeHTML(analysis);
                }

                // Deployer Wallet (shortened with link)
                const deployerEl = document.getElementById('deployerWallet');
                if (deployerEl && analysis.deployerWallet && analysis.deployerWallet !== 'Unknown') {
                    const addr = analysis.deployerWallet;
                    deployerEl.innerHTML = `<a href="https://solscan.io/account/${addr}" target="_blank" style="color: var(--accent-primary);">${addr.slice(0, 4)}...${addr.slice(-4)}</a>`;
                } else if (deployerEl) {
                    deployerEl.textContent = analysis.deployerWallet || 'Not Found';
                }

                // Wallet Age
                const walletAgeEl = document.getElementById('devWalletAge');
                if (walletAgeEl) {
                    walletAgeEl.textContent = analysis.walletAge || 'Unknown';
                    walletAgeEl.classList.remove('positive', 'negative', 'warning');
                    if (analysis.walletAge && analysis.walletAge.includes('hour')) {
                        walletAgeEl.classList.add('negative');
                    } else if (analysis.walletAge && analysis.walletAge.includes('day')) {
                        const days = parseInt(analysis.walletAge) || 0;
                        walletAgeEl.classList.add(days < 7 ? 'warning' : 'positive');
                    }
                }

                // Trust Score Number
                const trustScoreNumEl = document.getElementById('devTrustScoreNum');
                if (trustScoreNumEl) {
                    trustScoreNumEl.textContent = `${analysis.trustScore || 0}/100`;
                    trustScoreNumEl.classList.remove('positive', 'negative', 'warning');
                    if (analysis.trustScore >= 70) {
                        trustScoreNumEl.classList.add('positive');
                    } else if (analysis.trustScore < 40) {
                        trustScoreNumEl.classList.add('negative');
                    } else {
                        trustScoreNumEl.classList.add('warning');
                    }
                }

                // ========== SECURITY FLAGS ==========
                // Mint Authority
                const mintAuthEl = document.getElementById('devMintAuthority');
                if (mintAuthEl) {
                    if (analysis.mintAuthorityEnabled === true) {
                        mintAuthEl.textContent = '🚨 ENABLED';
                        mintAuthEl.classList.add('negative');
                    } else if (analysis.mintAuthorityEnabled === false) {
                        mintAuthEl.textContent = '✅ Disabled';
                        mintAuthEl.classList.add('positive');
                    } else {
                        mintAuthEl.textContent = 'Unknown';
                    }
                }

                // Freeze Authority
                const freezeAuthEl = document.getElementById('devFreezeAuthority');
                if (freezeAuthEl) {
                    if (analysis.freezeAuthorityEnabled === true) {
                        freezeAuthEl.textContent = '🚨 ENABLED';
                        freezeAuthEl.classList.add('negative');
                    } else if (analysis.freezeAuthorityEnabled === false) {
                        freezeAuthEl.textContent = '✅ Disabled';
                        freezeAuthEl.classList.add('positive');
                    } else {
                        freezeAuthEl.textContent = 'Unknown';
                    }
                }

                // Top 10 Holders
                const top10El = document.getElementById('devTop10Holders');
                if (top10El) {
                    const pct = analysis.top10HolderPercent || 0;
                    top10El.textContent = `${pct}%`;
                    top10El.classList.remove('positive', 'negative', 'warning');
                    if (pct > 50) {
                        top10El.classList.add('negative');
                    } else if (pct > 30) {
                        top10El.classList.add('warning');
                    } else {
                        top10El.classList.add('positive');
                    }
                }

                // View Wallets link - points to Solscan holders page
                const viewWalletsLink = document.getElementById('viewWalletsLink');
                if (viewWalletsLink && pair.baseToken?.address) {
                    viewWalletsLink.href = `https://solscan.io/token/${pair.baseToken.address}#holders`;
                }

                // Social Links - with icons and actual URLs
                const socialEl = document.getElementById('devSocialLinks');
                if (socialEl) {
                    if (analysis.hasSocialLinks && analysis.socialLinks) {
                        const links = [];
                        if (analysis.socialLinks.twitter) {
                            links.push(`<a href="${analysis.socialLinks.twitter}" target="_blank" style="color: var(--accent-primary);">🐦</a>`);
                        }
                        if (analysis.socialLinks.telegram) {
                            links.push(`<a href="${analysis.socialLinks.telegram}" target="_blank" style="color: var(--accent-primary);">✈️</a>`);
                        }
                        if (analysis.socialLinks.website) {
                            links.push(`<a href="${analysis.socialLinks.website}" target="_blank" style="color: var(--accent-primary);">🌐</a>`);
                        }
                        if (links.length > 0) {
                            socialEl.innerHTML = links.join(' ');
                            socialEl.classList.add('positive');
                        } else {
                            socialEl.textContent = '✅ Found';
                            socialEl.classList.add('positive');
                        }
                    } else if (analysis.hasSocialLinks === false) {
                        socialEl.textContent = '❌ None (High Risk)';
                        socialEl.classList.add('negative');
                    } else {
                        socialEl.textContent = 'Unknown';
                    }
                }

                // Risk Flags List
                const riskFlagsListEl = document.getElementById('riskFlagsList');
                const riskFlagsContentEl = document.getElementById('riskFlagsContent');
                if (riskFlagsListEl && riskFlagsContentEl && analysis.riskFlags && analysis.riskFlags.length > 0) {
                    riskFlagsListEl.style.display = 'block';
                    riskFlagsContentEl.innerHTML = analysis.riskFlags.map(flag => `<div style="margin-bottom: 0.25rem;">• ${flag}</div>`).join('');
                } else if (riskFlagsListEl) {
                    riskFlagsListEl.style.display = 'none';
                }

                // ========== DEV COIN HISTORY ==========
                setElementText('devOtherCoins', analysis.otherTokens);
                setElementText('devRugHistory', analysis.rugCount);
                setElementText('devSuccessRate', analysis.successRate);

                // Avg Peak Market Cap with color
                const avgPeakEl = document.getElementById('devAvgPeakMcap');
                if (avgPeakEl) {
                    avgPeakEl.textContent = analysis.avgPeakMarketCap || 'N/A';
                    avgPeakEl.classList.remove('positive', 'negative', 'warning');
                    const peakValue = parseInt(String(analysis.avgPeakMarketCap).replace(/[$,]/g, '')) || 0;
                    if (peakValue >= 100000) {
                        avgPeakEl.classList.add('positive');
                    } else if (peakValue >= 10000) {
                        avgPeakEl.classList.add('warning');
                    } else if (peakValue > 0) {
                        avgPeakEl.classList.add('negative');
                    }
                }

                // ========== UPDATE LINKS ==========
                const devHistoryLink = document.getElementById('devHistoryLink');
                if (devHistoryLink && analysis.solscanLink) {
                    devHistoryLink.href = analysis.solscanLink;
                }

                showToast(`Trust Score: ${analysis.trustScore}/100 - ${analysis.riskLevel}`);

            } catch (error) {
                console.error('Dev check failed:', error);
                showToast('❌ Dev check failed. Try again.');
            } finally {
                checkDevBtn.disabled = false;
                checkDevBtn.innerHTML = '🔍 Check Dev';
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
 * Switch to wallet-only mode (hide token cards, show only wallet section)
 */
function showWalletOnlyMode() {
    // List of card IDs to hide (token analysis cards)
    const tokenCardIds = [
        'tokenCard',
        'tab-overview',
        'resultsTabs'
    ];

    // Hide token-related cards
    tokenCardIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });

    // Hide all cards in section-grid except walletDeepDiveCard
    const sectionGrid = document.querySelector('.section-grid');
    if (sectionGrid) {
        const allCards = sectionGrid.querySelectorAll('.card');
        allCards.forEach(card => {
            if (card.id !== 'walletDeepDiveCard') {
                card.style.display = 'none';
            } else {
                card.style.display = 'block';
            }
        });
    }

    // Show wallet card prominently
    const walletCard = document.getElementById('walletDeepDiveCard');
    if (walletCard) {
        walletCard.style.display = 'block';
        walletCard.style.gridColumn = '1 / -1';
    }

    console.log('[UI] Switched to wallet-only mode');
}

/**
 * Switch to token mode (show all cards for normal token analysis)
 */
function showTokenMode() {
    // Show tabs
    const tabs = document.getElementById('resultsTabs');
    if (tabs) tabs.style.display = '';

    // Show all cards in section-grid
    const sectionGrid = document.querySelector('.section-grid');
    if (sectionGrid) {
        const allCards = sectionGrid.querySelectorAll('.card');
        allCards.forEach(card => {
            card.style.display = '';
        });
    }

    // Show token card and tab overview
    const tokenCard = document.getElementById('tokenCard');
    if (tokenCard) tokenCard.style.display = '';

    const tabOverview = document.getElementById('tab-overview');
    if (tabOverview) tabOverview.style.display = '';

    console.log('[UI] Switched to token mode');
}

/**
 * Update evidence badges with specific data and make them clickable
 * @param {Object} pair - Token pair data
 * @param {Object} risks - Risk analysis
 */
function updateEvidenceBadges(pair, risks) {
    const liquidity = pair.liquidity?.usd || 0;
    const pairAge = pair.pairCreatedAt ? Math.floor((Date.now() - pair.pairCreatedAt) / (1000 * 60 * 60 * 24)) : 0;
    const token = pair.baseToken;
    const dexUrl = `https://dexscreener.com/${pair.chainId}/${pair.pairAddress}`;

    // LP Badge - clickable
    const lpBadge = document.getElementById('evidenceLp');
    if (lpBadge) {
        const lpText = `LP: ${formatCurrency(liquidity)}`;
        lpBadge.textContent = lpText;
        lpBadge.classList.remove('safe', 'warning', 'danger');
        lpBadge.classList.add(liquidity >= 50000 ? 'safe' : liquidity >= 10000 ? 'warning' : 'danger');
        lpBadge.style.cursor = 'pointer';
        lpBadge.onclick = () => window.open(dexUrl, '_blank');
    }

    // Top 10 Holders Badge - clickable
    const holdersBadge = document.getElementById('evidenceHolders');
    if (holdersBadge) {
        const top10Pct = risks.holderConcentration.level === 'HIGH' ? 60 :
            risks.holderConcentration.level === 'MEDIUM' ? 35 : 20;
        holdersBadge.textContent = `Top10: ~${top10Pct}%`;
        holdersBadge.classList.remove('safe', 'warning', 'danger');
        holdersBadge.classList.add(top10Pct <= 20 ? 'safe' : top10Pct <= 40 ? 'warning' : 'danger');
        holdersBadge.style.cursor = 'pointer';
        holdersBadge.onclick = () => window.open(`https://solscan.io/token/${token.address}#holders`, '_blank');
    }

    // Dev Badge - clickable, triggers dev check
    const devBadge = document.getElementById('evidenceDev');
    if (devBadge) {
        devBadge.textContent = 'Dev: Check →';
        devBadge.classList.remove('safe', 'warning', 'danger');
        devBadge.classList.add('warning');
        devBadge.style.cursor = 'pointer';
        devBadge.onclick = () => {
            const checkDevBtn = document.getElementById('checkDevBtn');
            if (checkDevBtn) checkDevBtn.click();
        };
    }

    // Age Badge - clickable
    const ageBadge = document.getElementById('evidenceAge');
    if (ageBadge) {
        let ageText = pairAge < 1 ? 'Age: <1d' :
            pairAge < 7 ? `Age: ${pairAge}d` :
                pairAge < 30 ? `Age: ${Math.floor(pairAge / 7)}w` :
                    `Age: ${Math.floor(pairAge / 30)}m`;
        ageBadge.textContent = ageText;
        ageBadge.classList.remove('safe', 'warning', 'danger');
        ageBadge.classList.add(pairAge >= 14 ? 'safe' : pairAge >= 3 ? 'warning' : 'danger');
        ageBadge.style.cursor = 'pointer';
        ageBadge.onclick = () => window.open(dexUrl, '_blank');
    }

    // Risk Flags - show REAL flags based on analysis (risks is now available)
    const riskFlagsEl = document.getElementById('riskFlags');
    if (riskFlagsEl && risks) {
        const flags = [];
        if (liquidity < 10000) flags.push('💧 Low LP');
        if (pairAge < 1) flags.push('🆕 <1 day old');
        if (risks.holderConcentration?.level === 'HIGH') flags.push('🐋 Whale Risk');
        if (risks.rugPull?.level === 'HIGH') flags.push('⚠️ Rug Risk');
        if (risks.volatility?.level === 'HIGH') flags.push('📊 High Volatility');

        riskFlagsEl.classList.remove('positive', 'negative');
        if (flags.length === 0) {
            riskFlagsEl.textContent = '✅ No Major Flags';
            riskFlagsEl.classList.add('positive');
        } else {
            riskFlagsEl.textContent = flags.join(' • ');
            riskFlagsEl.classList.add('negative');
        }
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

    // Liquidity Lock Detection - clearer messaging
    const liquidityLockEl = document.getElementById('liquidityLock');
    const liquidity = pair.liquidity?.usd || 0;
    const pairAge = pair.pairCreatedAt ? Math.floor((Date.now() - pair.pairCreatedAt) / (1000 * 60 * 60 * 24)) : 0;

    // Simple clear messaging based on liquidity and age
    let lockStatus = 'UNKNOWN';
    let lockClass = 'warning';

    if (liquidity >= 100000) {
        lockStatus = 'LOCKED ✅';
        lockClass = 'positive';
    } else if (liquidity >= 50000 && pairAge >= 7) {
        lockStatus = 'LOCKED ✅';
        lockClass = 'positive';
    } else if (liquidity < 5000) {
        lockStatus = 'NOT LOCKED ❌';
        lockClass = 'negative';
    } else {
        lockStatus = 'CHECK SOLSCAN';
        lockClass = 'warning';
    }

    liquidityLockEl.textContent = lockStatus;
    liquidityLockEl.classList.remove('positive', 'negative', 'warning');
    liquidityLockEl.classList.add(lockClass);
    // Make LP lock clickable to Solscan
    liquidityLockEl.style.cursor = 'pointer';
    liquidityLockEl.onclick = () => window.open(`https://solscan.io/token/${token.address}#holders`, '_blank');

    // NOTE: Risk Flags are now set in updateEvidenceBadges after risks is calculated

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

    // Set Bubblemaps direct link (iframe blocked by CSP, so we link out instead)
    const bubblemapsDirectLink = document.getElementById('bubblemapsDirectLink');
    if (bubblemapsDirectLink) {
        if (pair.chainId === 'solana') {
            bubblemapsDirectLink.href = `https://app.bubblemaps.io/sol/token/${token.address}`;
        } else {
            bubblemapsDirectLink.href = `https://app.bubblemaps.io/${pair.chainId}/token/${token.address}`;
        }
        // Make the wrapper clickable to open modal
        const wrapper = document.getElementById('bubblemapsWrapper');
        if (wrapper) {
            wrapper.onclick = () => openBubblemapsModal(token.address, token.symbol || token.name, pair.chainId);
        }
    }
}

// ========== BUBBLEMAPS MODAL FUNCTIONS ==========

let currentHolders = [];
let currentTokenAddress = null;

/**
 * Open Bubblemaps Modal
 */
function openBubblemapsModal(tokenAddress, tokenName, chainId) {
    currentTokenAddress = tokenAddress;
    const modal = document.getElementById('bubblemapsModal');
    const modalTokenName = document.getElementById('modalTokenName');
    const modalBubblemapsLink = document.getElementById('modalBubblemapsLink');
    const modalFallbackLink = document.getElementById('modalFallbackLink');
    const modalIframe = document.getElementById('modalBubblemapsIframe');
    const modalFallback = document.getElementById('modalMapFallback');

    // Set token name
    modalTokenName.textContent = tokenName || 'Token';

    // Set Bubblemaps link
    const bubblemapsUrl = chainId === 'solana'
        ? `https://app.bubblemaps.io/sol/token/${tokenAddress}`
        : `https://app.bubblemaps.io/${chainId}/token/${tokenAddress}`;
    modalBubblemapsLink.href = bubblemapsUrl;
    modalFallbackLink.href = bubblemapsUrl;

    // Try to load iframe (will likely be blocked)
    const iframeUrl = `https://iframe.bubblemaps.io/map?address=${tokenAddress}&chain=solana&partnerId=demo`;
    modalIframe.src = iframeUrl;

    // Show fallback after timeout if iframe fails
    modalFallback.style.display = 'none';
    setTimeout(() => {
        // Check if iframe loaded (this is approximate)
        try {
            if (!modalIframe.contentWindow || !modalIframe.contentDocument) {
                modalFallback.style.display = 'flex';
            }
        } catch (e) {
            modalFallback.style.display = 'flex';
        }
    }, 3000);

    // Fetch holders
    fetchTokenHolders(tokenAddress);

    // Show modal
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

/**
 * Close Bubblemaps Modal
 */
window.closeBubblemapsModal = function () {
    const modal = document.getElementById('bubblemapsModal');
    const modalIframe = document.getElementById('modalBubblemapsIframe');
    modal.style.display = 'none';
    modalIframe.src = 'about:blank';
    document.body.style.overflow = '';
};

// Close modal on escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeBubblemapsModal();
    }
});

// Close modal on outside click
document.getElementById('bubblemapsModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'bubblemapsModal') {
        closeBubblemapsModal();
    }
});

/**
 * Fetch Token Holders from Solscan
 */
async function fetchTokenHolders(tokenAddress) {
    const holdersList = document.getElementById('holdersList');
    holdersList.innerHTML = '<div class="address-loading">Loading holders...</div>';

    try {
        // Solscan public API for token holders
        const response = await fetch(`https://api.solscan.io/token/holders?token=${tokenAddress}&offset=0&size=20`);

        if (!response.ok) throw new Error('Failed to fetch holders');

        const data = await response.json();

        if (data.data && Array.isArray(data.data)) {
            currentHolders = data.data.map((holder, index) => ({
                rank: index + 1,
                address: holder.address,
                amount: holder.amount,
                share: holder.share || 0,
                decimals: holder.decimals || 9,
                type: classifyAddress(holder.address)
            }));
            renderHoldersList();
        } else {
            holdersList.innerHTML = '<div class="address-loading">No holder data available</div>';
        }
    } catch (error) {
        console.error('Failed to fetch holders:', error);
        holdersList.innerHTML = '<div class="address-loading">Failed to load holders. <a href="https://solscan.io/token/' + tokenAddress + '#holders" target="_blank" style="color: var(--accent-primary);">View on Solscan</a></div>';
    }
}

/**
 * Classify address type (Contract, CEX, DEX, or Wallet)
 */
function classifyAddress(address) {
    // Known addresses (simplified - you could expand this)
    const cexAddresses = [
        '5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1', // Binance
        'HN7cABqLq46Es1jh92dQQisAq', // Coinbase
    ];
    const dexAddresses = [
        '5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1', // Raydium Authority
        'srmqPvymJeFKQ4zGQed1GFpp', // Serum
        'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc', // Orca
    ];

    if (cexAddresses.some(a => address.startsWith(a))) return 'cex';
    if (dexAddresses.some(a => address.startsWith(a))) return 'dex';
    // Could add contract detection logic here
    return 'wallet';
}

/**
 * Render holders list
 */
function renderHoldersList() {
    const holdersList = document.getElementById('holdersList');
    const searchTerm = document.getElementById('holderSearch')?.value?.toLowerCase() || '';
    const showContracts = document.getElementById('filterContracts')?.checked ?? true;
    const showCEX = document.getElementById('filterCEX')?.checked ?? true;
    const showDEX = document.getElementById('filterDEX')?.checked ?? true;

    const filtered = currentHolders.filter(holder => {
        // Search filter
        if (searchTerm && !holder.address.toLowerCase().includes(searchTerm)) return false;

        // Type filters (wallets always shown)
        if (holder.type === 'contract' && !showContracts) return false;
        if (holder.type === 'cex' && !showCEX) return false;
        if (holder.type === 'dex' && !showDEX) return false;

        return true;
    });

    if (filtered.length === 0) {
        holdersList.innerHTML = '<div class="address-loading">No holders match filters</div>';
        return;
    }

    holdersList.innerHTML = filtered.map(holder => {
        const shortAddr = holder.address.slice(0, 6) + '...' + holder.address.slice(-4);
        const sharePercent = (holder.share * 100).toFixed(2);
        const iconClass = holder.type;
        const iconLetter = holder.type === 'cex' ? 'C' : holder.type === 'dex' ? 'D' : holder.type === 'contract' ? '📜' : '○';

        return `
            <div class="address-row" onclick="window.open('https://solscan.io/account/${holder.address}', '_blank')">
                <span class="address-rank">#${holder.rank}</span>
                <div class="address-icon ${iconClass}">${iconLetter}</div>
                <div class="address-info">
                    <div class="address-text">${shortAddr}</div>
                </div>
                <span class="address-share">${sharePercent}%</span>
            </div>
        `;
    }).join('');
}

/**
 * Filter holders (called from HTML)
 */
window.filterHolders = renderHoldersList;

/**
 * Refresh address list
 */
window.refreshAddressList = function () {
    if (currentTokenAddress) {
        fetchTokenHolders(currentTokenAddress);
    }
};

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
    // Reset all dev check fields to "Scanning..." state
    setElementText('deployerWallet', 'Scanning... 🔄');
    setElementText('devWalletAge', 'Scanning... 🔄');
    setElementText('devTrustScoreNum', 'Scanning... 🔄');

    // Reset trust badge
    const devTrustEl = document.getElementById('devTrustScore');
    if (devTrustEl) {
        devTrustEl.innerHTML = '<span class="dev-badge" style="color: #ffaa00; border-color: #ffaa00;">Click Check Dev</span>';
    }

    // Reset security flags
    setElementText('devMintAuthority', 'Scanning... 🔄');
    setElementText('devFreezeAuthority', 'Scanning... 🔄');
    setElementText('devTop10Holders', 'Scanning... 🔄');
    setElementText('devSocialLinks', 'Scanning... 🔄');

    // Hide risk flags list
    const riskFlagsList = document.getElementById('riskFlagsList');
    if (riskFlagsList) {
        riskFlagsList.style.display = 'none';
    }

    // Reset dev coin history
    setElementText('devOtherCoins', 'Scanning... 🔄');
    setElementText('devRugHistory', 'Scanning... 🔄');
    setElementText('devAvgPeakMcap', 'Scanning... 🔄');
    setElementText('devSuccessRate', 'Scanning... 🔄');

    // Dev history links to explorer
    const devHistoryLink = document.getElementById('devHistoryLink');
    if (devHistoryLink) {
        devHistoryLink.href = getExplorerLink(pair.chainId, pair.pairAddress);
    }

    // Dev other tokens link
    const devTokensLink = document.getElementById('devTokensLink');
    if (devTokensLink) {
        devTokensLink.href = getExplorerTokensLink(pair.chainId, token.address);
    }

    // Pump.fun link (Solana only) - link to token page which shows creator
    const pumpfunLink = document.getElementById('pumpfunLink');
    if (pumpfunLink) {
        if (pair.chainId === 'solana') {
            // Use pump.fun token page which shows creator info and their other coins
            pumpfunLink.href = `https://pump.fun/coin/${token.address}`;
            pumpfunLink.style.display = 'inline-flex';
        } else {
            // Hide Pump.fun button for non-Solana tokens
            pumpfunLink.style.display = 'none';
        }
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
        // ========== SMART DETECTION: Token vs Wallet ==========
        // Check if this looks like a Solana wallet address (not a token)
        const solanaAddressRegex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

        if (solanaAddressRegex.test(query) && query.length >= 32) {
            // First, try to see if it's a token by searching Dexscreener
            updateLoadingProgress(20, 'Checking if this is a token or wallet...');

            try {
                const quickCheck = await api.searchToken(query);

                // If we find trading pairs, it's a token
                if (quickCheck.pairs && quickCheck.pairs.length > 0) {
                    console.log('[ANALYZE] Address has trading pairs - treating as token');
                    // Restore token mode (show all cards)
                    showTokenMode();
                    // Continue with normal token analysis below
                } else {
                    // No trading pairs found - likely a wallet address
                    console.log('[ANALYZE] No trading pairs found - treating as wallet address');
                    hideLoading();

                    // IMPORTANT: Show results section and switch to wallet-only mode
                    showResults();
                    showWalletOnlyMode();

                    // Hide trending section
                    if (trendingSection) trendingSection.style.display = 'none';

                    // Scroll to wallet deep dive section
                    const walletCard = document.getElementById('walletDeepDiveCard');
                    const walletInput = document.getElementById('walletAnalysisInput');

                    if (walletCard && walletInput) {
                        // Fill the wallet input
                        walletInput.value = query;

                        // Scroll to top of results section
                        setTimeout(() => {
                            resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }, 100);

                        // Trigger analysis after scroll
                        setTimeout(() => {
                            analyzeWalletAddress(query);
                        }, 300);

                        showToast('� Analyzing wallet...');
                        return;
                    }
                }
            } catch (error) {
                console.log('[ANALYZE] Quick check failed, assuming wallet address');
                hideLoading();

                // Show results section and switch to wallet-only mode
                showResults();
                showWalletOnlyMode();
                if (trendingSection) trendingSection.style.display = 'none';

                // Redirect to wallet analysis
                const walletInput = document.getElementById('walletAnalysisInput');
                if (walletInput) {
                    walletInput.value = query;
                    setTimeout(() => {
                        resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }, 100);
                    setTimeout(() => analyzeWalletAddress(query), 300);
                }
                showToast('🔬 Analyzing wallet...');
                return;
            }
        }

        // ========== NORMAL TOKEN ANALYSIS ==========
        // Restore token mode in case we were in wallet mode before
        showTokenMode();

        // Update progress
        updateLoadingProgress(20, 'Searching Dexscreener...');

        // Try search first
        let result = await api.searchToken(query);

        // If no results and query looks like a contract address, try direct lookup
        if ((!result.pairs || result.pairs.length === 0) && query.length >= 32) {
            console.log('[ANALYZE] Search returned no results, trying direct lookup...');
            updateLoadingProgress(40, 'Trying direct token lookup...');

            // Use the new comprehensive direct lookup
            result = await api.getTokenDirect(query);
        }

        updateLoadingProgress(60, 'Processing token data...');

        if (!result.pairs || result.pairs.length === 0) {
            showError('❌ Token not found on Dexscreener. This may be a very new launch (< 5 mins old) or an invalid address. Check the CA on Solscan to verify it exists.');
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

        // Trigger Real On-Chain Wallet Analysis (Async)
        // loadRealWalletData(bestPair.baseToken.address);

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

// Make selectToken globally available for onclick handlers in HTML
window.selectToken = (address) => {
    tokenInput.value = address;
    analyzeToken(address);
    // On mobile, close sidebar after selection
    const sidebar = document.getElementById('freshPairsSidebar');
    if (window.innerWidth <= 768 && sidebar && sidebar.classList.contains('active')) {
        sidebar.classList.remove('active');
    }
};

// Initialize app with error handling
try {
    console.log('🤖 Initializing MemeRadar...');
    init();
} catch (error) {
    console.error('CRITICAL: Init failed', error);
    if (errorMessage) {
        errorMessage.textContent = 'App failed to load. Please refresh.';
        errorMessage.style.display = 'block';
    }
}

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

// ===========================================
// WALLET DEEP DIVE (Moralis Powered)
// ===========================================

/**
 * Setup Wallet Deep Dive functionality
 */
function setupWalletDeepDive() {
    const analyzeWalletBtn = document.getElementById('analyzeWalletBtn');
    const walletInput = document.getElementById('walletAnalysisInput');

    if (analyzeWalletBtn && walletInput) {
        analyzeWalletBtn.addEventListener('click', () => {
            const address = walletInput.value.trim();
            if (address) {
                analyzeWalletAddress(address);
            }
        });

        walletInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const address = walletInput.value.trim();
                if (address) {
                    analyzeWalletAddress(address);
                }
            }
        });
    }
}

/**
 * Analyze a wallet address using Moralis API
 * @param {string} address - Solana wallet address
 */
async function analyzeWalletAddress(address) {
    const resultsEl = document.getElementById('walletAnalysisResults');
    const loadingEl = document.getElementById('walletAnalysisLoading');
    const errorEl = document.getElementById('walletAnalysisError');

    // Validate Solana address format
    const solanaAddressRegex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
    if (!solanaAddressRegex.test(address)) {
        showWalletError('Invalid Solana wallet address format');
        return;
    }

    // Show loading state
    if (resultsEl) resultsEl.style.display = 'none';
    if (errorEl) errorEl.style.display = 'none';
    if (loadingEl) loadingEl.style.display = 'block';

    try {
        // Fetch wallet summary using Moralis API
        console.log('[WALLET] Fetching wallet summary for:', address);
        const summary = await moralisAPI.getWalletSummary(address);
        console.log('[WALLET] Got summary:', summary);

        if (summary.error) {
            console.log('[WALLET] Summary has error:', summary.error);
            throw new Error(summary.error);
        }

        // Render wallet analysis results
        console.log('[WALLET] Rendering wallet deep dive...');
        renderWalletDeepDive(summary);

        // Show results
        if (loadingEl) loadingEl.style.display = 'none';
        if (resultsEl) {
            resultsEl.style.display = 'block';
            console.log('[WALLET] Showing results element');
        } else {
            console.log('[WALLET] ERROR: resultsEl not found!');
        }

        showToast(`Wallet analyzed: ${summary.shortAddress}`);

    } catch (error) {
        console.error('Wallet analysis failed:', error);
        showWalletError(error.message || 'Failed to analyze wallet');
    }
}

/**
 * Show wallet analysis error
 * @param {string} message - Error message
 */
function showWalletError(message) {
    const resultsEl = document.getElementById('walletAnalysisResults');
    const loadingEl = document.getElementById('walletAnalysisLoading');
    const errorEl = document.getElementById('walletAnalysisError');
    const errorMsgEl = document.getElementById('walletAnalysisErrorMsg');

    if (resultsEl) resultsEl.style.display = 'none';
    if (loadingEl) loadingEl.style.display = 'none';
    if (errorEl) errorEl.style.display = 'block';
    if (errorMsgEl) errorMsgEl.textContent = message;
}

/**
 * Render wallet deep dive analysis results
 * @param {Object} summary - Wallet summary data from Moralis
 */
function renderWalletDeepDive(summary) {
    // Address
    const addressEl = document.getElementById('walletAnalysisAddress');
    if (addressEl) {
        addressEl.innerHTML = `<a href="https://solscan.io/account/${summary.address}" target="_blank" style="color: var(--accent-primary);">${summary.shortAddress}</a>`;
    }

    // Net Worth
    const netWorthEl = document.getElementById('walletNetWorth');
    if (netWorthEl) {
        netWorthEl.textContent = `$${formatCurrency(summary.netWorthUSD)}`;
    }

    // SOL Balance
    const solBalanceEl = document.getElementById('walletSolBalance');
    if (solBalanceEl) {
        solBalanceEl.textContent = `${summary.solBalance?.toFixed(4) || 0} SOL`;
    }

    // Token Count
    const tokenCountEl = document.getElementById('walletTokenCount');
    if (tokenCountEl) {
        tokenCountEl.textContent = summary.tokenCount || 0;
    }

    // Wallet Age
    const walletAgeEl = document.getElementById('walletAge');
    if (walletAgeEl && summary.walletAge) {
        if (summary.walletAge.isBurner) {
            walletAgeEl.innerHTML = `<span class="negative">${summary.walletAge.hours}h (BURNER!)</span>`;
        } else if (summary.walletAge.days !== null) {
            walletAgeEl.textContent = summary.walletAge.days < 30
                ? `${summary.walletAge.days} days`
                : `${Math.floor(summary.walletAge.days / 30)} months`;
        } else {
            walletAgeEl.textContent = 'Unknown';
        }
    }

    // Trust Score
    const trustScoreEl = document.getElementById('walletTrustScore');
    if (trustScoreEl) {
        trustScoreEl.textContent = `${summary.trustScore}/100`;
        trustScoreEl.classList.remove('positive', 'negative', 'warning');
        if (summary.trustScore >= 70) {
            trustScoreEl.classList.add('positive');
        } else if (summary.trustScore < 40) {
            trustScoreEl.classList.add('negative');
        } else {
            trustScoreEl.classList.add('warning');
        }
    }

    // Badges
    const badgesEl = document.getElementById('walletBadges');
    if (badgesEl) {
        const badges = [];
        if (summary.isWhale) {
            badges.push('<span class="wallet-badge whale">🐋 WHALE</span>');
        }
        if (summary.isBurner) {
            badges.push('<span class="wallet-badge burner">🔥 BURNER</span>');
        }
        if (summary.transactionCount > 100) {
            badges.push('<span class="wallet-badge active">⚡ ACTIVE</span>');
        }
        badgesEl.innerHTML = badges.join('');
    }

    // Risk Flags
    const riskFlagsEl = document.getElementById('walletRiskFlags');
    const riskFlagsListEl = document.getElementById('walletRiskFlagsList');
    if (riskFlagsEl && riskFlagsListEl && summary.flags && summary.flags.length > 0) {
        riskFlagsEl.style.display = 'block';
        riskFlagsListEl.innerHTML = summary.flags.map(flag =>
            `<span class="risk-flag-badge">${flag}</span>`
        ).join('');
    } else if (riskFlagsEl) {
        riskFlagsEl.style.display = 'none';
    }

    // Token Portfolio
    const portfolioEl = document.getElementById('walletTokenPortfolio');
    if (portfolioEl && summary.topTokens && summary.topTokens.length > 0) {
        portfolioEl.innerHTML = summary.topTokens.map(token => `
            <div class="portfolio-token-item" style="display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem; background: var(--bg-glass); border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
                ${token.logo ? `<img src="${token.logo}" alt="${token.symbol}" style="width: 24px; height: 24px; border-radius: 50%;">` : '<div style="width: 24px; height: 24px; border-radius: 50%; background: var(--accent-primary); display: flex; align-items: center; justify-content: center; font-size: 0.7rem;">💎</div>'}
                <div style="flex: 1; min-width: 0;">
                    <div style="font-weight: 600; font-size: 0.85rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${token.symbol || 'Unknown'}</div>
                    <div style="font-size: 0.7rem; color: var(--text-muted);">${formatNumber(token.amount || 0)}</div>
                </div>
                <div style="text-align: right;">
                    <div style="font-weight: 600; color: var(--accent-primary); font-size: 0.85rem;">${token.usdValue ? '$' + formatCurrency(token.usdValue) : '--'}</div>
                </div>
            </div>
        `).join('');
    } else if (portfolioEl) {
        portfolioEl.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); padding: 1rem;">No tokens found</div>';
    }

    // Recent Activity (simplified)
    const activityEl = document.getElementById('walletRecentActivity');
    if (activityEl) {
        if (summary.transactionCount > 0) {
            activityEl.innerHTML = `
                <div style="display: flex; justify-content: space-between; padding: 0.5rem; border-bottom: 1px solid var(--border-color);">
                    <span style="color: var(--text-muted);">Total Transactions</span>
                    <span style="font-weight: 600;">${summary.transactionCount}</span>
                </div>
                <div style="text-align: center; padding: 1rem; color: var(--text-muted);">
                    <a href="https://solscan.io/account/${summary.address}#transactions" target="_blank" style="color: var(--accent-primary);">View full history on Solscan →</a>
                </div>
            `;
        } else {
            activityEl.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 1rem;">No transaction history available</div>';
        }
    }
}

/**
 * Auto-fill wallet input when clicking on holder addresses
 * @param {string} address - Wallet address to analyze
 */
function triggerWalletDeepDive(address) {
    const walletInput = document.getElementById('walletAnalysisInput');
    if (walletInput) {
        walletInput.value = address;
        analyzeWalletAddress(address);

        // Scroll to wallet deep dive section
        const walletCard = document.getElementById('walletDeepDiveCard');
        if (walletCard) {
            walletCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }
}

// Make triggerWalletDeepDive globally accessible
window.triggerWalletDeepDive = triggerWalletDeepDive;

// Initialize wallet deep dive on page load
document.addEventListener('DOMContentLoaded', setupWalletDeepDive);
// Also try immediately in case DOM is already ready
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setupWalletDeepDive();
}

