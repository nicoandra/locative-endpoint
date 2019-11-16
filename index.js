const express = require('express');

const apiRouter = express.Router();
const bodyParser = require('body-parser');
const path = require('path');
const request = require('request-promise');

const config = require(path.join(__dirname, 'config', 'config.js'));
const apiPort = config.ports.api;

const extractIpFromHeaders = function(req, res, next){
  // Use only when Nginx set up as proxy. Otherwise the remoteIp value might be tampered by an attacker.
  req.remoteIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  req.ip = req.remoteIp;
  return next();
}

apiRouter.use(extractIpFromHeaders);

//  apply to all requests. Rate limiter needs to go AFTER we've obtained the remote IP from the headers (as we're behind a reverse proxy)
apiApp.enable("trust proxy"); // only if you're behind a reverse proxy (Heroku, Bluemix, AWS ELB, Nginx, etc)
apiApp.use(rateLimiter);

const authOptions = {
  user: config.homeAssistant.username, pass: config.homeAssistant.password,  sendImmediately: true
}
apiRouter.use(bodyParser.json()); // for parsing application/x-www-form-urlencoded

apiRouter.post('/:username/:devicename/:hash', async (req, res, next) => {
  try {
    const username = req.params.username;
    const devicename = req.params.devicename;

	  console.log(req.headers);
    if (!username || !devicename) {
      console.log('Missing username or device name');
      return res.status(401).json({ reason: 'Missing values' , proxied: false});
    }

    let response;
    try {
      // const url = config.homeAssistant.host + config.homeAssistant.urls[username][devicename].uri;
      const url = config.homeAssistant.host + req.params.hash;

      const ip = req.remoteIp;
      console.log(`Accepted connection from ${ip}, hit ${url}`);
      response = await request.post({ 
    		auth: {...authOptions }, 
		    url,
		    json: req.body,
		    headers : {
          'x-limit-u': username,
          'x-limit-d': devicename
    		}
	    }).then((res) => res).catch((err) => {
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

apiApp.listen(apiPort, () => {
  console.log('API ready on port', apiPort);
});

apiApp.on('error', function(err){
  console.log("ERROR EVENT CAUGHT!", err)
})
