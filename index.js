const express = require('express')
      , apiApp = express()
      , apiRouter = express.Router()
      , securityApp = express()
      , securityRouter = express.Router()
      , bodyParser = require('body-parser')
      , path = require('path')
      , config = require(path.join(__dirname,'config','config.js'))
      , apiPort = config.ports.api
      , securityPort = config.ports.security
      , crypto = require('crypto')


securityApp.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded
let presenceStatus = {}

apiRouter.get('/:username/:devicename/:hash/:inOut', function(req, res, next){
  if(!validateHash(req.params.username, req.params.devicename, req.params.inOut, req.params.hash)){
    console.log(req.params.hash, "does not match");
    res.status(401).json({ reason: "Invalid hash"});
    return ;
  }

  if(undefined == presenceStatus[req.params.username]){
    presenceStatus[req.params.username] = {};
  }

  if(undefined == presenceStatus[req.params.username][req.params.devicename]){
    presenceStatus[req.params.username][req.params.devicename] = {}
  }
  presenceStatus[req.params.username][req.params.devicename]['inFence'] = (req.params.inOut == 'in')
  res.status(200).json({})
})

apiRouter.get("/", function(req, res, next){
  res.send("Good find. There's nothing to do here.")
  return ;
})

securityRouter.get('/', function(req, res, next){

let response = {
  status: {
    uptime : process.uptime()
  },
  presence: presenceStatus
}

  res.status(200).json(response)
})

securityRouter.post('/', function(req, res, next){
  console.log("POST", req.body)
  try {
    let inHash = getHash(req.body.username, req.body.devicename, 'in') ;
    let inUrl = [':' + apiPort, 'fence', req.body.username, req.body.devicename, inHash, 'in'].join('/')

    let outHash = getHash(req.body.username, req.body.devicename, 'out') ;
    let outUrl = [':' + apiPort, 'fence', req.body.username, req.body.devicename, outHash, 'out'].join('/')
    res.status(200).json({in: inUrl, out: outUrl})
  } catch(excp){
    res.status(500).json(excp)
  }
  return
})

apiApp.use('/fence', apiRouter)
securityApp.use('/', securityRouter)

apiApp.listen(apiPort, function(){
  console.log("API ready on port", apiPort)
})

securityApp.listen(securityPort, function(){
  console.log("SecurityApp ready on port", securityPort)
})

function getHash(username, devicename, inOut){
  let hmac = crypto.createHmac('sha256', config.keys.endpointKey);
  let toHash = [username, devicename, inOut, config.keys.endpointSalt].join('-')

  hmac.update(toHash)
  let hash = hmac.digest('base64').replace(/[\/,=]/g,'')  // Generate the hash and remove special URL characters
  hmac.end()
  return hash
}

function validateHash(username, devicename, inOut, receivedHash){
  let generatedHash = getHash(username, devicename, inOut);
  return generatedHash === receivedHash;

}


/*hmac.update("HELLO DAMN");
console.log(config, hmac.digest('base64'));
*/

/* Create these endpoints:

1-apiPort Leaving the fence (/fence/{username}/{devicename}/{devicehash}/out )
2-apiPort Entering the fence  (/fence/{username}/{devicename}/{devicehash}/in )
3-securityPort Post username and devicename; and get back the URL where the device should post the status
4-securityPort Query status: /fence/status , which will return a JSON with the following info

{
  username1 : {
  devicename1: (in/out),
  devicename2: (in/out)
  devicename3: (in/out)
},
username2 : {
devicename1: (in/out),
devicename2: (in/out)
devicename3: (in/out)
},
}
5-Set up the following rules in the firewall:


- Allow connections to port 58974 from the local network
iptables -I

- Allow
6-Create new user group applications + user applications to run both lightmanager and opengps endpoints

2605:8d80:5e4:5ea6:a070:94f4:eb58:69a1
2605:8d80:5e4:5ea6:58f6:3a20:fe3:ad6d
2605:8d80:5e4:5ea6:6bf2:3fd4:91d7:23cc
24.114.94.0-255
2605:8d80:5e4:5ea6:9b2:5ba2:b910:2ce4

*/
