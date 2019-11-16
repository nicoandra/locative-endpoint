module.exports = {
  ports: {
    api: process.ENV['LOCATIVE_PORT'] || 12345
  },
  keys: {
    endpointKey: 'INSERT RANDOM KEY HERE',
    endpointSalt: 'Spark some salt in here.'
  },
  homeAssistant: {
    urls: {
      oneUser: {
        oneDevice: [
          // Whitelist of webhooks that are accessible to this user-device combination
          '/api/webhook/YOUR_LONG_WEBHOOK_HASH_GOES_HERE_GET_IT_FROM_HOME_ASSISTANT'
        ]
      }
    },
    host: 'http://homeassistant:8123', // /api/owntracks/:username/:devicename', // Keep :username and :devicename so
    username: 'homeassistant',
    password: 'welcome'
  }
}
