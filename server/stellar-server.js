// server/stellar-server.js
import express from 'express';
import StellarSdk from 'stellar-sdk';
import dotenv from 'dotenv';
import mongoClient from '../lib/mongodb.js';
import { predictGoalOutcome } from './ml-oracle.js';

dotenv.config();

const app = express();
app.use(express.json());

// Initialize Stellar SDK
const server = new StellarSdk.Server(process.env.STELLAR_RPC_URL || 'https://horizon-testnet.stellar.org');
const networkPassphrase = StellarSdk.Networks.TESTNET_NETWORK_PASSPHRASE;
const fundingKeypair = StellarSdk.Keypair.fromSecret(process.env.STELLAR_FUNDING_KEY);

// Contract addresses on Stellar testnet
const GOAL_ESCROW_CONTRACT = process.env.GOAL_ESCROW_CONTRACT_ID;
const REWARD_POOL_CONTRACT = process.env.REWARD_POOL_CONTRACT_ID;
const ORACLE_CONTRACT = process.env.ORACLE_CONTRACT_ID;
const USDC_CONTRACT = process.env.USDC_CONTRACT_ID; // Stellar USDC

// =========================
// Utility Functions
// =========================

async function getAccountSequence(publicKey) {
    const account = await server.loadAccount(publicKey);
    return account.sequence;
}

function createInvokeContractOp(
    contractId,
    method,
    args,
    invoker
) {
    return StellarSdk.Operation.invokeHostFunction({
        func: StellarSdk.xdr.HostFunction.hostFunctionTypeInvokeContract(
            new StellarSdk.xdr.InvokeContractArgs({
                contractAddress: StellarSdk.Address.contract(
                    Buffer.from(contractId, 'hex')
                ),
                functionName: Buffer.from(method),
                args: args,
            })
        ),
        auth: [
            StellarSdk.xdr.SorobanAuthorizationEntry.sorobanAuthorizationEntry(
                new StellarSdk.xdr.SorobanAuthorizedInvocation({
                    function: StellarSdk.xdr.HostFunction.hostFunctionTypeInvokeContract(
                        new StellarSdk.xdr.InvokeContractArgs({
                            contractAddress: StellarSdk.Address.contract(
                                Buffer.from(contractId, 'hex')
                            ),
                            functionName: Buffer.from(method),
                            args: args,
                        })
                    ),
                    subInvocations: [],
                }),
                StellarSdk.xdr.Int64.fromString('0')
            ),
        ],
    });
}

async function submitTransaction(transaction) {
    const envelope = transaction.toEnvelope();
    const txBase64 = envelope.toXDR('base64');

    const response = await fetch(process.env.STELLAR_RPC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'sendTransaction',
            params: [txBase64],
        }),
    });

    const result = await response.json();
    return result.result;
}

// =========================
// Goal Management API
// =========================

app.post('/api/goals/create', async (req, res) => {
    try {
        const {
            userAddress,
            targetValue,
            deadline,
            stake,
            rewardMultiplier,
            metadata,
        } = req.body;

        // Validate Stellar address
        if (!StellarSdk.StrKey.isValidEd25519PublicKey(userAddress)) {
            return res.status(400).json({ error: 'Invalid Stellar address' });
        }

        // Get account sequence
        const sequence = await getAccountSequence(userAddress);

        // Build transaction
        const account = new StellarSdk.Account(userAddress, sequence);
        const transaction = new StellarSdk.TransactionBuilder(account, {
            fee: StellarSdk.BASE_FEE,
            networkPassphrase,
        })
            .setTimeout(30)
            .addOperation(
                createInvokeContractOp(
                    GOAL_ESCROW_CONTRACT,
                    'create_goal',
                    [
                        StellarSdk.Address.account(userAddress),
                        StellarSdk.nativeToScVal(targetValue * 1e7, { type: 'i128' }),
                        StellarSdk.nativeToScVal(deadline, { type: 'u64' }),
                        StellarSdk.nativeToScVal(stake * 1e7, { type: 'i128' }),
                        StellarSdk.nativeToScVal(rewardMultiplier, { type: 'u32' }),
                        StellarSdk.nativeToScVal(Buffer.from(metadata || ''), {
                            type: 'bytes',
                        }),
                    ],
                    userAddress
                )
            )
            .build();

        // Return unsigned transaction for client signing
        res.json({
            transaction: transaction.toEnvelope().toXDR('base64'),
            hash: transaction.hash().toString('hex'),
        });
    } catch (error) {
        console.error('Error creating goal:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/goals/resolve', async (req, res) => {
    try {
        const {
            goalId,
            creatorAddress,
            outcomeValue,
            succeeded,
        } = req.body;

        const sequence = await getAccountSequence(fundingKeypair.publicKey());

        const account = new StellarSdk.Account(
            fundingKeypair.publicKey(),
            sequence
        );
        const transaction = new StellarSdk.TransactionBuilder(account, {
            fee: StellarSdk.BASE_FEE,
            networkPassphrase,
        })
            .setTimeout(30)
            .addOperation(
                createInvokeContractOp(
                    GOAL_ESCROW_CONTRACT,
                    'resolve_goal',
                    [
                        StellarSdk.nativeToScVal(goalId, { type: 'u64' }),
                        StellarSdk.Address.account(creatorAddress),
                        StellarSdk.nativeToScVal(outcomeValue * 1e7, { type: 'i128' }),
                        StellarSdk.nativeToScVal(succeeded, { type: 'bool' }),
                    ]
                )
            )
            .build();

        transaction.sign(fundingKeypair);

        const result = await submitTransaction(transaction);

        res.json({
            success: true,
            result: result,
        });
    } catch (error) {
        console.error('Error resolving goal:', error);
        res.status(500).json({ error: error.message });
    }
});

// =========================
// Oracle & Prediction API
// =========================

app.get('/api/predict/:goalId', async (req, res) => {
    try {
        const { goalId } = req.params;

        const db = mongoClient.db(process.env.MONGODB_DB);
        const goalsCollection = db.collection('goals');

        const goal = await goalsCollection.findOne({ id: parseInt(goalId) });
        if (!goal) {
            return res.status(404).json({ error: 'Goal not found' });
        }

        // Use ML model to predict outcome
        const prediction = await predictGoalOutcome(goal);

        res.json({
            goalId,
            predictedSuccessProbability: prediction.probability,
            predictedValue: prediction.value,
            recommendedOdds: prediction.recommendedMultiplier,
        });
    } catch (error) {
        console.error('Error predicting outcome:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/oracle/propose-outcome', async (req, res) => {
    try {
        const {
            goalId,
            creatorAddress,
            outcomeValue,
            succeeded,
            operatorSecret,
        } = req.body;

        const operatorKeypair = StellarSdk.Keypair.fromSecret(operatorSecret);
        const sequence = await getAccountSequence(operatorKeypair.publicKey());

        const account = new StellarSdk.Account(
            operatorKeypair.publicKey(),
            sequence
        );
        const transaction = new StellarSdk.TransactionBuilder(account, {
            fee: StellarSdk.BASE_FEE,
            networkPassphrase,
        })
            .setTimeout(30)
            .addOperation(
                createInvokeContractOp(
                    ORACLE_CONTRACT,
                    'propose_outcome',
                    [
                        StellarSdk.nativeToScVal(goalId, { type: 'u64' }),
                        StellarSdk.Address.account(creatorAddress),
                        StellarSdk.nativeToScVal(outcomeValue * 1e7, { type: 'i128' }),
                        StellarSdk.nativeToScVal(succeeded, { type: 'bool' }),
                    ],
                    operatorKeypair.publicKey()
                )
            )
            .build();

        transaction.sign(operatorKeypair);

        const result = await submitTransaction(transaction);

        res.json({
            success: true,
            result: result,
        });
    } catch (error) {
        console.error('Error proposing outcome:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/oracle/confirm-outcome', async (req, res) => {
    try {
        const {
            goalId,
            creatorAddress,
            operatorSecret,
        } = req.body;

        const operatorKeypair = StellarSdk.Keypair.fromSecret(operatorSecret);
        const sequence = await getAccountSequence(operatorKeypair.publicKey());

        const account = new StellarSdk.Account(
            operatorKeypair.publicKey(),
            sequence
        );
        const transaction = new StellarSdk.TransactionBuilder(account, {
            fee: StellarSdk.BASE_FEE,
            networkPassphrase,
        })
            .setTimeout(30)
            .addOperation(
                createInvokeContractOp(
                    ORACLE_CONTRACT,
                    'confirm_outcome',
                    [
                        StellarSdk.nativeToScVal(goalId, { type: 'u64' }),
                        StellarSdk.Address.account(creatorAddress),
                    ],
                    operatorKeypair.publicKey()
                )
            )
            .build();

        transaction.sign(operatorKeypair);

        const result = await submitTransaction(transaction);

        res.json({
            success: true,
            result: result,
        });
    } catch (error) {
        console.error('Error confirming outcome:', error);
        res.status(500).json({ error: error.message });
    }
});

// =========================
// Query API
// =========================

app.get('/api/goals/:userAddress', async (req, res) => {
    try {
        const { userAddress } = req.params;

        if (!StellarSdk.StrKey.isValidEd25519PublicKey(userAddress)) {
            return res.status(400).json({ error: 'Invalid Stellar address' });
        }

        const db = mongoClient.db(process.env.MONGODB_DB);
        const goalsCollection = db.collection('goals');

        const goals = await goalsCollection
            .find({ creator: userAddress })
            .toArray();

        res.json({ goals });
    } catch (error) {
        console.error('Error fetching goals:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/portfolio/:userAddress', async (req, res) => {
    try {
        const { userAddress } = req.params;

        if (!StellarSdk.StrKey.isValidEd25519PublicKey(userAddress)) {
            return res.status(400).json({ error: 'Invalid Stellar address' });
        }

        const db = mongoClient.db(process.env.MONGODB_DB);
        const portfolioCollection = db.collection('portfolios');

        const portfolio = await portfolioCollection.findOne({
            address: userAddress,
        });

        if (!portfolio) {
            return res.json({
                address: userAddress,
                goals: [],
                totalStaked: 0,
                totalEarned: 0,
            });
        }

        res.json(portfolio);
    } catch (error) {
        console.error('Error fetching portfolio:', error);
        res.status(500).json({ error: error.message });
    }
});

// =========================
// Health Check
// =========================

app.get('/health', (req, res) => {
    res.json({ status: 'ok', network: 'stellar-testnet' });
});

export default app;
