const { request } = require('../../utils/http');
const { toArray } = require('../../utils/parser');

module.exports = async (data, preview = false) => {
  data = toArray(data);

  for (let i = 0; i < data.length; i++) {
    try {
      await request('https://api.telegram.org', {
        path: `/bot${process.env.TELEGRAM_KEY}/sendMessage`,
        params: {
          chat_id: process.env.TELEGRAM_CHANNEL,
          parse_mode: 'html',
          disable_web_page_preview: !preview,
          disable_notification: i < data.length - 1,
          text: data[i],
        },
      });
    } catch (error) {}
  };
};