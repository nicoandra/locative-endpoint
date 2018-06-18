module.exports = {
  ports: {
    api: 12345
  },
  keys: {
    endpointKey: 'INSERT RANDOM KEY HERE',
    endpointSalt: 'Spark some salt in here.',
  },
  homeAssistant: {
    host: '127.0.0.1',
    port: 8123,
    protocol: 'http',
    uri: '/api/owntracks/:username/:devicename' // Keep :username and :devicename so
  }
};
