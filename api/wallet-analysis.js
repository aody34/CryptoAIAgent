// Vercel Serverless Function: /api/wallet-analysis.js
// Moralis Solana API Integration for Wallet Analysis
// Securely uses MORALIS_API_KEY from environment variables

const MORALIS_BASE_URL = 'https://solana-gateway.moralis.io';

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { address, type = 'portfolio' } = req.query;

    if (!address) {
        return res.status(400).json({ error: 'Wallet address is required' });
    }

    // Validate Solana address format (base58, 32-44 chars)
    const solanaAddressRegex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
    if (!solanaAddressRegex.test(address)) {
        return res.status(400).json({ error: 'Invalid Solana wallet address' });
    }

    const apiKey = process.env.MORALIS_API_KEY;
    if (!apiKey) {
        console.error('MORALIS_API_KEY not configured');
        return res.status(500).json({ error: 'API configuration error' });
    }

    const headers = {
        'accept': 'application/json',
        'X-API-Key': apiKey
    };

    try {
        let result = {};

        switch (type) {
            case 'portfolio':
                result = await getWalletPortfolio(address, headers);
                break;
            case 'tokens':
                result = await getWalletTokens(address, headers);
                break;
            case 'transactions':
                result = await getWalletTransactions(address, headers);
                break;
            case 'balance':
                result = await getWalletBalance(address, headers);
                break;
            case 'full':
                // Get everything for comprehensive analysis
                result = await getFullWalletAnalysis(address, headers);
                break;
            default:
                return res.status(400).json({ error: 'Invalid type. Use: portfolio, tokens, transactions, balance, or full' });
        }

        return res.status(200).json({
            success: true,
            address,
            type,
            data: result,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Moralis API error:', error.message);
        return res.status(500).json({
            success: false,
            error: error.message || 'Failed to fetch wallet data',
            address,
            type
        });
    }
}

/**
 * Get wallet portfolio with total USD value
 */
async function getWalletPortfolio(address, headers) {
    const url = `${MORALIS_BASE_URL}/account/mainnet/${address}/portfolio`;
    const response = await fetch(url, { headers });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Portfolio fetch failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    return {
        totalNetWorthUSD: data.total_networth_usd || data.total_net_worth || 0,
        nativeBalance: data.native_balance || {},
        tokens: data.tokens || [],
        nfts: data.nfts || []
    };
}

/**
 * Get all SPL tokens in wallet
 */
async function getWalletTokens(address, headers) {
    const url = `${MORALIS_BASE_URL}/account/mainnet/${address}/tokens`;
    const response = await fetch(url, { headers });

    if (!response.ok) {
        throw new Error(`Tokens fetch failed: ${response.status}`);
    }

    const data = await response.json();

    // Process and enrich token data
    const tokens = (data || []).map(token => ({
        mint: token.mint || token.address,
        symbol: token.symbol || 'Unknown',
        name: token.name || 'Unknown Token',
        amount: token.amount || 0,
        decimals: token.decimals || 9,
        usdValue: token.usd_value || 0,
        logo: token.logo || token.thumbnail || null,
        associatedAccount: token.associated_token_address || null
    }));

    return {
        count: tokens.length,
        tokens: tokens.sort((a, b) => (b.usdValue || 0) - (a.usdValue || 0))
    };
}

/**
 * Get wallet transactions (decoded)
 */
async function getWalletTransactions(address, headers) {
    const url = `${MORALIS_BASE_URL}/account/mainnet/${address}/transactions`;
    const response = await fetch(url, { headers });

    if (!response.ok) {
        throw new Error(`Transactions fetch failed: ${response.status}`);
    }

    const data = await response.json();
    const transactions = data.result || data || [];

    // Process transactions for readable output
    const processed = transactions.slice(0, 50).map(tx => ({
        signature: tx.signature || tx.hash,
        blockTime: tx.block_timestamp || tx.blockTime,
        type: decodeTransactionType(tx),
        status: tx.status || (tx.err ? 'failed' : 'success'),
        fee: tx.fee || 0,
        slot: tx.slot || tx.block_number
    }));

    // Calculate wallet age from oldest transaction
    let walletAge = null;
    if (transactions.length > 0) {
        const oldest = transactions[transactions.length - 1];
        const oldestTime = oldest.block_timestamp || oldest.blockTime;
        if (oldestTime) {
            const ageMs = Date.now() - new Date(oldestTime).getTime();
            walletAge = {
                ms: ageMs,
                hours: Math.floor(ageMs / (1000 * 60 * 60)),
                days: Math.floor(ageMs / (1000 * 60 * 60 * 24)),
                isBurner: ageMs < 24 * 60 * 60 * 1000 // Less than 24 hours
            };
        }
    }

    return {
        totalCount: transactions.length,
        transactions: processed,
        walletAge
    };
}

/**
 * Get native SOL balance
 */
async function getWalletBalance(address, headers) {
    const url = `${MORALIS_BASE_URL}/account/mainnet/${address}/balance`;
    const response = await fetch(url, { headers });

    if (!response.ok) {
        throw new Error(`Balance fetch failed: ${response.status}`);
    }

    const data = await response.json();

    return {
        lamports: data.lamports || 0,
        solana: (data.lamports || 0) / 1e9
    };
}

/**
 * Get full wallet analysis (all data combined)
 */
async function getFullWalletAnalysis(address, headers) {
    // Fetch all data in parallel
    const [portfolio, tokens, transactions, balance] = await Promise.allSettled([
        getWalletPortfolio(address, headers),
        getWalletTokens(address, headers),
        getWalletTransactions(address, headers),
        getWalletBalance(address, headers)
    ]);

    const result = {
        portfolio: portfolio.status === 'fulfilled' ? portfolio.value : null,
        tokens: tokens.status === 'fulfilled' ? tokens.value : null,
        transactions: transactions.status === 'fulfilled' ? transactions.value : null,
        balance: balance.status === 'fulfilled' ? balance.value : null
    };

    // Calculate risk indicators
    result.riskIndicators = calculateWalletRisk(result);

    return result;
}

/**
 * Decode transaction type from raw data
 */
function decodeTransactionType(tx) {
    // Try to decode transaction type from instructions or logs
    const instructions = tx.instructions || [];
    const logs = tx.log_messages || tx.logs || [];

    // Check for common patterns
    const logsStr = logs.join(' ').toLowerCase();

    if (logsStr.includes('swap') || logsStr.includes('raydium') || logsStr.includes('jupiter')) {
        return 'Swap';
    }
    if (logsStr.includes('transfer')) {
        return 'Transfer';
    }
    if (logsStr.includes('mint')) {
        return 'Mint';
    }
    if (logsStr.includes('burn')) {
        return 'Burn';
    }
    if (logsStr.includes('stake')) {
        return 'Stake';
    }
    if (logsStr.includes('create') || logsStr.includes('initialize')) {
        return 'Create Account';
    }

    return tx.type || 'Unknown';
}

/**
 * Calculate wallet risk indicators
 */
function calculateWalletRisk(data) {
    const indicators = {
        isBurner: false,
        isWhale: false,
        isActive: false,
        trustScore: 50,
        flags: []
    };

    // Check wallet age (burner detection)
    if (data.transactions?.walletAge) {
        const age = data.transactions.walletAge;
        indicators.isBurner = age.isBurner;
        if (age.isBurner) {
            indicators.flags.push('🚨 Burner wallet (< 24h old)');
            indicators.trustScore -= 30;
        } else if (age.days < 7) {
            indicators.flags.push('⚠️ New wallet (< 7 days)');
            indicators.trustScore -= 15;
        } else if (age.days > 365) {
            indicators.flags.push('✅ Established wallet (1+ year)');
            indicators.trustScore += 20;
        }
    }

    // Check if whale
    const netWorth = data.portfolio?.totalNetWorthUSD || 0;
    if (netWorth >= 100000) {
        indicators.isWhale = true;
        indicators.flags.push(`🐋 Whale wallet ($${formatNumber(netWorth)})`);
    } else if (netWorth >= 10000) {
        indicators.flags.push(`💰 Substantial holdings ($${formatNumber(netWorth)})`);
    }

    // Check activity level
    const txCount = data.transactions?.totalCount || 0;
    if (txCount > 100) {
        indicators.isActive = true;
        indicators.flags.push('📊 High activity (100+ transactions)');
        indicators.trustScore += 10;
    } else if (txCount < 10) {
        indicators.flags.push('📉 Low activity (< 10 transactions)');
        indicators.trustScore -= 10;
    }

    // Check token diversity
    const tokenCount = data.tokens?.count || 0;
    if (tokenCount > 20) {
        indicators.flags.push('🎨 Diversified portfolio');
        indicators.trustScore += 5;
    } else if (tokenCount === 1) {
        indicators.flags.push('⚠️ Single token holder');
        indicators.trustScore -= 10;
    }

    // Normalize trust score
    indicators.trustScore = Math.max(0, Math.min(100, indicators.trustScore));

    return indicators;
}

/**
 * Format large numbers
 */
function formatNumber(num) {
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
    return num.toFixed(2);
}
