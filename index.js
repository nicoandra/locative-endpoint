const express = require('express');

const apiApp = express();
const apiRouter = express.Router();
const bodyParser = require('body-parser');
const path = require('path');
const request = require('request');

const config = require(path.join(__dirname, 'config', 'config.js'));
const apiPort = config.ports.api;
const crypto = require('crypto');

apiRouter.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded

apiRouter.post('/:username/:devicename/:hash', async (req, res, next) => {
  try {
    const username = req.params.username;
    const devicename = req.params.devicename;

    if (!username || !devicename) {
      console.log('Missing username or device name');
      return res.status(401).json({ reason: 'Missing values' });
    }

    if (!validateHash(username, devicename, req.params.hash)) {
      validHash = getHash(username, devicename);
      console.log(req.params.hash, 'does not match with ', validHash);
      res.status(401).json({ reason: 'Invalid hash' });
      return
    }

    console.log(req.body);

    const uri = config.homeAssistant.uri.replace(':username', username).replace(':devicename', devicename);
    const url = config.homeAssistant.protocol + '://' + config.homeAssistant.host + ":" + config.homeAssistant.port + uri;

    const response = new Promise((ok, ko) => {
      request.post({ url }).send('ABC', function(err, res){
        if(err){
          return ko(err)
        };
        return ok(res)
      })
    }).then((res) => {
      return res.body
    });



    console.log(url, response)

    res.json({});
    return next();
  } catch (err) {
    console.log(err.message, err.stack);
    return next(err);
  }
});

const welcome = (req, res, next) => {
  res.send("IP logged: " + req.connection.remoteAddress + ". Good find. There's nothing to do here.");
  return next();
}

apiRouter.get('/', welcome);

apiApp.use('/fence', apiRouter);
apiApp.get('/', welcome)

apiApp.listen(apiPort, () => {
  console.log('API ready on port', apiPort);
});

function getHash(username, devicename) {
  const hmac = crypto.createHmac('sha256', config.keys.endpointKey);
  const toHash = [username, devicename, config.keys.endpointSalt].join('-');

  hmac.update(toHash);
  const hash = hmac.digest('base64').replace(/[\/,=]/g, ''); // Generate the hash and remove special URL characters
  hmac.end();
  return hash;
}

function validateHash(username, devicename, receivedHash) {
  const generatedHash = getHash(username, devicename);
  return generatedHash === receivedHash;
}
