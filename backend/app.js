const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const algosdk = require('algosdk');

const app = express();
app.use(cors());
app.use(express.json());

// ================== MongoDB Connection ==================
mongoose.connect('mongodb+srv://ranvishwakarma122:nNjOcMP7oTBVqWVK@cluster0.cbs5t.mongodb.net/algorand-app', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// ================== Transaction Schema ==================
const transactionSchema = new mongoose.Schema({
  txId: { type: String, required: true, unique: true },
  from: { type: String, required: true },
  to: { type: String, required: true },
  amount: { type: Number, required: true },
  status: { type: String, default: 'pending' },
  note: { type: String },
  createdAt: { type: Date, default: Date.now },
  confirmedRound: { type: Number }
});

const Transaction = mongoose.model('Transaction', transactionSchema);

// ================== Algorand TestNet Configuration ==================
const algodToken = '';
const algodServer = 'https://testnet-api.algonode.cloud';
const algodPort = 443;
const algodClient = new algosdk.Algodv2(algodToken, algodServer, algodPort);

// ================== Helper Function ==================
function validateMnemonic(mnemonic) {
  const words = mnemonic.trim().split(/\s+/);
  return words.length === 25;
}

// ================== POST /api/algorand/send ==================
app.post('/api/algorand/send', async (req, res) => {
  try {
    const { mnemonic, recipientAddress, amount, note } = req.body;

    // Validate inputs
    if (!mnemonic || !recipientAddress || !amount) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate mnemonic format
    if (!validateMnemonic(mnemonic)) {
      return res.status(400).json({ error: 'Invalid mnemonic: must contain exactly 25 words' });
    }

    let senderAccount;
    try {
      senderAccount = algosdk.mnemonicToSecretKey(mnemonic);
    } catch (mnErr) {
      return res.status(400).json({
        error: 'Invalid mnemonic phrase',
        details: mnErr.message
      });
    }

    const senderAddress = senderAccount.addr;

    // Get suggested params
    const params = await algodClient.getTransactionParams().do();

    // Create transaction
    const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      from: senderAddress,
      to: recipientAddress,
      amount: Math.floor(amount * 1e6), // Convert ALGO to microAlgos
      note: note ? new TextEncoder().encode(note) : undefined,
      suggestedParams: params
    });

    // Sign transaction
    const signedTxn = txn.signTxn(senderAccount.sk);

    // Send transaction
    const { txId } = await algodClient.sendRawTransaction(signedTxn).do();

    // Save to MongoDB
    const transaction = new Transaction({
      txId,
      from: senderAddress,
      to: recipientAddress,
      amount,
      status: 'pending',
      note: note || ''
    });

    await transaction.save();

    res.json({
      success: true,
      message: 'Transaction sent successfully!',
      txId,
      from: senderAddress,
      to: recipientAddress,
      amount
    });

  } catch (error) {
    console.error('❌ Send transaction error:', error);
    res.status(500).json({
      error: 'Failed to send transaction',
      details: error.message
    });
  }
});

// ================== GET /api/algorand/status/:txId ==================
app.get('/api/algorand/status/:txId', async (req, res) => {
  try {
    const { txId } = req.params;

    const txInfo = await algodClient.pendingTransactionInformation(txId).do();

    let status = 'pending';
    let confirmedRound = null;

    if (txInfo['confirmed-round']) {
      status = 'confirmed';
      confirmedRound = txInfo['confirmed-round'];

      await Transaction.findOneAndUpdate(
        { txId },
        { status, confirmedRound },
        { new: true }
      );
    }

    res.json({
      success: true,
      txId,
      status,
      confirmedRound,
      poolError: txInfo['pool-error'] || null
    });

  } catch (error) {
    console.error('❌ Status check error:', error);
    res.status(500).json({
      error: 'Failed to check transaction status',
      details: error.message
    });
  }
});

// ================== GET /api/algorand/transactions ==================
app.get('/api/algorand/transactions', async (req, res) => {
  try {
    const transactions = await Transaction.find()
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({
      success: true,
      count: transactions.length,
      transactions
    });

  } catch (error) {
    console.error('❌ Fetch transactions error:', error);
    res.status(500).json({
      error: 'Failed to fetch transactions',
      details: error.message
    });
  }
});

// ================== Start Server ==================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log('✅ Algorand TestNet configured');
});
