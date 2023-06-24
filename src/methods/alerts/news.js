const _ = require('lodash');
const moment = require('moment');

const getNews = require('../getNews');
const { telegram } = require('../broadcasts');
const { get, write } = require('../../services/index');
const { CACHE_COLLECTION } = require('../../utils/config');
const { toArray } = require('../../utils');

const FILTERS = ['rising', 'hot', 'bullish', 'bearish', 'important', 'lol'];

module.exports = async () => {
  let alerted;
  let output = [];

  const now = moment();
  for (const filter of FILTERS) {
    const response = await getNews({ filter, public: true, page: 1 });
    output = _.orderBy(_.uniqBy(_.concat(output, toArray(response?.results).filter(d => d.id && d.title && d.url && d.source && now.diff(moment(d.created_at), 'hours') < 4)), 'id'), ['created_at'], ['desc']);
  }

  if (output.length > 0) {
    const id = 'news';
    const response = await get(CACHE_COLLECTION, id);
    let { latest } = { ...response };
    const index = output.findIndex(d => d.id.toString() === latest?.id);
    if (index > -1) {
      output = _.cloneDeep(_.slice(output, 0, index)).reverse();
    }
    output = _.slice(output, 0, 1);

    if (output.length > 0) {
      const telegram_messages = [];
      output.forEach(d => {
        const { id, title, slug, kind, domain, source } = { ...d };
        let { url } = { ...d };
        url = url.replace(slug, 'click/');
        latest = { ...latest, id: id.toString() };
        telegram_messages.push(`${kind === 'media' ? domain?.indexOf('youtube') > -1 ? '📺' : '🎙' : '📰'} ${title}\n<pre>via</pre> <a href="${url}">${source.title}</a>`);
      });
      await write(CACHE_COLLECTION, id, { latest });

      if (telegram_messages.length > 0) {
        await telegram(telegram_messages);
        alerted = true;
      }
    }
  }

  return alerted;
};