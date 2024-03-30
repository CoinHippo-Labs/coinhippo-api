const _ = require('lodash');
const moment = require('moment');

const { get, write, remove } = require('../services/index');
const { CACHE_COLLECTION } = require('../utils/config');
const { request } = require('../utils/http');
const { toJson, toArray } = require('../utils/parser');
const { timeDiff } = require('../utils/time');

const coingecko = async (path, params) => await request('https://api.coingecko.com/api/v3', { path, params });

const generateCacheId = params => {
  const { path } = { ...params };
  if (path) delete params.path;
  return toArray(_.concat(toArray(path, { delimiter: '/', toCase: 'lower' }), Object.keys(params).length > 0 && JSON.stringify(params))).join('_').toLowerCase();
};

const getCoingecko = async params => {
  if (!params) return;
  let output;
  let cache;
  let cacheHit = false;
  const id = generateCacheId(params);

  if (id) {
    const { response } = { ...await get(CACHE_COLLECTION, id) };
    cache = toJson(response);
    if (cache) {
      if (timeDiff(cache.updated_at) < 300) {
        output = cache;
        cacheHit = true;
      }
      else await remove(CACHE_COLLECTION, id);
    }
  }
  output = output || await coingecko(params.path, params);

  if (output && !output.error) {
    if (id && !cacheHit) await write(CACHE_COLLECTION, id, { response: JSON.stringify(output), updated_at: moment().valueOf() });
  }
  else if (cache) output = cache;
  return output;
};

module.exports = {
  coingecko,
  getCoingecko,
};