const { getCoingecko } = require('./coingecko');
const getTokensPrice = require('./getTokensPrice');
const getFearAndGreed = require('./getFearAndGreed');
const getNews = require('./getNews');
const whaleAlert = require('./whaleAlert');
const archive = require('./archive');
const alerts = require('./alerts');

module.exports = {
  getCoingecko,
  getTokensPrice,
  getFearAndGreed,
  getNews,
  whaleAlert,
  archive,
  alerts,
};