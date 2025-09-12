const getLogLevel = () => process.env.LOG_LEVEL || 'debug';

module.exports = {
  TOKEN_API: 'https://api.coingecko.com/api/v3/',
  CURRENCY: 'usd',
  getLogLevel,
};