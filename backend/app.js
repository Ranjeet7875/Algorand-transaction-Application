const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const algosdk = require('algosdk');

const app = express();
app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose.connect('mongodb+srv://ranvishwakarma122:nNjOcMP7oTBVqWVK@cluster0.cbs5t.mongodb.net/algorand-app', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// Transaction Schema
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

// Algorand TestNet Configuration
const algodToken = '';
const algodServer = 'https://testnet-api.algonode.cloud';
const algodPort = 443;
const algodClient = new algosdk.Algodv2(algodToken, algodServer, algodPort);


app.post('/api/algorand/send', async (req, res) => {
  try {
    const { mnemonic, recipientAddress, amount, note } = req.body;

    // Validate inputs
    if (!mnemonic || !recipientAddress || !amount) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    
    const senderAccount = algosdk.mnemonicToSecretKey(mnemonic);
    const senderAddress = senderAccount.addr;

    
    const params = await algodClient.getTransactionParams().do();

    
    const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      from: senderAddress,
      to: recipientAddress,
      amount: Math.floor(amount * 1000000), 
      note: note ? new TextEncoder().encode(note) : undefined,
      suggestedParams: params
    });

    
    const signedTxn = txn.signTxn(senderAccount.sk);

    
    const { txId } = await algodClient.sendRawTransaction(signedTxn).do();

   
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
      txId,
      from: senderAddress,
      to: recipientAddress,
      amount
    });

  } catch (error) {
    console.error('Send transaction error:', error);
    res.status(500).json({ 
      error: 'Failed to send transaction', 
      details: error.message 
    });
  }
});


app.get('/api/algorand/status/:txId', async (req, res) => {
  try {
    const { txId } = req.params;

    // Check transaction status from Algorand
    const txInfo = await algodClient.pendingTransactionInformation(txId).do();

    let status = 'pending';
    let confirmedRound = null;

    if (txInfo['confirmed-round']) {
      status = 'confirmed';
      confirmedRound = txInfo['confirmed-round'];

      // Update MongoDB
      await Transaction.findOneAndUpdate(
        { txId },
        { status, confirmedRound },
        { new: true }
      );
    }

    res.json({
      txId,
      status,
      confirmedRound,
      poolError: txInfo['pool-error'] || null
    });

  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({ 
      error: 'Failed to check transaction status', 
      details: error.message 
    });
  }
});


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
    console.error('Fetch transactions error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch transactions', 
      details: error.message 
    });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Connected to MongoDB');
  console.log('Algorand TestNet configured');
});