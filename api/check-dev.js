// Vercel Serverless Function: /api/check-dev.js
// Enhanced Dev History: Cross-references Helius data with Dexscreener for real market cap analysis

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

    const { creatorAddress } = req.body;

    if (!creatorAddress) {
        return res.status(400).json({ error: 'Missing creatorAddress' });
    }

    // Helius API Key (stored securely on server)
    const apiKey = "9b583a75-fa36-4da9-932d-db8e4e06ae35";
    const heliusUrl = `https://mainnet.helius-rpc.com/?api-key=${apiKey}`;

    try {
        // Step 1: Fetch all tokens created by this wallet from Helius
        const heliusResponse = await fetch(heliusUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 'memeradar-check',
                method: 'searchAssets',
                params: {
                    ownerAddress: creatorAddress,
                    creatorAddress: creatorAddress,
                    burnt: false,
                    page: 1,
                    limit: 100,
                    sortBy: { sortBy: "created", sortDirection: "desc" }
                },
            }),
        });

        const heliusData = await heliusResponse.json();

        if (heliusData.error) {
            console.error('Helius API error:', heliusData.error);
            return res.status(500).json({ error: 'Helius API error', details: heliusData.error });
        }

        const result = heliusData.result;

        if (!result || !result.items || result.items.length === 0) {
            return res.status(200).json({
                totalCreated: 0,
                tokens: [],
                avgPeakMarketCap: 0,
                riskLevel: 'UNKNOWN',
                rugged: 0,
                successful: 0
            });
        }

        const assets = result.items || [];

        // Step 2: Extract mint addresses and cross-reference with Dexscreener (max 10 tokens)
        const tokenHistory = [];
        let totalMarketCap = 0;
        let tokensWithData = 0;
        let rugged = 0;
        let successful = 0;

        // Process up to 10 tokens to avoid rate limiting
        const tokensToCheck = assets.slice(0, 10);

        for (const asset of tokensToCheck) {
            const mintAddress = asset.id;
            const tokenName = asset.content?.metadata?.name || 'Unknown';
            const tokenSymbol = asset.content?.metadata?.symbol || '???';

            try {
                // Call Dexscreener API for this token
                const dexResponse = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mintAddress}`);
                const dexData = await dexResponse.json();

                if (dexData.pairs && dexData.pairs.length > 0) {
                    // Find the pair with highest market cap (peak indicator)
                    const bestPair = dexData.pairs.reduce((best, pair) => {
                        const mcap = pair.marketCap || pair.fdv || 0;
                        return mcap > (best.marketCap || best.fdv || 0) ? pair : best;
                    }, dexData.pairs[0]);

                    const marketCap = bestPair.marketCap || bestPair.fdv || 0;
                    const liquidity = bestPair.liquidity?.usd || 0;
                    const priceChange = bestPair.priceChange?.h24 || 0;

                    tokenHistory.push({
                        mint: mintAddress,
                        name: bestPair.baseToken?.name || tokenName,
                        symbol: bestPair.baseToken?.symbol || tokenSymbol,
                        marketCap: marketCap,
                        liquidity: liquidity,
                        priceChange24h: priceChange,
                        status: marketCap > 10000 ? 'ACTIVE' : 'DEAD',
                        dexUrl: `https://dexscreener.com/solana/${mintAddress}`
                    });

                    if (marketCap > 0) {
                        totalMarketCap += marketCap;
                        tokensWithData++;
                    }

                    // Classification
                    if (marketCap > 50000) {
                        successful++;
                    } else if (marketCap < 5000 || liquidity < 1000) {
                        rugged++;
                    }
                } else {
                    // No Dexscreener data = likely dead/rugged
                    tokenHistory.push({
                        mint: mintAddress,
                        name: tokenName,
                        symbol: tokenSymbol,
                        marketCap: 0,
                        liquidity: 0,
                        priceChange24h: 0,
                        status: 'DEAD',
                        dexUrl: null
                    });
                    rugged++;
                }
            } catch (dexError) {
                console.error('Dexscreener fetch error:', dexError);
                // Still add to history but mark as unknown
                tokenHistory.push({
                    mint: mintAddress,
                    name: tokenName,
                    symbol: tokenSymbol,
                    marketCap: 0,
                    status: 'UNKNOWN'
                });
            }

            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Step 3: Calculate averages and risk level
        const avgPeakMarketCap = tokensWithData > 0 ? Math.round(totalMarketCap / tokensWithData) : 0;

        let riskLevel = 'UNKNOWN';
        if (tokensWithData > 0) {
            if (avgPeakMarketCap >= 100000) {
                riskLevel = 'LOW'; // Builder - avg peak > $100k
            } else if (avgPeakMarketCap >= 10000) {
                riskLevel = 'MEDIUM'; // Mixed history
            } else {
                riskLevel = 'HIGH'; // Serial rugger - avg peak < $10k
            }
        }

        return res.status(200).json({
            totalCreated: result.total || assets.length,
            tokens: tokenHistory,
            avgPeakMarketCap: avgPeakMarketCap,
            riskLevel: riskLevel,
            rugged: rugged,
            successful: successful,
            tokensAnalyzed: tokensToCheck.length
        });

    } catch (error) {
        console.error('Server error:', error);
        return res.status(500).json({ error: 'Server error', message: error.message });
    }
}

