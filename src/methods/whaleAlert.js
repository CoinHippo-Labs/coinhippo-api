const axios = require('axios');

const { parseRequestError } = require('../utils');

module.exports = async (params = {}) => {
  params = { ...params, api_key: process.env.WHALE_ALERT_KEY };
  let { path } = { ...params };
  path = path || '/transactions';
  const api = axios.create({ baseURL: 'https://api.whale-alert.io/v1/', timeout: 20000 });
  const response = await api.get(path, { params }).catch(error => parseRequestError(error));
  return response?.data;
};