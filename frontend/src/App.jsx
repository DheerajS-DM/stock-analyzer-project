import React, { useState, useEffect, useRef } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Brush
} from 'recharts';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

function App() {
  const [stocks, setStocks] = useState([]);
  const [selectedStock, setSelectedStock] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchStocks();
  }, []);

  const fetchStocks = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/stocks`);
      const data = await response.json(); 
      setStocks(data.stocks);
      if (data.stocks.length > 0) {
        setSelectedStock(data.stocks[0]);
        loadChartData(data.stocks[0].symbol);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadChartData = async (symbol) => {
    try {
      const response = await fetch(`${API_URL}/history/${symbol}`);
      const data = await response.json();
      if (data.data) {
        setChartData(data.data);
      }
    } catch (error) {
      console.error('Chart load failed:', error);
    }
  };

  const refreshStock = async (symbol) => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/analyze/${symbol}`);
      const data = await response.json();
      setSelectedStock(data);
      await loadChartData(symbol);
      setStocks(prev => prev.map(s => s.symbol === symbol ? data : s));
    } catch (error) {
      console.error('Refresh error:', error);
    } finally {
      setLoading(false);
    }
  };

  const signalStyle = (signal) => {
    const s = signal?.toUpperCase() || "";
    if (s.includes('BUY') || s.includes('GOOD')) {
      return { color: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.2)', borderColor: '#10b981' }; 
    }
    if (s.includes('SELL') || s.includes('BAD')) {
      return { color: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.2)', borderColor: '#ef4444' }; 
    }
    return { color: '#f59e0b', backgroundColor: 'rgba(245, 158, 11, 0.2)', borderColor: '#f59e0b' }; 
  };

  const getSignalIcon = (signal) => {
    const s = signal?.toUpperCase() || "";
    if (s.includes('BUY')) return '🚀';
    if (s.includes('SELL')) return '❌';
    return '✋'; 
  };

  // --- REUSABLE WARNING COMPONENT ---
  const WarningBox = () => (
    <div style={{
      color: '#ff4444',
      fontWeight: 'bold',
      fontSize: '14px',
      textAlign: 'center',
      border: '2px solid #ff4444',
      backgroundColor: 'rgba(255, 0, 0, 0.15)',
      padding: '12px',
      borderRadius: '8px',
      marginBottom: '20px',
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
      maxWidth: '300px'
    }}>
      ⚠️ Not Financial Advice <br/> 
      <span style={{fontSize: '11px', fontWeight: 'normal', color: '#fca5a5'}}>
        Project for educational purposes only
      </span>
    </div>
  );

  // --- INITIAL LOADING SCREEN (First Load) ---
  if (loading && !stocks.length) {
    return (
      <div style={{ 
        height: '100vh', 
        background: '#0f172a', 
        display: 'flex', 
        flexDirection: 'column',
        alignItems: 'center', 
        justifyContent: 'center', 
        color: '#f1f5f9' 
      }}>
        <div style={{
          width: '50px',
          height: '50px',
          border: '5px solid #334155',
          borderTop: '5px solid #3b82f6',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          marginBottom: '30px'
        }}></div>
        <h2 style={{fontWeight: '400', marginBottom: '30px'}}>Initializing Market Data...</h2>
        
        {/* WARNING ADDED HERE */}
        <WarningBox />

        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{
      fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
      color: '#f1f5f9',
      minHeight: '100vh',
      padding: '20px',
      position: 'relative'
    }}>

      {/* --- RE-ANALYZING OVERLAY (Subsequent Loads) --- */}
      {loading && stocks.length > 0 && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.9)',
          backdropFilter: 'blur(8px)',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{
            width: '60px',
            height: '60px',
            border: '6px solid rgba(255,255,255,0.1)',
            borderTop: '6px solid #3b82f6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            marginBottom: '20px'
          }}></div>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '10px' }}>Crunching Numbers...</div>
          <div style={{ color: '#94a3b8', marginBottom: '30px' }}>Analyzing historical trends & RSI</div>
          
          {/* WARNING ADDED HERE */}
          <WarningBox />
        </div>
      )}

      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <h1 style={{ 
          fontSize: '2.5rem', 
          marginBottom: '10px',
          background: 'linear-gradient(45deg, #3b82f6, #10b981)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}>
          📈 Stock Value Analyzer
        </h1>
        <div style={{ color: '#94a3b8', marginBottom: '40px' }}>
          Real-time analysis of top stocks • Powered by Yahoo Finance
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: '30px' }}>
          
          {/* CONTROLS PANEL */}
          <div style={{
            background: '#1e293b',
            padding: '30px',
            borderRadius: '16px',
            border: '1px solid #334155',
            height: 'fit-content'
          }}>
            <h3 style={{ margin: '0 0 15px 0', color: '#f1f5f9' }}>Stock Controls</h3>

            {/* WARNING IN DASHBOARD */}
            <div style={{
              color: '#ff4444',
              fontWeight: 'bold',
              fontSize: '14px',
              textAlign: 'center',
              border: '2px solid #ff4444',
              backgroundColor: 'rgba(255, 0, 0, 0.1)',
              padding: '12px',
              borderRadius: '8px',
              marginBottom: '25px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              ⚠️ Not Financial Advice <br/> 
              <span style={{fontSize: '11px', fontWeight: 'normal', color: '#fca5a5'}}>
                Project for educational purposes only
              </span>
            </div>
            
            <select
              value={selectedStock?.symbol || ''}
              onChange={(e) => {
                const stock = stocks.find(s => s.symbol === e.target.value);
                if (stock) {
                  setSelectedStock(stock);
                  loadChartData(stock.symbol);
                }
              }}
              style={{
                width: '100%',
                padding: '15px',
                marginBottom: '25px',
                background: '#0f172a',
                color: '#f1f5f9',
                border: '1px solid #475569',
                borderRadius: '10px',
                fontSize: '16px',
                cursor: 'pointer'
              }}
              disabled={loading}
            >
              <option value="">Select stock...</option>
              {stocks.map(stock => (
                <option key={stock.symbol} value={stock.symbol}>
                  {stock.symbol} ({stock.signal} {stock.margin > 0 ? '+' : ''}{stock.margin}%)
                </option>
              ))}
            </select>

            {selectedStock && (
              <>
                {/* SIGNAL CARD */}
                <div style={{
                  ...signalStyle(selectedStock.signal),
                  padding: '25px',
                  borderRadius: '16px',
                  marginBottom: '25px',
                  textAlign: 'center',
                  boxShadow: `0 10px 25px ${signalStyle(selectedStock.signal).backgroundColor}`
                }}>
                  <div style={{ fontSize: '36px', fontWeight: 'bold', marginBottom: '10px' }}>
                    {getSignalIcon(selectedStock.signal)} {selectedStock.signal}
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: '600' }}>
                    {selectedStock.margin > 0 ? '+' : ''}{selectedStock.margin}%
                  </div>
                </div>

                {/* METRICS */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '25px' }}>
                  <div style={{ background: '#334155', padding: '20px', borderRadius: '12px', textAlign: 'center' }}>
                    <div style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '8px' }}>Current Price</div>
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>${selectedStock.current_price}</div>
                  </div>
                  <div style={{ background: '#334155', padding: '20px', borderRadius: '12px', textAlign: 'center' }}>
                    <div style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '8px' }}>Score (0-100)</div>
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>
                      {selectedStock.final_score || selectedStock.value_coefficient?.toFixed(1)}
                    </div>
                  </div>
                </div>

                {/* BUTTONS */}
                <button
                  onClick={() => refreshStock(selectedStock.symbol)}
                  disabled={loading}
                  style={{
                    width: '100%',
                    padding: '16px',
                    background: 'linear-gradient(45deg, #3b82f6, #1d4ed8)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: '16px',
                    fontWeight: '600',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    marginBottom: '15px',
                    boxShadow: '0 4px 14px rgba(59, 130, 246, 0.4)'
                  }}
                >
                  {loading ? '🔄 Analyzing...' : '🔄 Reanalyze'}
                </button>

                <a
                  href={`https://finance.yahoo.com/quote/${selectedStock.symbol}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'block',
                    padding: '16px',
                    background: 'linear-gradient(45deg, #059669, #047857)',
                    color: 'white',
                    textAlign: 'center',
                    textDecoration: 'none',
                    borderRadius: '12px',
                    fontWeight: '600',
                    boxShadow: '0 4px 14px rgba(5, 150, 105, 0.4)'
                  }}
                >
                  📊 Yahoo Finance
                </a>
              </>
            )}
          </div>

          {/* CHART */}
          <div style={{
            background: '#1e293b',
            padding: '30px',
            borderRadius: '16px',
            border: '1px solid #334155',
            height: '500px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h3 style={{ margin: 0 }}>
                {selectedStock?.symbol} (Last {chartData.length} Days)
              </h3>
              <div style={{ fontSize: '14px', color: '#94a3b8' }}>Drag slider to zoom</div>
            </div>
            
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 80 }}>
                  <CartesianGrid strokeDasharray="5 5" stroke="#334155" vertical={false} />
                  <XAxis 
                    dataKey="date" 
                    stroke="#94a3b8" 
                    angle={-45}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis stroke="#94a3b8" tickFormatter={(v) => `$${Math.round(v)}`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
                    labelStyle={{ color: '#94a3b8' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="price" 
                    stroke="#3b82f6" 
                    strokeWidth={4}
                    dot={false}
                    activeDot={{ r: 8 }}
                  />
                  <Brush 
                    dataKey="date" 
                    height={40} 
                    stroke="#3b82f6"
                    fill="#1e293b"
                    tickFormatter={() => ''}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                Select a stock to view history
              </div>
            )}
          </div>
        </div>  

        {/* STOCK GRID */}
        {!loading && stocks.length > 0 && (
          <div style={{
            background: '#1e293b',
            padding: '30px',
            borderRadius: '16px',
            border: '1px solid #334155',
            marginTop: '40px'
          }}>
            <h3 style={{ margin: '0 0 25px 0', fontSize: '1.3rem' }}>Market Overview (Top 10)</h3>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', 
              gap: '16px' 
            }}>
              {stocks.slice(0, 10).map(stock => {
                 const style = signalStyle(stock.signal);
                 return (
                  <div
                    key={stock.symbol}
                    onClick={() => {
                      setSelectedStock(stock);
                      loadChartData(stock.symbol);
                    }}
                    style={{
                      padding: '20px',
                      background: '#334155',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      borderLeft: `5px solid ${style.borderColor}`,
                      transition: 'all 0.2s',
                      opacity: selectedStock?.symbol === stock.symbol ? 1 : 0.85,
                      transform: selectedStock?.symbol === stock.symbol ? 'scale(1.02)' : 'scale(1)'
                    }}
                  >
                    <div style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '8px' }}>
                      {stock.symbol}
                    </div>
                    <div style={{ 
                      fontSize: '28px', 
                      fontWeight: 'bold',
                      color: style.color, 
                      marginBottom: '8px'
                    }}>
                      {stock.signal}
                    </div>
                    <div style={{ fontSize: '16px', color: '#94a3b8' }}>
                      {stock.margin > 0 ? '+' : ''}{stock.margin.toFixed(1)}% | ${stock.current_price}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;