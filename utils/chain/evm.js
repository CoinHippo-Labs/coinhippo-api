const { FallbackProvider, JsonRpcProvider } = require('ethers');

const { getChainData } = require('../config');
const { toArray } = require('../parser');
const { toNumber } = require('../number');

const createRPCProvider = (url, chain_id) => new JsonRpcProvider(url, chain_id ? toNumber(chain_id) : undefined);

const getProvider = (chain, _rpcs) => {
  const { chain_id, deprecated, endpoints } = { ...getChainData(chain, 'evm') };
  const rpcs = toArray(_rpcs || endpoints?.rpc);
  if (rpcs.length > 0 && !deprecated) {
    try {
      return rpcs.length > 1 ?
        new FallbackProvider(
          rpcs.map((url, i) => {
            return {
              priority: i + 1,
              provider: createRPCProvider(url, chain_id),
              stallTimeout: 1000,
              weight: 1,
            };
          }),
          chain_id,
        ) :
        createRPCProvider(rpcs[0], chain_id);
    } catch (error) {}
  }
  return null;
};

module.exports = {
  getProvider,
};