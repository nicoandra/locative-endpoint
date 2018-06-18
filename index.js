const express = require('express');

const apiApp = express();
const apiRouter = express.Router();
const bodyParser = require('body-parser');
const path = require('path');

const config = require(path.join(__dirname, 'config', 'config.js'));
const apiPort = config.ports.api;
const crypto = require('crypto');

securityApp.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded

function changeAnyoneAtHome(newStatus) {
  if (anyoneAtHome == newStatus) {
    return;
  }
  anyoneAtHome = newStatus;
  lastStatusChange = new Date();
}

const presenceStatus = {};
let anyoneAtHome = false;
let lastStatusChange = new Date();

apiRouter.post('/:username/:devicename/:hash', (req, res, next) => {
  try {
    const username = req.params.username;
    const devicename = req.params.devicename;

    if (!username || !devicename) {
      console.log('Missing username or device name');
      return res.status(401).json({ reason: 'Missing values' });
    }

    if (!validateHash(username, devicename, req.params.hash)) {
      console.log(req.params.hash, 'does not match');
      res.status(401).json({ reason: 'Invalid hash' });
      return;
    }

    console.log(req.body);

    res.status(200).json({});
    return next();
  } catch (err) {
    console.log(err.message, err.stack);
    return next(err);
  }
});


apiRouter.get('/', (req, res, next) => {
  console.log(req);
  res.send("IP logged. Good find. There's nothing to do here.");
});

securityRouter.get('/', (req, res, next) => {
  const response = {
    status: {
      uptime: process.uptime(),
    },
    presence: { lastStatusChange, anyoneAtHome, users: presenceStatus },
  };

  res.status(200).json(response);
});

securityRouter.post('/', (req, res, next) => {
  try {
    const inHash = getHash(req.body.username, req.body.devicename, 'in');
    const inUrl = [`:${apiPort}`, 'fence', req.body.username, req.body.devicename, inHash, 'in'].join('/');

    const outHash = getHash(req.body.username, req.body.devicename, 'out');
    const outUrl = [`:${apiPort}`, 'fence', req.body.username, req.body.devicename, outHash, 'out'].join('/');
    res.status(200).json({ in: inUrl, out: outUrl });
  } catch (excp) {
    res.status(500).json(excp);
  }
});

apiApp.use('/fence', apiRouter);
securityApp.use('/', securityRouter);


apiApp.listen(apiPort, () => {
  console.log('API ready on port', apiPort);
  console.log(`Use http://127.0.0.1:${apiPort}/fence/nico/moto5/${getHash('nico', 'moto5', 'in')}/in \nand http://127.0.0.1:${apiPort}/fence/nico/moto5/${getHash('nico', 'moto5', 'out')}/out to set status`);
});

securityApp.listen(securityPort, () => {
  console.log('SecurityApp ready on port', securityPort);
});


defaultApp.get('/', (req, res, next) => {
  res.send('App up and running');
});

defaultApp.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});


defaultApp.on('error', (err) => {
  console.log('Handled error event', err);
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
  const generatedHash = getHash(username, devicename, inOut);
  return generatedHash === receivedHash;
}
