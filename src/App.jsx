import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Play,
  Pause,
  RotateCcw,
  ShoppingBag,
  Coins
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { generateSimulationData, formatCurrency } from './utils/simulation';
import './App.css';

function App() {
  const [data] = useState(() => generateSimulationData());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [portfolio, setPortfolio] = useState({
    cash: 100000, // Initial $100k
    btc: 0
  });
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  const timerRef = useRef(null);

  // Derived state
  const currentPrice = data[currentIndex].price;
  const currentTotalValue = portfolio.cash + (portfolio.btc * currentPrice);
  const initialValue = 100000;
  const roi = ((currentTotalValue - initialValue) / initialValue) * 100;

  const visibleData = useMemo(() => {
    return data.slice(0, currentIndex + 1);
  }, [currentIndex, data]);

  // Simulation loop
  useEffect(() => {
    if (isPlaying && currentIndex < data.length - 1) {
      timerRef.current = setInterval(() => {
        setCurrentIndex(prev => {
          if (prev >= data.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 100 / playbackSpeed);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [isPlaying, currentIndex, data.length, playbackSpeed]);

  const handleBuy = () => {
    if (portfolio.cash > 0) {
      const btcToBuy = portfolio.cash / currentPrice;
      setPortfolio({
        cash: 0,
        btc: portfolio.btc + btcToBuy
      });
    }
  };

  const handleSell = () => {
    if (portfolio.btc > 0) {
      const cashFromSale = portfolio.btc * currentPrice;
      setPortfolio({
        cash: portfolio.cash + cashFromSale,
        btc: 0
      });
    }
  };

  const handleReset = () => {
    setIsPlaying(false);
    setCurrentIndex(0);
    setPortfolio({ cash: 100000, btc: 0 });
  };

  return (
    <div className="container">
      <header style={{ marginBottom: '3rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="text-gradient" style={{ fontSize: '2.5rem' }}>BTC Simulation</h1>
          <p style={{ color: 'var(--text-secondary)' }}>1-Year Hyper-Realistic Market Simulator</p>
        </div>
        <div className="glass" style={{ padding: '0.75rem 1.5rem', display: 'flex', gap: '2rem' }}>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>DATE</span>
            <span style={{ fontWeight: '700' }}>{data[currentIndex].date}</span>
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>DAY</span>
            <span style={{ fontWeight: '700' }}>{currentIndex} / 365</span>
          </div>
        </div>
      </header>

      <main style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '2rem' }}>
        <section className="glass" style={{ padding: '1.5rem', height: '500px', position: 'relative' }}>
          <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <TrendingUp size={24} color="var(--accent-color)" /> Market Performance
            </h2>
            <div style={{ fontSize: '1.5rem', fontWeight: '800' }}>
              {formatCurrency(currentPrice)}
            </div>
          </div>

          <ResponsiveContainer width="100%" height="80%">
            <AreaChart data={visibleData}>
              <defs>
                <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--accent-color)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--accent-color)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--glass-border)" vertical={false} />
              <XAxis
                dataKey="date"
                hide
              />
              <YAxis
                domain={['auto', 'auto']}
                orientation="right"
                stroke="var(--text-secondary)"
                tickFormatter={(val) => `$${val / 1000}k`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--bg-secondary)',
                  borderColor: 'var(--glass-border)',
                  borderRadius: '12px'
                }}
                itemStyle={{ color: 'var(--text-primary)' }}
                formatter={(val) => [formatCurrency(val), 'Price']}
              />
              <Area
                type="monotone"
                dataKey="price"
                stroke="var(--accent-color)"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#colorPrice)"
                animationDuration={300}
              />
            </AreaChart>
          </ResponsiveContainer>

          <div style={{
            marginTop: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '1.5rem',
            borderTop: '1px solid var(--glass-border)',
            paddingTop: '1.5rem'
          }}>
            <button
              className="btn btn-primary"
              onClick={() => setIsPlaying(!isPlaying)}
            >
              {isPlaying ? <Pause size={20} /> : <Play size={20} />}
              {isPlaying ? 'Pause' : 'Start Simulation'}
            </button>
            <button className="btn btn-outline" onClick={handleReset}>
              <RotateCcw size={20} /> Reset
            </button>

            <div style={{ display: 'flex', gap: '0.5rem', marginLeft: 'auto' }}>
              {[1, 5, 20].map(speed => (
                <button
                  key={speed}
                  className={`btn ${playbackSpeed === speed ? 'btn-primary' : 'btn-outline'}`}
                  style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                  onClick={() => setPlaybackSpeed(speed)}
                >
                  {speed}x
                </button>
              ))}
            </div>
          </div>
        </section>

        <aside style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <section className="glass" style={{ padding: '1.5rem' }}>
            <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Wallet size={20} color="var(--accent-color)" /> My Portfolio
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>TOTAL BALANCE</span>
                <div style={{ fontSize: '1.75rem', fontWeight: '800' }}>
                  {formatCurrency(currentTotalValue)}
                </div>
              </div>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                color: roi >= 0 ? 'var(--success)' : 'var(--danger)',
                fontWeight: '700'
              }}>
                {roi >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                {roi.toFixed(2)}% ROI
              </div>

              <div style={{
                marginTop: '1rem',
                padding: '1rem',
                background: 'rgba(0,0,0,0.2)',
                borderRadius: '0.75rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Cash</span>
                  <span>{formatCurrency(portfolio.cash)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Bitcoin</span>
                  <span>{portfolio.btc.toFixed(4)} BTC</span>
                </div>
              </div>
            </div>

            <div style={{ marginTop: '2rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <button
                className="btn"
                style={{
                  background: portfolio.cash > 0 ? 'var(--success)' : 'var(--bg-accent)',
                  color: portfolio.cash > 0 ? '#fff' : 'var(--text-secondary)',
                  opacity: portfolio.cash > 0 ? 1 : 0.5,
                  cursor: portfolio.cash > 0 ? 'pointer' : 'not-allowed'
                }}
                disabled={portfolio.cash === 0}
                onClick={handleBuy}
              >
                Buy All
              </button>
              <button
                className="btn"
                style={{
                  background: portfolio.btc > 0 ? 'var(--danger)' : 'var(--bg-accent)',
                  color: portfolio.btc > 0 ? '#fff' : 'var(--text-secondary)',
                  opacity: portfolio.btc > 0 ? 1 : 0.5,
                  cursor: portfolio.btc > 0 ? 'pointer' : 'not-allowed'
                }}
                disabled={portfolio.btc === 0}
                onClick={handleSell}
              >
                Sell All
              </button>
            </div>
          </section>

          <section className="glass" style={{ padding: '1.5rem' }}>
            <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Coins size={20} color="var(--accent-color)" /> Sim Stats
            </h3>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span>Volatility Ind.</span>
                <span style={{ color: 'var(--text-primary)' }}>High (4%)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Risk Level</span>
                <span style={{ color: 'var(--danger)' }}>Aggressive</span>
              </div>
            </div>
          </section>
        </aside>
      </main>

      <footer style={{ marginTop: 'auto', padding: '2rem 0', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
        &copy; 2025 BTC Simulation Lab. Not financial advice.
      </footer>
    </div>
  );
}

export default App;
