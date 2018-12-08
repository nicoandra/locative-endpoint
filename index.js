const express = require('express');

const apiApp = express();
const apiRouter = express.Router();
const bodyParser = require('body-parser');
const path = require('path');
const request = require('request-promise');

const config = require(path.join(__dirname, 'config', 'config.js'));
const apiPort = config.ports.api;
const crypto = require('crypto');
const RateLimit = require('express-rate-limit');

const extractIpFromHeaders = function(req, res, next){
  // Use only when Nginx set up as proxy. Otherwise the remoteIp value might be tampered by an attacker.
  req.remoteIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  req.ip = req.remoteIp;
  return next();
}

apiRouter.use(extractIpFromHeaders);
apiApp.use(extractIpFromHeaders);

const rateLimiter = new RateLimit({
  windowMs: 20*1000, // 20 sec
  max: 10, // limit each IP to 100 requests per windowMs
  delayMs: 0 // disable delaying - full speed until the max limit is reached
});



const firewallOpener = new RateLimit({
  windowMs: 10*1000, // 10 sec
  max: 4, // limit each IP to 3 requests per windowMs
  delayMs: 0, // disable delaying - full speed until the max limit is reached
  onLimitReached: (req, res, next) => {
    console.log("Firewall would have been unlocked for " , req.ip);
    // next();
  },
  message: '{"Message":"Went through"}'
});


//  apply to all requests. Rate limiter needs to go AFTER we've obtained the remote IP from the headers (as we're behind a reverse proxy)
apiApp.enable("trust proxy"); // only if you're behind a reverse proxy (Heroku, Bluemix, AWS ELB, Nginx, etc)
apiApp.use(rateLimiter);

const authOptions = {
  user: config.homeAssistant.username, pass: config.homeAssistant.password,  sendImmediately: true
}
apiRouter.use(bodyParser.json()); // for parsing application/x-www-form-urlencoded

apiRouter.get('/testme', async (req, res, next) => {
  firewallOpener(req, res, function(){
    res.send("Hit!");
    next();
  });
})

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

    let response;
    try {
      const url = config.homeAssistant.host + config.homeAssistant.urls[username][devicename].uri;

      const ip = req.remoteIp;
      console.log(`Accepted connection from ${ip}, hit ${url}`);
      response = await request.post({ auth: {...authOptions }, url , json: req.body }).then((res) => res).catch((err) => {
        throw err
      })
    } catch(err){
      console.log(response)
      return next(err);
    }

    console.log("Response:", response)
    res.json( response );
    return next();
  } catch (err) {
    console.log(err.message, err.stack);
    return next(err);
  }
});

const welcome = (req, res, next) => {
  console.log(req.headers);
  const ip = req.remoteIp;

  if(ip === '::ffff:192.168.1.1.'){
    res.redirect(':8123');
    return next();
  }

  res.send(`IP logged: ${ip}. Good find. There's nothing to do here.`);
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
