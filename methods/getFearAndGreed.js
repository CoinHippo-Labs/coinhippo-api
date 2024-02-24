const { request } = require('../utils/http');

module.exports = async params => {
  params = { ...params, limit: 31 };
  let { path } = { ...params };
  path = path || '/fng/';
  return await request('https://api.alternative.me/', { path, params });
};