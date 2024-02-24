const { formatUnits } = require('ethers');

const { twitter, telegram } = require('../broadcasts');
const { getProvider } = require('../../utils/chain/evm');
const { toNumber, numberFormat } = require('../../utils/number');

const THRESHOLD = 12;

module.exports = async () => {
  let alerted;
  try {
    const { gasPrice } = { ...await getProvider('ethereum').getFeeData() };
    const value = toNumber(formatUnits(gasPrice, 'gwei'));
    if (value && value <= THRESHOLD) {
      const twitter_message = `The ⛽ #ETH Gas Price (${numberFormat(value, '0,0')} Gwei) is ${value <= THRESHOLD * 2 / 3 ? 'very low' : 'not high'}.\nMaybe it's time to #DeFi or #NFTs. 😁👍\n\n #EtherGas #Ethereum #Cryptocurrency`;
      const telegram_message = `The ⛽ ETH Gas Price (<pre>${numberFormat(value, '0,0')} Gwei</pre>) is ${value <= THRESHOLD * 2 / 3 ? 'very low' : 'not high'}.\nMaybe it's time to DeFi or NFTs. 😁👍`;
      await telegram([telegram_message]);
      await twitter([twitter_message]);
      alerted = true;
    }
  } catch (error) {}
  return alerted;
};