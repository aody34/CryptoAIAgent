// Vercel Serverless Function: /api/check-dev.js
// Complete Dev Analysis Automation - "Hard Truth" Implementation
// Auto-extracts deployer, checks authorities, calculates weighted trust score

export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { mintAddress, creatorAddress } = req.body;

    if (!mintAddress && !creatorAddress) {
        return res.status(400).json({ error: 'Missing mintAddress or creatorAddress' });
    }

    const apiKey = "9b583a75-fa36-4da9-932d-db8e4e06ae35";
    const heliusRpc = `https://mainnet.helius-rpc.com/?api-key=${apiKey}`;
    const heliusApi = `https://api.helius.xyz/v0`;

    try {
        let deployerWallet = creatorAddress;
        let walletAge = null;
        let walletAgeText = 'Unknown';
        let trustScore = 100;
        let riskFlags = [];

        // ========== STEP 1: Find Deployer Wallet ==========
        if (mintAddress && !deployerWallet) {
            try {
                // Get signatures for the mint address to find creation transaction
                const sigsResponse = await fetch(heliusRpc, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        jsonrpc: '2.0',
                        id: 1,
                        method: 'getSignaturesForAddress',
                        params: [mintAddress, { limit: 1000 }]
                    })
                });
                const sigsData = await sigsResponse.json();

                if (sigsData.result && sigsData.result.length > 0) {
                    // The last signature is the oldest (creation)
                    const creationSig = sigsData.result[sigsData.result.length - 1].signature;

                    // Fetch the transaction details using Helius parsed API
                    const txResponse = await fetch(`${heliusApi}/transactions/?api-key=${apiKey}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ transactions: [creationSig] })
                    });
                    const txData = await txResponse.json();

                    if (txData && txData.length > 0) {
                        deployerWallet = txData[0].feePayer;
                    }
                }
            } catch (e) {
                console.error('Error finding deployer:', e);
            }
        }

        // ========== STEP 2: Check Mint/Freeze Authority ==========
        let mintAuthorityEnabled = false;
        let freezeAuthorityEnabled = false;
        let tokenInfo = null;

        if (mintAddress) {
            try {
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

                if (assetData.result) {
                    tokenInfo = assetData.result;

                    // Check authorities
                    if (assetData.result.authorities) {
                        mintAuthorityEnabled = assetData.result.authorities.some(
                            a => a.scopes && a.scopes.includes('mint')
                        );
                        freezeAuthorityEnabled = assetData.result.authorities.some(
                            a => a.scopes && a.scopes.includes('freeze')
                        );
                    }

                    // Apply penalties
                    if (mintAuthorityEnabled) {
                        trustScore -= 50;
                        riskFlags.push("🚨 Mint Authority Enabled (Dev can print more tokens)");
                    }
                    if (freezeAuthorityEnabled) {
                        trustScore -= 50;
                        riskFlags.push("🚨 Freeze Authority Enabled (Dev can stop you from selling)");
                    }
                }
            } catch (e) {
                console.error('Error checking asset:', e);
            }
        }

        // ========== STEP 3: Check Holder Concentration ==========
        let top10HolderPercent = 0;

        if (mintAddress) {
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

                    // Get total supply from token info
                    let totalSupply = 1000000000; // Default 1B
                    if (tokenInfo && tokenInfo.token_info) {
                        totalSupply = tokenInfo.token_info.supply / Math.pow(10, tokenInfo.token_info.decimals || 9);
                    }

                    top10HolderPercent = Math.round((top10Amount / totalSupply) * 100);

                    if (top10HolderPercent > 30) {
                        trustScore -= 30;
                        riskFlags.push(`⚠️ High Concentration: Top 10 hold ${top10HolderPercent}%`);
                    }
                }
            } catch (e) {
                console.error('Error checking holders:', e);
            }
        }

        // ========== STEP 4: Check Wallet Age ==========
        if (deployerWallet) {
            try {
                const walletSigsResponse = await fetch(heliusRpc, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        jsonrpc: '2.0',
                        id: 1,
                        method: 'getSignaturesForAddress',
                        params: [deployerWallet, { limit: 1000 }]
                    })
                });
                const walletSigsData = await walletSigsResponse.json();

                if (walletSigsData.result && walletSigsData.result.length > 0) {
                    // Last signature is the oldest
                    const oldestSig = walletSigsData.result[walletSigsData.result.length - 1];
                    if (oldestSig.blockTime) {
                        walletAge = Date.now() - (oldestSig.blockTime * 1000);

                        // Format age text
                        const hours = Math.floor(walletAge / (1000 * 60 * 60));
                        const days = Math.floor(hours / 24);

                        if (days > 0) {
                            walletAgeText = `${days} day${days > 1 ? 's' : ''} old`;
                        } else {
                            walletAgeText = `${hours} hour${hours !== 1 ? 's' : ''} old`;
                        }

                        // Penalty for new wallets (< 24 hours)
                        if (hours < 24) {
                            trustScore -= 40;
                            riskFlags.push(`🆕 Dev wallet is only ${walletAgeText} (HIGH RISK)`);
                        }
                    }
                }
            } catch (e) {
                console.error('Error checking wallet age:', e);
            }
        }

        // ========== STEP 5: Check Dev's Past Tokens (with Dexscreener) ==========
        let totalCreated = 0;
        let rugged = 0;
        let successful = 0;
        let avgPeakMarketCap = 0;
        let tokens = [];

        if (deployerWallet) {
            try {
                // Use searchAssets to find tokens by this creator
                const assetsResponse = await fetch(heliusRpc, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        jsonrpc: '2.0',
                        id: 1,
                        method: 'searchAssets',
                        params: {
                            ownerAddress: deployerWallet,
                            creatorAddress: deployerWallet,
                            burnt: false,
                            page: 1,
                            limit: 50,
                            sortBy: { sortBy: "created", sortDirection: "desc" }
                        }
                    })
                });
                const assetsData = await assetsResponse.json();

                if (assetsData.result && assetsData.result.items) {
                    const items = assetsData.result.items;
                    totalCreated = assetsData.result.total || items.length;

                    // Cross-reference top 10 tokens with Dexscreener
                    let totalMcap = 0;
                    let tokensWithMcap = 0;

                    for (const item of items.slice(0, 10)) {
                        const tokenMint = item.id;
                        const tokenName = item.content?.metadata?.name || 'Unknown';
                        const tokenSymbol = item.content?.metadata?.symbol || '???';

                        try {
                            const dexResponse = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${tokenMint}`);
                            const dexData = await dexResponse.json();

                            if (dexData.pairs && dexData.pairs.length > 0) {
                                const bestPair = dexData.pairs.reduce((best, pair) => {
                                    const mcap = pair.marketCap || pair.fdv || 0;
                                    return mcap > (best.marketCap || best.fdv || 0) ? pair : best;
                                }, dexData.pairs[0]);

                                const mcap = bestPair.marketCap || bestPair.fdv || 0;

                                tokens.push({
                                    mint: tokenMint,
                                    name: bestPair.baseToken?.name || tokenName,
                                    symbol: bestPair.baseToken?.symbol || tokenSymbol,
                                    marketCap: mcap,
                                    status: mcap > 10000 ? 'ACTIVE' : 'DEAD'
                                });

                                if (mcap > 0) {
                                    totalMcap += mcap;
                                    tokensWithMcap++;
                                }

                                if (mcap > 50000) successful++;
                                else if (mcap < 5000) rugged++;
                            } else {
                                tokens.push({
                                    mint: tokenMint,
                                    name: tokenName,
                                    symbol: tokenSymbol,
                                    marketCap: 0,
                                    status: 'DEAD'
                                });
                                rugged++;
                            }
                        } catch (e) {
                            // Skip on error
                        }

                        // Small delay to avoid rate limiting
                        await new Promise(r => setTimeout(r, 100));
                    }

                    avgPeakMarketCap = tokensWithMcap > 0 ? Math.round(totalMcap / tokensWithMcap) : 0;

                    // Penalty for no successful coins
                    if (totalCreated > 0 && successful === 0) {
                        trustScore -= 20;
                        riskFlags.push("📉 0 successful past coins (all peaked < $50k)");
                    }
                }
            } catch (e) {
                console.error('Error checking dev history:', e);
            }
        }

        // ========== STEP 6: Check Social Links ==========
        let hasSocialLinks = false;
        if (tokenInfo && tokenInfo.content?.links) {
            const links = tokenInfo.content.links;
            hasSocialLinks = links.twitter || links.telegram || links.website;
        }

        if (!hasSocialLinks && mintAddress) {
            trustScore -= 10;
            riskFlags.push("📵 No social links in metadata (Low Effort)");
        }

        // ========== FINAL: Calculate Risk Level ==========
        trustScore = Math.max(0, Math.min(100, trustScore));

        let riskLevel = 'UNKNOWN';
        if (trustScore >= 70) {
            riskLevel = 'LOW';
        } else if (trustScore >= 40) {
            riskLevel = 'MEDIUM';
        } else {
            riskLevel = 'DANGER';
        }

        return res.status(200).json({
            deployerWallet: deployerWallet || 'Unknown',
            walletAge: walletAgeText,
            trustScore: trustScore,
            riskLevel: riskLevel,
            riskFlags: riskFlags,
            mintAuthorityEnabled: mintAuthorityEnabled,
            freezeAuthorityEnabled: freezeAuthorityEnabled,
            top10HolderPercent: top10HolderPercent,
            totalCreated: totalCreated,
            rugged: rugged,
            successful: successful,
            avgPeakMarketCap: avgPeakMarketCap,
            tokens: tokens,
            hasSocialLinks: hasSocialLinks
        });

    } catch (error) {
        console.error('Server error:', error);
        return res.status(500).json({ error: 'Server error', message: error.message });
    }
}
