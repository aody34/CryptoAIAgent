// ===========================================
// MEMERADAR - SOLANA RPC MODULE
// Direct Blockchain Interaction via Helius
// ===========================================

import { CONFIG } from './config.js';

/**
 * SolanaRPC - Handles direct blockchain connections
 */
export class SolanaRPC {
    constructor() {
        this.endpoint = CONFIG.RPC_URL;
        this.id = 1;
    }

    /**
     * Make a JSON-RPC request to the Solana Node
     * @param {string} method - RPC method name
     * @param {Array} params - RPC parameters
     */
    async request(method, params = []) {
        try {
            const body = JSON.stringify({
                jsonrpc: '2.0',
                id: this.id++,
                method: method,
                params: params
            });

            const response = await fetch(this.endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: body
            });

            if (!response.ok) {
                throw new Error(`RPC Error: ${response.statusText}`);
            }

            const data = await response.json();

            if (data.error) {
                console.warn('RPC Node Error:', data.error);
                return null;
            }

            return data.result;
        } catch (error) {
            console.error('RPC Request Failed:', error);
            return null;
        }
    }

    /**
     * Get Top 20 Token Holders
     * @param {string} mintAddress - Token mint address
     */
    async getTopHolders(mintAddress) {
        // Valid Solana address check
        if (!mintAddress || mintAddress.length < 32) return [];

        const result = await this.request('getTokenLargestAccounts', [
            mintAddress,
            { commitment: 'finalized' }
        ]);

        if (!result || !result.value) return [];
        return result.value.slice(0, 20); // Top 20
    }

    /**
     * Get SOL Balance for a wallet (in SOL)
     * @param {string} walletAddress 
     */
    async getBalance(walletAddress) {
        const result = await this.request('getBalance', [
            walletAddress,
            { commitment: 'processed' }
        ]);

        if (result && result.value !== undefined) {
            return result.value / 1000000000; // Convert lamports to SOL
        }
        return 0;
    }

    /**
     * Check if an account is a Program/Contract
     * @param {string} address 
     */
    async isProgram(address) {
        const result = await this.request('getAccountInfo', [
            address,
            { encoding: 'base64' }
        ]);

        if (result && result.value) {
            return result.value.executable; // True if it's a program
        }
        return false;
    }
}

export const solanaRPC = new SolanaRPC();
