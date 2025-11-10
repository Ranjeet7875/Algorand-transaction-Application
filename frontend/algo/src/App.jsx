import React, { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [mnemonic, setMnemonic] = useState('');
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [txResult, setTxResult] = useState(null);
  const [txStatus, setTxStatus] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [error, setError] = useState('');

  const API_URL = 'http://localhost:5000/api/algorand';

  useEffect(() => {
    fetchTransactions();
  }, []);

  const fetchTransactions = async () => {
    try {
      const response = await fetch(`${API_URL}/transactions`);
      const data = await response.json();
      if (data.success) {
        setTransactions(data.transactions);
      }
    } catch (err) {
      console.error('Failed to fetch transactions:', err);
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    setError('');
    setTxResult(null);
    setTxStatus(null);
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mnemonic,
          recipientAddress: recipient,
          amount: parseFloat(amount),
          note
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setTxResult(data);
        checkStatus(data.txId);
        fetchTransactions();
        
        // Clear form
        setRecipient('');
        setAmount('');
        setNote('');
      } else {
        setError(data.error || 'Transaction failed');
      }
    } catch (err) {
      setError('Network error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const checkStatus = async (txId) => {
    try {
      const response = await fetch(`${API_URL}/status/${txId}`);
      const data = await response.json();
      setTxStatus(data);

      // Keep checking if pending
      if (data.status === 'pending') {
        setTimeout(() => checkStatus(txId), 3000);
      } else {
        fetchTransactions();
      }
    } catch (err) {
      console.error('Failed to check status:', err);
    }
  };

  const manualCheckStatus = async (txId) => {
    try {
      const response = await fetch(`${API_URL}/status/${txId}`);
      const data = await response.json();
      alert(`Status: ${data.status}\nConfirmed Round: ${data.confirmedRound || 'N/A'}`);
      fetchTransactions();
    } catch (err) {
      alert('Failed to check status: ' + err.message);
    }
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>🔷 Algorand TestNet Transaction App</h1>
        <p>Send ALGO on TestNet and track transactions</p>
      </header>

      <div className="main-content">
        <div className="form-section">
          <h2>Send ALGO</h2>
          <form onSubmit={handleSend} className="transaction-form">
            <div className="form-group">
              <label>Sender Mnemonic (25 words)</label>
              <textarea
                value={mnemonic}
                onChange={(e) => setMnemonic(e.target.value)}
                placeholder="Enter your test mnemonic..."
                required
                rows="3"
              />
            </div>

            <div className="form-group">
              <label>Recipient Address</label>
              <input
                type="text"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="Enter recipient address..."
                required
              />
            </div>

            <div className="form-group">
              <label>Amount (ALGO)</label>
              <input
                type="number"
                step="0.000001"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.0"
                required
              />
            </div>

            <div className="form-group">
              <label>Note (Optional)</label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Transaction note..."
              />
            </div>

            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Sending...' : 'Send Transaction'}
            </button>
          </form>

          {error && (
            <div className="alert alert-error">
              <strong>Error:</strong> {error}
            </div>
          )}

          {txResult && (
            <div className="alert alert-success">
              <h3>Transaction Sent! ✅</h3>
              <p><strong>Transaction ID:</strong> {txResult.txId}</p>
              <p><strong>From:</strong> {txResult.from}</p>
              <p><strong>To:</strong> {txResult.to}</p>
              <p><strong>Amount:</strong> {txResult.amount} ALGO</p>
            </div>
          )}

          {txStatus && (
            <div className={`alert ${txStatus.status === 'confirmed' ? 'alert-success' : 'alert-info'}`}>
              <h3>Transaction Status</h3>
              <p><strong>Status:</strong> {txStatus.status.toUpperCase()}</p>
              {txStatus.confirmedRound && (
                <p><strong>Confirmed Round:</strong> {txStatus.confirmedRound}</p>
              )}
              {txStatus.status === 'pending' && (
                <p className="status-pending">⏳ Waiting for confirmation...</p>
              )}
            </div>
          )}
        </div>

        <div className="transactions-section">
          <h2>Transaction History</h2>
          <div className="transaction-list">
            {transactions.length === 0 ? (
              <p className="no-transactions">No transactions yet</p>
            ) : (
              transactions.map((tx) => (
                <div key={tx._id} className="transaction-card">
                  <div className="tx-header">
                    <span className={`status-badge ${tx.status}`}>
                      {tx.status.toUpperCase()}
                    </span>
                    <span className="tx-date">
                      {new Date(tx.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <div className="tx-details">
                    <p><strong>TX ID:</strong> <span className="tx-id">{tx.txId}</span></p>
                    <p><strong>From:</strong> {tx.from.substring(0, 10)}...</p>
                    <p><strong>To:</strong> {tx.to.substring(0, 10)}...</p>
                    <p><strong>Amount:</strong> {tx.amount} ALGO</p>
                    {tx.note && <p><strong>Note:</strong> {tx.note}</p>}
                    {tx.confirmedRound && (
                      <p><strong>Round:</strong> {tx.confirmedRound}</p>
                    )}
                  </div>
                  <button 
                    onClick={() => manualCheckStatus(tx.txId)}
                    className="btn-secondary"
                  >
                    Check Status
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;