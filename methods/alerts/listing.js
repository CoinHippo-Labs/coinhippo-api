const _ = require('lodash');
const moment = require('moment');

const { twitter, telegram } = require('../broadcasts');
const { get, write } = require('../../services/index');
const { CACHE_COLLECTION } = require('../../utils/config');
const { request } = require('../../utils/http');
const { toArray } = require('../../utils/parser');
const { timeDiff } = require('../../utils/time');

const EXCHANGES = [
  { id: 'binance', title: 'Binance', url: 'https://www.binance.com' },
  { id: 'okx', title: 'OKX', url: 'https://www.okx.com', keywords: ['now available', 'list'] },
];

module.exports = async () => {
  let data = [];
  for (const exchange of EXCHANGES) {
    switch (exchange.id) {
      case 'binance':
        try {
          const { articles } = { ...(await request('https://www.binance.com/bapi/composite/v1', { path: '/public/cms/article/all/query', params: { type: 1, pageNo: 1, pageSize: 10, sortBy: 2, apiVersion: 'V2', queryKeywords: 'list' } }))?.data };
          const { title, code, publishDate } = { ..._.head(_.orderBy(toArray(articles).filter(d => [48, 49].includes(d.catalogId)), ['publishDate'], ['desc'])) };
          if (title && code && timeDiff(publishDate) < 3600) data.push({ exchange, title: title.replaceAll('<em>', '').replaceAll('</em>', ''), url: `${exchange.url}/en/support/announcement/${code}` });
        } catch (error) {}
        break;
      case 'okx':
        try {
          const { notices } = { ...(await request('https://www.okx.com/v2', { path: '/support/home/web' }))?.data };
          const { title, link, publishDate } = { ..._.head(_.orderBy(toArray(notices).filter(d => toArray(exchange.keywords).length > 0 && toArray(exchange.keywords).findIndex(k => d.title?.toLowerCase().includes(k)) > -1), ['publishDate'], ['desc'])) };
          if (title && link && timeDiff(publishDate) < 300) data.push({ exchange, title, url: `${exchange.url}${link}` });
        } catch (error) {}
        break;
      default:
        break;
    }
  }

  if (!(data.length > 0)) return;
  const cacheId = 'listing';
  let { latest } = { ...await get(CACHE_COLLECTION, cacheId) };
  data = _.slice(data.filter(d => latest && d.exchange && d.url !== latest[d.exchange.id]), 0, 1);

  if (!(data.length > 0)) return;
  const twitterMessages = [];
  const telegramMessages = [];
  let i = 0;
  for (const d of data) {
    latest = { ...latest, [d.exchange.id]: d.url };
    twitterMessages.push(`${i === 0 ? `💎 ${d.exchange.title} ${d.exchange.event || 'Listing'}\n` : ''}\n${d.title}\n${d.url}\n\n#${d.exchange.title} #Cryptocurrency`);
    telegramMessages.push(`${i === 0 ? `💎 <b><pre>${d.exchange.title} ${d.exchange.event || 'Listing'}</pre></b>\n` : ''}${d.title}\n<pre>via</pre> <a href="${d.url}">${new URL(d.url).hostname}</a>`);
    i++;
  };
  await write(CACHE_COLLECTION, cacheId, { latest });

  await telegram(telegramMessages, true);
  await twitter(twitterMessages);
  return true;
};