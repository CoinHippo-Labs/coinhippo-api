const axios = require('axios');

const { toArray, parseRequestError } = require('../../utils');

module.exports = async (data, preview = false) => {
  const api = axios.create({ baseURL: 'https://api.telegram.org', timeout: 20000 });
  toArray(data).forEach(async (d, i) => {
    try {
      const path = `/bot${process.env.TELEGRAM_KEY}/sendMessage`;
      const params = {
        chat_id: process.env.TELEGRAM_CHANNEL,
        parse_mode: 'html',
        disable_web_page_preview: !preview,
        disable_notification: i < data.length - 1,
        text: d,
      };
      await api.get(path, { params }).catch(error => parseRequestError(error));
    } catch (error) {}
  });
};