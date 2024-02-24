const { request } = require('../utils/http');

module.exports = async params => {
  params = { ...params, api_key: process.env.WHALE_ALERT_KEY };
  let { path } = { ...params };
  path = path || '/transactions';
  return await request('https://api.whale-alert.io/v1/', { path, params });
};