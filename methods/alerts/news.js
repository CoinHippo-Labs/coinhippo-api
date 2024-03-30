const _ = require('lodash');

const getNews = require('../getNews');
const { telegram } = require('../broadcasts');
const { get, write } = require('../../services/index');
const { CACHE_COLLECTION } = require('../../utils/config');
const { toArray } = require('../../utils/parser');
const { timeDiff } = require('../../utils/time');

const FILTERS = ['rising', 'hot', 'bullish', 'bearish', 'important', 'lol'];

module.exports = async () => {
  let data = [];
  for (const filter of FILTERS) {
    const { results } = { ...await getNews({ filter, public: true, page: 1 }) };
    data = _.orderBy(_.uniqBy(_.concat(data, toArray(results).filter(d => d.id && d.title && d.url && d.source && timeDiff(d.created_at, 'hours') < 2)), 'id'), ['created_at'], ['desc']);
  }

  if (!(data.length > 0)) return;
  const cacheId = 'news';
  let { latest } = { ...await get(CACHE_COLLECTION, cacheId) };
  const index = data.findIndex(d => d.id.toString() === latest?.id);
  if (index > -1) data = _.cloneDeep(_.slice(data, 0, index)).reverse();
  data = _.slice(data, 0, 1);

  if (!(data.length > 0)) return;
  const messages = [];
  data.forEach(d => {
    latest = { ...latest, id: d.id.toString() };
    messages.push(`${d.kind === 'media' ? d.domain?.indexOf('youtube') > -1 ? '📺' : '🎙' : '📰'} ${d.title}\n<pre>via</pre> <a href="${d.url.replace(slug, 'click/')}">${d.source.title}</a>`);
  });
  await write(CACHE_COLLECTION, cacheId, { latest });
  await telegram(messages);
  return true;
};