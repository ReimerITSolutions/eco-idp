var url = require('url');
var methodOverride = require('method-override')();
var errorHandler = require('errorhandler');
var cors = require('cors');
var http = require('http');
var path = require('path');
var querystring = require('querystring');
var extend = require('extend');
var jwt = require('jwt-simple');
var ejs = require('ejs');
var mongoose = require('mongoose');
var express = require('express');
var redis = require('redis');
var redisClient = redis.createClient();
//var cookieParser = require('cookie-parser');
var expressSession = require('express-session');
//var MongoStore = require('connect-mongo')(expressSession);
var redisStore = require('connect-redis')(expressSession);
var bodyParser = require('body-parser');
var Q = require('q');
var async = require('async');
var crypto = require('crypto');
var moment = require('moment');
var validator = require('validator');
var favicon = require('serve-favicon');


var appSettings = require('./appSettings.js');
var log = require('./log.js');

appSettings.mongoIDPConnection = mongoose.createConnection('mongodb://'+ appSettings.mongoIDPDBUser + ":" + appSettings.mongoIDPDBPassword + '@' + appSettings.mongoHost + ':' + appSettings.mongoPort + '/' +appSettings.mongooseIDPDB);
appSettings.mongoIDPConnection.on('error', console.error.bind(console, 'connection error:'));
appSettings.mongoIDPConnection.once('open', function callback (){
    log('MongoDB connected');
    var models=require('./models.js');
    var utils=require('./utils.js');
    var app = express();
    app.set('appSettings',appSettings);// make settings available in every route
    app.set('view engine', 'ejs');
    app.set('port', appSettings.port);

    app.use(favicon(__dirname + '/favicon.ico'));
    app.use(express.static(__dirname + '/static'));

    var sessionMiddleware = expressSession({
        name: appSettings.SessionCookieName,
        resave: true,
        saveUninitialized:false,
        secret: appSettings.SessionSecret,
        rolling: true,

        cookie: {
            maxAge: 1000*60*60*24*10,  //maxAge in milliseconds. 10 days
        },
        store: new redisStore({
            host: 'localhost',
            port: 6379,
            client: redisClient,
            db: appSettings.RedisDbIndex,
            ttl: 60*60*24*10,  // ttl in seconds. 10 days
        }),
    });

    function startSession(req, res, next){
        var tries = 10;

        function lookupSession(error) {
            if (error) {
              return next(error)
            }
            tries -= 1

            if (req.session !== undefined) {
              log('got Session: ' + JSON.stringify(req.session) ,false);
              return next()
            } else {
                if(tries < 9){
                    log('Still no req.session available. Attempt ' + (10-tries) ,true)
                }

                if (tries < 0) {
                  log('ERROR STARTING SESSION',true)
                  return next(new Error('Error starting session'))
                }

                sessionMiddleware(req, res, lookupSession)
            }
        }

        lookupSession();
    }

    // parse application/x-www-form-urlencoded
    app.use(bodyParser.urlencoded({ extended: false }))
    // parse application/json
    app.use(bodyParser.json())
    app.use(methodOverride);
    app.use(cors());
    //app.use(cookieParser(appSettings.SessionSecret));
    app.use(startSession);
    app.use(fillQueryParams);

    // define the routes....
    require('./routes/index.js')(app);

    app.get('*', function(req, res, next) {
      var err = new Error();
      err.status = 404;
      next(err);
    });

    require('./errorHandle.js')(app);

    var server = app.listen(app.get('port'), function(){
          log('ECO OpenIDConnect Provider ('+ app.get('appSettings').versionInfo +')  Listening on port ' + app.get('port'),true);
    });
});


// wether it's a POST or a GET, move all parameters into the req.queryParams object.
function fillQueryParams(req, res, next) {
    req.queryParams = {};
    try {
        extend(req.queryParams, req.query) // url parameters
        extend(req.queryParams, req.body) //body parameters
    } catch(e) {
    }
    next();
}
