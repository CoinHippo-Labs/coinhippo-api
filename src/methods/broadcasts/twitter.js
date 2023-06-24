const TwitterClient = require('twitter-api-client').TwitterClient;

const { toArray } = require('../../utils');

module.exports = async data => {
  const twitter_client = new TwitterClient({ apiKey: process.env.TWITTER_KEY, apiSecret: process.env.TWITTER_SECRET, accessToken: process.env.TWITTER_ACCESS_TOKEN, accessTokenSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET });
  toArray(data).forEach(async d => {
    try {
      await twitter_client.tweets.statusesUpdate({ status: d });
    } catch (error) {}
  });
};