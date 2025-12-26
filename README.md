# Crypto AI Agent 🤖

Professional AI-powered memecoin analyzer using live data from **Dexscreener** and **Axiom Exchange**.

![Preview](https://img.shields.io/badge/Status-Live-brightgreen) ![Platform](https://img.shields.io/badge/Platform-Web-blue) ![License](https://img.shields.io/badge/License-MIT-yellow)

## Features

- 🔍 **Token Search** - Search by ticker symbol or contract address
- 📊 **Live Market Data** - Real-time price, market cap, liquidity, volume
- 🔗 **On-Chain Metrics** - Transaction counts, buy/sell ratios
- 📈 **Market Sentiment** - Volume trends, whale activity, community hype
- 🔮 **6-Month Predictions** - Bullish/Neutral/Bearish scenarios (speculative)
- 🛡️ **Risk Analysis** - Rug pull, liquidity, holder concentration risks
- 🧠 **AI Verdict** - Project strength and investor suitability

## Blocked Tokens

This agent **ONLY** analyzes memecoins. The following are blocked:
- Bitcoin (BTC), Ethereum (ETH), Solana (SOL)
- All large-cap tokens (>$1B market cap)
- Stablecoins (USDT, USDC)

## Tech Stack

- **Frontend**: Vanilla HTML, CSS, JavaScript (ES6 Modules)
- **API**: Dexscreener Public API
- **Design**: Dark theme with neon green accents, glassmorphism

## Quick Start

```bash
# Clone the repository
git clone https://github.com/aody34/crypto-ai-agent.git
cd crypto-ai-agent

# Serve locally (requires Node.js)
npx http-server -p 3000 --cors

# Open in browser
# http://localhost:3000
```

## Project Structure

```
├── index.html    # Main HTML structure
├── index.css     # Design system & styles
├── main.js       # Application logic
├── api.js        # Dexscreener API integration
├── utils.js      # Utility functions
└── config.js     # Configuration & constants
```

## Disclaimer

⚠️ **This is NOT financial advice.** Predictions are speculative and based on historical data, market behavior, and on-chain indicators. Cryptocurrency markets are highly volatile. Always DYOR.

## License

MIT License - Free to use and modify.
