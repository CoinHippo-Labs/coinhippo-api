const axios = require('axios');
const _ = require('lodash');
const moment = require('moment');

const { get, write, remove } = require('../services/index');
const { CACHE_COLLECTION } = require('../utils/config');
const { toArray, toJson, parseRequestError } = require('../utils');

const coingecko = async (path = '', params = {}) => {
  const api = axios.create({ baseURL: 'https://api.coingecko.com/api/v3/', timeout: 20000 });
  const response = await api.get(path, { params }).catch(error => parseRequestError(error));
  return response?.data;
};

const getCoingecko = async (params = {}) => {
  let output;
  let _output;
  let cache_hit = false;

  const { path } = { ...params };
  delete params.path;
  const id = toArray(_.concat(toArray(path, 'lower', '/'), Object.keys(params).length > 0 && JSON.stringify(params))).join('_').toLowerCase();

  if (id) {
    const { response } = { ...await get(CACHE_COLLECTION, id) };
    _output = toJson(response);
    if (_output) {
      const { updated_at } = { ..._output };
      if (moment().diff(moment(updated_at), 'seconds') <= 60) {
        output = _output;
        cache_hit = true;
      }
      else {
        await remove(CACHE_COLLECTION, id);
      }
    }
  }
  if (!output) {
    output = await coingecko(path, params);
  }

  if (output && !output.error) {
    if (id && !cache_hit) {
      await write(CACHE_COLLECTION, id, { response: JSON.stringify(output), updated_at: moment().valueOf() });
    }
  }
  else if (_output) {
    output = _output;
  }

  return output;
};

module.exports = {
  coingecko,
  getCoingecko,
};