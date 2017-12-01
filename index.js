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

function changeAnyoneAtHome(newStatus){
  if(anyoneAtHome == newStatus){
    return ;
  }
  anyoneAtHome = newStatus;
  lastStatusChange = new Date()
}

let presenceStatus = {}
let anyoneAtHome = false;
let lastStatusChange = new Date()

apiRouter.get('/:username/:devicename/:hash/:inOut', function(req, res, next){
  let username = req.params.username;
  let devicename = req.params.devicename
  let inOut = req.params.inOut === "in"


  if(!username || !devicename){
    console.log("Missing username or device name");
    return res.status(401).json({ reason: "Missing values"});

  }

  if(!validateHash(username, devicename, (inOut ? "in" : "out"), req.params.hash)){
    console.log(req.params.hash, "does not match");
    res.status(401).json({ reason: "Invalid hash"});
    return ;
  }

  if(undefined == presenceStatus[username]){
    presenceStatus[username] = { devices: {}, inFence: false };
  }

  if(undefined == presenceStatus[username]['devices'][devicename]){
    presenceStatus[username]['devices'][devicename] = {}
  }
  presenceStatus[username]['devices'][devicename]['inFence'] = inOut


  if(inOut){
    // If at least one device is in the fence, the user is at home
    presenceStatus[username]['inFence'] = true
    changeAnyoneAtHome(true);
    console.log("Device is IN. User is IN.");
  } else {
    // If the device is not at home, we'll need to re-evaluate the overall user status...


    if(presenceStatus[username]['inFence'] == true){
      changeAnyoneAtHome(true);
      console.log("Evaluate all devices");
      let deviceNames = Object.keys(presenceStatus[username]['devices'])

      // But only if the user is flagged as online
      let userStatus = deviceNames.reduce(function(accumulator, deviceName){
        console.log("Evaluating", deviceName, presenceStatus[username]['devices'][deviceName]['inFence']);
        if(presenceStatus[username]['devices'][deviceName]['inFence']){
          return true;
        }

        return accumulator || presenceStatus[username]['devices'][deviceName]['inFence'];

      }, false)
      presenceStatus[username]['inFence'] = userStatus
    }

    if(anyoneAtHome){
      // re-evaluate overall presnece
      let usernames = Object.keys(presenceStatus)

      // But only if the user is flagged as online
      changeAnyoneAtHome(usernames.reduce(function(accumulator, username){
        console.log("Evaluating", username, presenceStatus[username]['inFence']);
        if(presenceStatus[username]['inFence']){
          return true;
        }

        return accumulator || presenceStatus[username]['inFence'];

      }, false))
    }
  }

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
  presence: {lastStatusChange : lastStatusChange, anyoneAtHome: anyoneAtHome, users: presenceStatus }
}

  res.status(200).json(response)
})

securityRouter.post('/', function(req, res, next){
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
  console.log("Use http://127.0.0.1:"+apiPort+"/fence/nico/moto5/" + getHash("nico", "moto5", "in") + "/in \nand http://127.0.0.1:"+apiPort+"/fence/nico/moto5/" + getHash("nico", "moto5", "out") + "/out to set status" )
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
