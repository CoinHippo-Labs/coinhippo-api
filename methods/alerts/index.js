const moment = require('moment');

const fearAndGreed = require('./fearAndGreed');
const { toNumber } = require('../../utils/number');

module.exports = async () => {
  const now = moment();
  const hour = toNumber(now.hours());
  const minute = toNumber(now.minutes());

  let alerted = await fearAndGreed();

  return alerted;
};