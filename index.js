const express = require('express');
const apiApp = express();
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

const authOptions = {
  user: config.homeAssistant.username, pass: config.homeAssistant.password,  sendImmediately: true
}
apiRouter.use(bodyParser.json()); // for parsing application/x-www-form-urlencoded

const findHAWebhookFromHash = (list, hash) => {
  if (hash.length < 6) {
    throw new Error("Provided hash is too short")
  }

  const url = list.filter((hookUrl) => {  
    return hookUrl.includes(hash);
  })

  if (!url.length) {
    throw new Error("No matching URL with hash " + hash)
  }
  return config.homeAssistant.host + url;
}

apiRouter.use((req, res, next) => {
  if(req.method !== 'POST') {
    // Applies to POST only
    return next();
  }

  let [_, username, devicename, hash] = req.url.split('/');
  if (!username || !devicename || !hash || hash.length < 6) {
    return next("Missing username, devicename or hash. Or your hash is too short?");
  }

  if (!config.homeAssistant.urls[username] || !config.homeAssistant.urls[username][devicename]) {
    return next("Such username and devicename don't seem to exist in my configuration file. But you seem to be on track.")
  }

  req.username = username;
  req.devicename = devicename;
  req.hash = hash;
  req.proxyTo = findHAWebhookFromHash(config.homeAssistant.urls[username][devicename], hash);

  console.log("Request made sense. Enriching it with information to proxy it properly");
  return next();
})

apiRouter.post('/:username/:devicename/:hash', async (req, res, next) => {
    
    try {
      const url = req.proxyTo;
      const ip = req.remoteIp;

      console.log(`Accepted connection from ${ip}, proxying to ${url}`);

      return new Promise((ok, ko) => {
        request.post({
          auth: {...authOptions }, 
          url,
          json: req.body,
          headers : {
            'x-limit-u': req.username,
            'x-limit-d': req.devicename
          }
        }, (err, response) => {
          if (err) return ko(err);
          return ok(response);
        })
      }).then((res) => {
        console.log("Response:", response)
        res.json( response );
        return next();   
      }).catch((err) => {
        console.log(err)
        return next(err);
      })
    } catch(err){
      console.log(err)
      return next(err);
    }
  
});


apiApp.use('/', apiRouter);

apiApp.listen(apiPort, () => {
  console.log('API ready on port', apiPort);
});

apiApp.on('error', function(err){
  console.log("ERROR EVENT CAUGHT!", err)
})
