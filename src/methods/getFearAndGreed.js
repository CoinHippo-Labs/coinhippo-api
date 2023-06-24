const axios = require('axios');

const { parseRequestError } = require('../utils');

module.exports = async (params = {}) => {
  params = { ...params, limit: 31 };
  let { path } = { ...params };
  path = path || '/fng/';
  const api = axios.create({ baseURL: 'https://api.alternative.me/', timeout: 20000 });
  const response = await api.get(path, { params }).catch(error => parseRequestError(error));
  return response?.data;
};