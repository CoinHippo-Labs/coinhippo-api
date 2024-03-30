const getFearAndGreed = require('../getFearAndGreed');
const { twitter, telegram } = require('../broadcasts');
const { toNumber } = require('../../utils/number');

const LOW = 20;
const HIGH = 75;

module.exports = async () => {
  const { value, value_classification } = { ...(await getFearAndGreed())?.data?.[0] };
  if (!value) return;
  await telegram(`🌦 Today's Bitcoin Fear & Greed Index is <pre>${value}</pre> - <u>${value_classification}</u>${toNumber(value) <= LOW ? ' 🥶' : toNumber(value) >= HIGH ? ' 🤩' : ''}`);
  await twitter(`🌦 Today's #Bitcoin Fear & Greed Index is ${value} - ${value_classification}${toNumber(value) <= LOW ? ' 🥶' : toNumber(value) >= HIGH ? ' 🤩' : ''}\n\n#Cryptocurrency`);
  return true;
};