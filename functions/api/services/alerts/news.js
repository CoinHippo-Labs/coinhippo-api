// import module for http request
const axios = require('axios');
// import module for date time
const moment = require('moment');
// import lodash
const _ = require('lodash');
// import config
const config = require('config-yml');
// import index
const { crud } = require('../index');

const filters = ['rising','hot','bullish','bearish','important','lol'];

module.exports = async () => {
  const now = moment();
  const { coinhippo } = { ...config?.api?.endpoints };
  const api = axios.create({ baseURL: coinhippo });
  let alerted, data = [];
  for (let i = 0; i < filters.length; i++) {
    const filter = filters[i];
    const res = await api.get('', {
      params: {
        module: 'news',
        public: true,
        page: 1,
        filter,
      },
    }).catch(error => { return { data: { error } }; });
    data = _.orderBy(_.uniqBy(_.concat(data, res?.data?.results || []), 'id'), ['created_at'], ['desc']);
  }
  if (data.length > 0) {
    const id = 'latest-news';
    const response = await crud({
      collection: 'tmp',
      method: 'get',
      id,
    });
    const latest = { ...response };
    data = data.filter(d => d.title && d.url && d.source && now.diff(moment(d.created_at)) <= (4 * 60 * 60 * 1000));
    const latest_index = latest?.news_id && data.findIndex(d => d.id?.toString() === latest.news_id);
    if (latest_index > -1) {
      data = _.cloneDeep(_.slice(data, 0, latest_index)).reverse();
    }
    data = _.slice(data, 0, 1);
    const twitter = [], telegram = [];
    data.forEach(d => {
      const { id, slug, kind, domain, title, source } = { ...d };
      let { url } = { ...d };
      url = url.replace(slug, 'click/');
      latest.news_id = id?.toString();
      // twitter.push(`${title}\n[via ${source.title}]\n\n${url}`);
      telegram.push(`${kind === 'media' ? domain?.indexOf('youtube') > -1 ? '📺' : '🎙' : '📰'} ${title}\n<pre>via</pre> <a href="${url}">${source.title}</a>`);
    });
    if (data.length > 0) {
      await crud({
        collection: 'tmp',
        method: 'set',
        id,
        ...latest,
      });
      if (twitter.length > 0 || telegram.length > 0) {
        alerted = true;
        const { socials } = { ...config };
        await api.post('', {
          module: 'broadcast',
          twitter: {
            messages: twitter,
            key: socials?.twitter?.api_key,
          },
          telegram: {
            messages: telegram,
            key: socials?.telegram?.key,
          },
        }).catch(error => { return { data: { error } }; });
      }
    }
  }
  return alerted;
};