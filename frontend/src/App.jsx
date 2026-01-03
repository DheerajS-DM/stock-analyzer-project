
import React, { useEffect, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar
} from 'recharts';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

export default function StockAnalyzer() {
  const [stocks, setStocks] = useState([]);
  const [selectedStock, setSelectedStock] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch all stocks on mount
  useEffect(() => {
    fetchAllStocks();
  }, []);

  const fetchAllStocks = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/stocks`);
      const data = await response.json();
      
      setStocks(data.stocks);
      if (data.stocks.length > 0) {
        setSelectedStock(data.stocks[0]);
        await fetchStockChart(data.stocks[0].symbol);
      }
      setError(null);
    } catch (err) {
      setError('Failed to load stocks: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchStockChart = async (symbol) => {
    // Placeholder chart data (you'd fetch historical prices here)
    // For MVP, we'll show a simple mock
    const mockData = [
      { date: '4y ago', price: 100 },
      { date: '3y ago', price: 120 },
      { date: '2y ago', price: 150 },
      { date: '1y ago', price: 180 },
      { date: '6m ago', price: 200 },
      { date: 'Today', price: 220 }
    ];
    setChartData(mockData);
  };

  const handleStockSelect = (stock) => {
    setSelectedStock(stock);
    fetchStockChart(stock.symbol);
  };

  const handleManualUpdate = async () => {
    if (!selectedStock) return;
    
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/update/${selectedStock.symbol}`);
      const data = await response.json();
      
      if (!data.error) {
        setSelectedStock(data);
      }
    } catch (err) {
      setError('Update failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const signalColor = (signal) => signal === 'GOOD' ? '#10b981' : '#ef4444';
  const signalBg = (signal) => signal === 'GOOD' ? '#ecfdf5' : '#fef2f2';

  return (
    <div style={{
      fontFamily: 'system-ui, -apple-system, sans-serif',
      background: '#0f172a',
      color: '#e2e8f0',
      minHeight: '100vh',
      padding: '20px'
    }}>
      {/* Header */}
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <h1 style={{ marginBottom: '30px' }}>📈 Stock Value Analyzer</h1>

        {/* Error */}
        {error && (
          <div style={{
            background: '#fef2f2',
            border: '1px solid #fca5a5',
            color: '#991b1b',
            padding: '12px',
            borderRadius: '8px',
            marginBottom: '20px'
          }}>
            {error}
          </div>
        )}

        {/* Main Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px' }}>
          
          {/* LEFT: Stock Dropdown & Info */}
          <div>
            <div style={{
              background: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '12px',
              padding: '20px'
            }}>
              <h3 style={{ marginTop: 0 }}>Select Stock</h3>
              
              <select
                value={selectedStock?.symbol || ''}
                onChange={(e) => {
                  const stock = stocks.find(s => s.symbol === e.target.value);
                  if (stock) handleStockSelect(stock);
                }}
                style={{
                  width: '100%',
                  padding: '10px',
                  marginBottom: '20px',
                  background: '#0f172a',
                  color: '#e2e8f0',
                  border: '1px solid #334155',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                {stocks.map(stock => (
                  <option key={stock.symbol} value={stock.symbol}>
                    {stock.symbol}
                  </option>
                ))}
              </select>

              {selectedStock && (
                <>
                  {/* Signal Badge */}
                  <div style={{
                    background: signalBg(selectedStock.signal),
                    padding: '15px',
                    borderRadius: '8px',
                    marginBottom: '15px',
                    borderLeft: `4px solid ${signalColor(selectedStock.signal)}`
                  }}>
                    <div style={{
                      fontSize: '24px',
                      fontWeight: 'bold',
                      color: signalColor(selectedStock.signal),
                      marginBottom: '5px'
                    }}>
                      {selectedStock.signal === 'GOOD' ? '✅ BUY' : '❌ SELL'}
                    </div>
                    <div style={{ fontSize: '14px', color: signalColor(selectedStock.signal) }}>
                      {selectedStock.margin > 0 ? '+' : ''}{selectedStock.margin}% 
                      {selectedStock.margin > 0 ? ' Undervalued' : ' Overvalued'}
                    </div>
                  </div>

                  {/* Stats */}
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: '1fr 1fr', 
                    gap: '10px',
                    marginBottom: '15px'
                  }}>
                    <div style={{
                      background: '#334155',
                      padding: '12px',
                      borderRadius: '6px'
                    }}>
                      <div style={{ fontSize: '12px', color: '#94a3b8' }}>Current Price</div>
                      <div style={{ fontSize: '20px', fontWeight: 'bold', marginTop: '5px' }}>
                        ${selectedStock.current_price}
                      </div>
                    </div>
                    <div style={{
                      background: '#334155',
                      padding: '12px',
                      borderRadius: '6px'
                    }}>
                      <div style={{ fontSize: '12px', color: '#94a3b8' }}>Value Coeff</div>
                      <div style={{ fontSize: '20px', fontWeight: 'bold', marginTop: '5px' }}>
                        {selectedStock.value_coefficient}
                      </div>
                    </div>
                    <div style={{
                      background: '#334155',
                      padding: '12px',
                      borderRadius: '6px'
                    }}>
                      <div style={{ fontSize: '12px', color: '#94a3b8' }}>Weighted Avg</div>
                      <div style={{ fontSize: '16px', fontWeight: 'bold', marginTop: '5px' }}>
                        ${selectedStock.weighted_avg}
                      </div>
                    </div>
                    <div style={{
                      background: '#334155',
                      padding: '12px',
                      borderRadius: '6px'
                    }}>
                      <div style={{ fontSize: '12px', color: '#94a3b8' }}>Last Updated</div>
                      <div style={{ fontSize: '12px', fontWeight: 'bold', marginTop: '5px', color: '#10b981' }}>
                        Today
                      </div>
                    </div>
                  </div>

                  {/* Buttons */}
                  <button
                    onClick={handleManualUpdate}
                    disabled={loading}
                    style={{
                      width: '100%',
                      padding: '12px',
                      background: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                      marginBottom: '10px'
                    }}
                  >
                    {loading ? 'Updating...' : 'Refresh Data'}
                  </button>

                  <a
                    href={`https://finance.yahoo.com/quote/${selectedStock.symbol}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'block',
                      padding: '12px',
                      background: '#475569',
                      color: '#e2e8f0',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      textAlign: 'center',
                      textDecoration: 'none',
                      fontWeight: 'bold'
                    }}
                  >
                    📊 Yahoo Finance
                  </a>
                </>
              )}
            </div>
          </div>

          {/* RIGHT: Chart & Weight Distribution */}
          <div>
            {/* Price Chart */}
            <div style={{
              background: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '12px',
              padding: '20px',
              marginBottom: '20px'
            }}>
              <h3 style={{ marginTop: 0 }}>4-Year Price Trend</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid stroke="#334155" />
                  <XAxis dataKey="date" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip 
                    contentStyle={{
                      background: '#0f172a',
                      border: '1px solid #334155',
                      borderRadius: '6px',
                      color: '#e2e8f0'
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="price"
                    stroke="#3b82f6"
                    dot={{ fill: '#3b82f6' }}
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Weight Distribution */}
            {selectedStock?.weight_distribution && (
              <div style={{
                background: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '12px',
                padding: '20px'
              }}>
                <h3 style={{ marginTop: 0 }}>Weight Distribution</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                  <div style={{ 
                    textAlign: 'center',
                    padding: '15px',
                    background: '#334155',
                    borderRadius: '6px'
                  }}>
                    <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#10b981' }}>
                      {selectedStock.weight_distribution.last_week}%
                    </div>
                    <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '5px' }}>
                      Last Week
                    </div>
                  </div>
                  <div style={{ 
                    textAlign: 'center',
                    padding: '15px',
                    background: '#334155',
                    borderRadius: '6px'
                  }}>
                    <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#f59e0b' }}>
                      {selectedStock.weight_distribution.last_month}%
                    </div>
                    <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '5px' }}>
                      Last Month
                    </div>
                  </div>
                  <div style={{ 
                    textAlign: 'center',
                    padding: '15px',
                    background: '#334155',
                    borderRadius: '6px'
                  }}>
                    <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#3b82f6' }}>
                      {selectedStock.weight_distribution.last_6months}%
                    </div>
                    <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '5px' }}>
                      Last 6 Months
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          marginTop: '40px',
          padding: '20px',
          background: '#1e293b',
          borderRadius: '12px',
          textAlign: 'center',
          color: '#94a3b8',
          fontSize: '12px'
        }}>
          <p>
            ⚠️ Not financial advice. For educational purposes only. 
            Algorithm updates daily at 9:30 AM EST.
          </p>
        </div>
      </div>
    </div>
  );
}
