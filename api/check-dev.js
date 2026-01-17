// Vercel Serverless Function: /api/check-dev.js
// This keeps the Helius API key secure on the server side

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
    const url = `https://mainnet.helius-rpc.com/?api-key=${apiKey}`;

    try {
        const response = await fetch(url, {
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
                    limit: 1000,
                    sortBy: { sortBy: "created", sortDirection: "desc" }
                },
            }),
        });

        const data = await response.json();

        if (data.error) {
            console.error('Helius API error:', data.error);
            return res.status(500).json({ error: 'Helius API error', details: data.error });
        }

        const result = data.result;

        if (!result) {
            return res.status(200).json({
                totalCreated: 0,
                assets: [],
                rugged: 0,
                successful: 0
            });
        }

        // Analyze the assets
        let rugged = 0;
        let successful = 0;
        const assets = result.items || [];

        assets.forEach(asset => {
            // Criteria for analysis:
            // - Rugged: No price info, burnt, or very low supply indicators
            // - Successful: Has valid metadata, verified, etc.

            const hasName = asset.content?.metadata?.name;
            const isVerified = asset.creators?.some(c => c.verified);
            const burnt = asset.burnt;

            if (burnt || (!hasName && !isVerified)) {
                rugged++;
            } else if (isVerified || hasName) {
                successful++;
            }
        });

        return res.status(200).json({
            totalCreated: result.total || assets.length,
            assets: assets.slice(0, 50), // Return first 50 for display
            rugged: rugged,
            successful: successful
        });

    } catch (error) {
        console.error('Server error:', error);
        return res.status(500).json({ error: 'Server error', message: error.message });
    }
}
