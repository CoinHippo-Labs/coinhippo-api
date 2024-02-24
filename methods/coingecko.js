const _ = require('lodash');
const moment = require('moment');

const { get, write, remove } = require('../services/index');
const { CACHE_COLLECTION } = require('../utils/config');
const { request } = require('../utils/http');
const { toJson, toArray } = require('../utils/parser');
const { timeDiff } = require('../utils/time');

const coingecko = async (path = '', params = {}) => await request('https://api.coingecko.com/api/v3/', { path, params });

const getCoingecko = async (params = {}) => {
  let output;
  let _output;
  let cacheHit = false;

  const { path } = { ...params };
  delete params.path;
  const id = toArray(_.concat(toArray(path, { delimiter: '/', toCase: 'lower' }), Object.keys(params).length > 0 && JSON.stringify(params))).join('_').toLowerCase();

  if (id) {
    const { response } = { ...await get(CACHE_COLLECTION, id) };
    _output = toJson(response);
    if (_output) {
      const { updated_at } = { ..._output };
      if (timeDiff(updated_at) < 300) {
        output = _output;
        cacheHit = true;
      }
      else await remove(CACHE_COLLECTION, id);
    }
  }
  output = output || await coingecko(path, params);

  if (output && !output.error) {
    if (id && !cacheHit) await write(CACHE_COLLECTION, id, { response: JSON.stringify(output), updated_at: moment().valueOf() });
  }
  else if (_output) output = _output;

  return output;
};

module.exports = {
  coingecko,
  getCoingecko,
};