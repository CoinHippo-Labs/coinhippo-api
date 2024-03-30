const { formatUnits } = require('ethers');

const { twitter, telegram } = require('../broadcasts');
const { getProvider } = require('../../utils/chain/evm');
const { toNumber } = require('../../utils/number');

const THRESHOLD = 25;

module.exports = async () => {
  try {
    const { gasPrice } = { ...await getProvider('ethereum').getFeeData() };
    const value = toNumber(formatUnits(gasPrice, 'gwei'));
    if (value && value <= THRESHOLD) {
      await telegram(`The ⛽ ETH Gas Price (<pre>${value} Gwei</pre>) is ${value <= THRESHOLD * 2 / 3 ? 'very low' : 'not high'}. 😁👍`);
      await twitter(`The ⛽ #ETH Gas Price (${value} Gwei) is ${value <= THRESHOLD * 2 / 3 ? 'very low' : 'not high'}. 😁👍\n\n #EtherGas #Ethereum #Cryptocurrency`);
      return true;
    }
  } catch (error) {}
  return;
};