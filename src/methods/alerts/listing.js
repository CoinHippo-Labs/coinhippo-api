const axios = require('axios');
const _ = require('lodash');
const moment = require('moment');
const { parse } = require('node-html-parser');

const { twitter, telegram } = require('../broadcasts');
const { get, write } = require('../../services/index');
const { CACHE_COLLECTION } = require('../../utils/config');
const { toArray, parseRequestError } = require('../../utils');

const exchanges = [
  {
    id: 'binance',
    title: 'Binance',
    url: 'https://www.binance.com',
  },
  {
    id: 'coinbase',
    title: 'Coinbase',
    url: 'https://www.coinbase.com',
    keywords: ['now available on coinbase', 'launching on coinbase', 'launches on coinbase'],
  },
  {
    id: 'okx',
    title: 'OKX',
    url: 'https://www.okx.com',
    keywords: ['now available', 'list'],
  },
  {
    id: 'coinlist',
    title: 'Coinlist',
    url: 'https://blog.coinlist.co',
    path: '/tag/community-sales/',
    keywords: ['sale on coinlist'],
    event: 'Token Sales',
  },
];

module.exports = async () => {
  let alerted;
  let output = [];

  for (const exchange of exchanges) {
    const { id, url, path, params, headers, keywords } = { ...exchange };
    switch (id) {
      case 'binance':
        try {
          const api = axios.create({ baseURL: 'https://www.binance.com/bapi/composite/v1/' });
          const response = await api.get('/public/cms/article/all/query', { params: { type: 1, pageNo: 1, pageSize: 10, sortBy: 2, apiVersion: 'V2', queryKeywords: 'list' } }).catch(error => parseRequestError(error));
          const { articles } = { ...response?.data?.data };
          const { title, code, publishDate } = _.head(_.orderBy(toArray(articles).filter(d => d.catalogId === 48), ['publishDate'], ['desc']));
          if (title && code && moment().diff(moment(publishDate), 'seconds') < 5 * 60) {
            output.push({ exchange, title, url: `${url}/en/support/announcement/${code}` });
          }
        } catch (error) {}
        break;
      case 'coinbase':
        try {
          const api = axios.create({ baseURL: 'https://cdn.contentful.com' });
          const response = await api.get('/spaces/c5bd0wqjc7v0/environments/master/entries', { headers: { Authorization: 'Bearer GxY4UlHo9xUEs5oImXiuvdqKwCoO5BvSRrd6HC8MrC4' }, params: { include: 10, content_type: 'page', 'fields.content.sys.contentType.sys.id': 'cdxTemplateEditorialPage', 'metadata.tags.sys.id[all]': 'productsBlog', 'fields.content.fields.tags.sys.id[in]': '3vrQR5SGU1qwVah8qjwS8Y', 'fields.slug[nin]': '/blog/landing/product', order: '-fields.publicationDate', limit: 20, skip: 0 } }).catch(error => parseRequestError(error));
          const { items } = { ...response?.data };
          const { title, slug, publicationDate } = _.head(toArray(items).filter(d => toArray(keywords).length > 0 && toArray(keywords).findIndex(k => d.fields?.title?.toLowerCase().includes(k)) > -1))?.fields;
          if (title && slug && moment().diff(moment(publicationDate), 'days') < 1) {
            output.push({ exchange, title, url: `${url}${slug}` });
          }
        } catch (error) {}
        break;
      case 'okx':
        try {
          const api = axios.create({ baseURL: 'https://www.okx.com/v2/' });
          const response = await api.get('/support/home/web').catch(error => parseRequestError(error));
          const { notices } = { ...response?.data?.data };
          const { title, link, publishDate } = _.head(_.orderBy(toArray(notices).filter(d => toArray(keywords).length > 0 && toArray(keywords).findIndex(k => d.title?.toLowerCase().includes(k)) > -1), ['publishDate'], ['desc']));
          if (title && link && moment().diff(moment(publishDate), 'seconds') > 5 * 60) {
            output.push({ exchange, title, url: `${url}${link}` });
          }
        } catch (error) {}
        break;
      case 'coinlist':
        try {
          const website = axios.create({ baseURL: url });
          const response = await website.get(path || '', { params, headers }).catch(error => parseRequestError(error));
          const { data } = { ...response };
          const html = data && parse(data);
          const object = html.querySelector('.m-article-card__info-link');
          const title = object.querySelector('.m-article-card__title')?.getAttribute('title');
          if (title && (toArray(keywords).length < 1 || toArray(keywords).findIndex(k => title.toLowerCase().includes(k)) > -1)) {
            output.push({ exchange, title, url: `${url}${object.getAttribute('href')}` });
          }
        } catch (error) {}
        break;
      default:
        break;
    }
  }

  if (output.length > 0) {
    const id = 'listing';
    const response = await get(CACHE_COLLECTION, id);
    let { latest } = { ...response };
    output = _.slice(output.filter(d => d.exchange && d.url && d.url !== latest?.[d.exchange.id]), 0, 1);

    if (output.length > 0) {
      const twitter_messages = [];
      const telegram_messages = [];
      output.forEach((d, i) => {
        const { exchange, title, url } = { ...d };
        latest = { ...latest, [exchange.id]: url };
        twitter_messages.push(`${i === 0 ? `💎 ${exchange.title} ${exchange.event || 'Listing'}\n` : ''}\n${title}\n${url}\n\n#${exchange.title} #Cryptocurrency`);
        telegram_messages.push(`${i === 0 ? `💎 <b><pre>${exchange.title} ${exchange.event || 'Listing'}</pre></b>\n` : ''}${title}\n<pre>via</pre> <a href="${url}">${new URL(url).hostname}</a>`);
      });
      await write(CACHE_COLLECTION, id, { latest });

      if (twitter_messages.length > 0) {
        await twitter(twitter_messages);
        alerted = true;
      }
      if (telegram_messages.length > 0) {
        await telegram(telegram_messages, true);
        alerted = true;
      }
    }
  }

  return alerted;
};