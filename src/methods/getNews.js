const axios = require('axios');

const { parseRequestError } = require('../utils');

module.exports = async ( params = {}) => {
  params = { ...params, auth_token: process.env.NEWS_KEY };
  let { path } = { ...params };
  path = path || '/posts/';
  const api = axios.create({ baseURL: 'https://cryptopanic.com/api/v1/', timeout: 20000 });
  const response = await api.get(path, { params }).catch(error => parseRequestError(error));
  return response?.data;
};