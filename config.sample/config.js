module.exports = {
  ports: {
    api: process.ENV['LOCATIVE_PORT'] || 12345,
  },
  keys: {
    endpointKey: 'INSERT RANDOM KEY HERE',
    endpointSalt: 'Spark some salt in here.',
  },
  homeAssistant: {
    urls: {
      oneUser : {
        oneDevice : {
          uri : '/api/webhook/YOUR_LONG_KEY'
        }
      }
    },
    host: 'http://homeassistant:8123', // /api/owntracks/:username/:devicename', // Keep :username and :devicename so
    username: 'homeassistant',
    password: 'welcome'
  },
};
