const express = require('express');

const apiApp = express();
const apiRouter = express.Router();
const bodyParser = require('body-parser');
const path = require('path');
const request = require('request-promise');

const config = require(path.join(__dirname, 'config', 'config.js'));
const apiPort = config.ports.api;
const crypto = require('crypto');


const authOptions = {
  user: config.homeAssistant.username, pass: config.homeAssistant.password,  sendImmediately: true
}
apiRouter.use(bodyParser.json()); // for parsing application/x-www-form-urlencoded

apiRouter.post('/:username/:devicename/:hash', async (req, res, next) => {
  try {
    const username = req.params.username;
    const devicename = req.params.devicename;

    if (!username || !devicename) {
      console.log('Missing username or device name');
      return res.status(401).json({ reason: 'Missing values' , proxied: false});
    }

    if (!validateHash(username, devicename, req.params.hash)) {
      validHash = getHash(username, devicename);
      console.log(req.params.hash, 'does not match with ', validHash);
      res.status(401).json({ reason: 'Invalid hash' , proxied: false });
      return;
    }

    const url = config.homeAssistant.url.replace(':username', username).replace(':devicename', devicename);

    let response;
    try {
      console.log("received", req.body)
      response = await request.post({ auth: {...authOptions }, url , json: req.body }).then((res) => res).catch((err) => {
        throw err
      })
    } catch(err){
      console.log(response)
      return next(err);
    }


    res.json( response );
    return next();
  } catch (err) {
    console.log(err.message, err.stack);
    return next(err);
  }
});

const welcome = (req, res, next) => {
  res.send(`IP logged: ${req.connection.remoteAddress}. Good find. There's nothing to do here.`);
  return next();
};

apiRouter.get('/', welcome);

apiApp.use('/fence', apiRouter);
apiApp.get('/', welcome);

apiApp.listen(apiPort, () => {
  console.log('API ready on port', apiPort);
});


apiApp.on('error', function(err){
  console.log("ERROR EVENT CAUGHT!", err)
})


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
