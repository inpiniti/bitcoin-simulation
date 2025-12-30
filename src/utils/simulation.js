/**
 * Generates 1 year of simulated Bitcoin price data
 * @returns {Array} Array of { date, price } objects
 */
export const generateSimulationData = () => {
  const data = [];
  const DAYS = 365;
  const startDate = new Date();
  startDate.setFullYear(startDate.getFullYear() - 1);

  let currentPrice = 95000; // Starting price
  const volatility = 0.04; // Daily volatility (4%)
  const drift = 0.0005; // Slight upward drift

  for (let i = 0; i <= DAYS; i++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i);
    
    // Geometric Brownian Motion approximation
    const change = currentPrice * (drift + (Math.random() - 0.5) * volatility);
    currentPrice += change;
    
    // Floor at 10k just in case
    currentPrice = Math.max(currentPrice, 10000);

    data.push({
      date: date.toISOString().split('T')[0],
      price: Math.round(currentPrice * 100) / 100,
      timestamp: date.getTime()
    });
  }

  return data;
};

export const formatCurrency = (value) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value);
};
