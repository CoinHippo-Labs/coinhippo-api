const _ = require('lodash');

const getFearAndGreed = require('../getFearAndGreed');
const { twitter, telegram } = require('../broadcasts');
const { numberFormat } = require('../../utils');

const LOW = 20;
const HIGH = 75;

module.exports = async () => {
  let alerted;
  const response = await getFearAndGreed();
  const data = { ..._.head(response?.data) };
  const { value_classification } = { ...data };
  let { value } = { ...data };
  value = Number(value);
  if (value) {
    const twitter_message = `🌦 Today's #Bitcoin Fear & Greed Index is ${numberFormat(value, '0,0')} - ${value_classification}${value <= LOW ? ' 🥶' : value >= HIGH ? ' 🤩' : ''}\n\n#Cryptocurrency`;
    const telegram_message = `🌦 Today's Bitcoin Fear & Greed Index is <pre>${numberFormat(value, '0,0')}</pre> - <u>${value_classification}</u>${value <= LOW ? ' 🥶' : value >= HIGH ? ' 🤩' : ''}`;
    await telegram([telegram_message]);
    await twitter([twitter_message]);
    alerted = true;
  }
  return alerted;
};