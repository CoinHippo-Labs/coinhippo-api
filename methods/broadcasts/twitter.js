const { TwitterApi } = require('twitter-api-v2');

const { toArray } = require('../../utils/parser');

module.exports = async data => {
  const twitterClient = new TwitterApi({ appKey: process.env.TWITTER_KEY, appSecret: process.env.TWITTER_SECRET, accessToken: process.env.TWITTER_ACCESS_TOKEN, accessSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET });
  toArray(data).forEach(async d => {
    try {
      await twitterClient.v2.tweet(d);
    } catch (error) {}
  });
};