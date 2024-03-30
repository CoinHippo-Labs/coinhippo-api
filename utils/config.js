const config = require('config-yml');
const { toBeHex } = require('ethers');
const _ = require('lodash');

const { toArray } = require('./parser');
const { equalsIgnoreCase, removeDoubleQuote } = require('./string');

const { chains, tokens } = { ...config };

const getChains = (chainTypes = []) => {
  chainTypes = toArray(chainTypes);
  return Object.fromEntries(
    Object.entries({ ...chains }).filter(([k, v]) => chainTypes.length === 0 || chainTypes.includes(k)).flatMap(([k, v]) => Object.entries({ ...v }).map(([_k, _v]) => {
      let provider_params;
      switch (k) {
        case 'evm':
          provider_params = [{
            chainId: toBeHex(_v.chain_id).replace('0x0', '0x'),
            chainName: _v.name,
            rpcUrls: toArray(_v.endpoints?.rpc),
            nativeCurrency: _v.native_token,
            blockExplorerUrls: toArray([_v.explorer?.url]),
          }];
          break;
        default:
          break;
      }
      _v = { ..._v, id: _k, chain_type: k, provider_params };
      return [_k, _v];
    }))
  );
};
const getChainsList = (chainTypes = []) => Object.values(getChains(chainTypes));
const getChainData = (chain, chainTypes = []) => chain && (getChains(chainTypes)[removeDoubleQuote(chain).toLowerCase()] || Object.values(getChains(chainTypes)).find(d => toArray(_.concat(d.id, d.chain_id, d.name)).findIndex(s => equalsIgnoreCase(s, removeDoubleQuote(chain))) > -1));
const getChain = chain => getChainData(chain)?.id || chain;

const getTokens = () => Object.entries({ ...tokens }).map(([k, v]) => ({ id: k, asset_id: k, ...v }));
const getToken = id => getTokens().find(d => ['id', 'coingecko_id'].findIndex(k => equalsIgnoreCase(d[k], id)) > -1);

module.exports = {
  ASSET_COLLECTION: 'assets',
  CACHE_COLLECTION: 'caches',
  CURRENCY: 'usd',
  getChains,
  getChainsList,
  getChainData,
  getChain,
  getTokens,
  getToken,
};