var async = require('async');
var querystring = require('querystring');
var log = require('../log.js');
var errorHandle=require('../errorHandle.js');
var models=require('../models.js');
var utils=require('../utils.js');
var appSettings = require('../appSettings.js');
var moment = require('moment');

module.exports = function(app){
  // Deze url wordt aangeroepen vanuit de useragent.
  app.get('/authorize', authorizeRouteParamCheck,loginneccessary, function(req, res)
      {
          // we dont know this user, yet
          log('/get authorize: user unknown');
          req.session.loginErrorMessage = '';
          req.session.user = null;
          // set referrer, so get login will accept the redirect
          req.session.referrer ='authorize';
          req.session.save();
          res.redirect('/login');
      }
  );
}



function authorizeRouteParamCheck(req, res, next) {
    log('Start authorizeRouteParamCheck. req.queryParams: '+ JSON.stringify(req.queryParams),true);

    if(req.session && req.session.referrer && req.session.referrer=='register'){
        log('called from registration. Goto next middleware');
        return next()
    }

    utils.cleanSession(req,false);  // clean session. Keeps user.

    if (!req.queryParams) {
        var error = new Error('No Parameters');
        error.idp_error = 'invalid_request';
        return next(error);
    } else if (!req.queryParams.response_type || req.queryParams.response_type=='') {
        var error = new Error('Parameter response_type is mandatory.');
        error.idp_error = 'invalid_request';
        return next(error);
    } else if (!req.queryParams.client_id || req.queryParams.client_id=='') {
        var error = new Error('Parameter client_id is mandatory.');
        error.idp_error = 'invalid_request';
        return next(error);
    } else if (!req.queryParams.redirect_uri || req.queryParams.redirect_uri=='') {
        var error = new Error('Parameter redirect_uri is mandatory.');
        error.idp_error = 'invalid_request';
        return next(error);
    } else if (!req.queryParams.scope || req.queryParams.scope.indexOf('openid') ==-1) {
        var error = new Error('Incorrect scope.');
        error.idp_error = 'invalid_request';
        return next(error);
    } else {
        log('req.queryParams: ' + JSON.stringify(req.queryParams));
        models.OpenIDClient.findOne({key: req.queryParams.client_id}).exec(function (err, theClient){
          log('authorizeRouteParamCheck: client: ' +JSON.stringify(theClient));
          if(err){
              error = new Error(JSON.stringify(err));
              return next(error);
          }

          if(!theClient) {
              error = new Error('Client doesn\'t exist or invalid secret.');
              error.idp_error= 'unauthorized_client';
              return next(error);
          }

          if(theClient.redirect_uri !== req.queryParams.redirect_uri) {
              error = new Error('Invalid redirect uri.');
              error.idp_error= 'invalid_request';
              return next(error);
          }

          if (req.queryParams.response_type !=='code' && req.queryParams.response_type !=='id_token token' && req.queryParams.response_type !=='id_token') {
              error = new Error('ECO OP expects code, id_token token or id_token');
              error.idp_error= 'unsupported_response_type';
              return next(error);
          }

          // first check is ok. Start a session.
          req.session.client = theClient.toObject();
          req.session.AuthParams = req.queryParams;

          // determine which flow must be followed
          if(req.queryParams.response_type =='code'){
              req.session.flow='code';
          }

          if((req.queryParams.response_type =='id_token token') || (req.queryParams.response_type =='id_token')){
              req.session.flow='implicit';
          }

          if((req.session.flow !=='implicit') && (req.session.flow!=='code')){
              error = new Error('Invalid flow');
              error.idp_error= 'invalid_request';
          }

          // determine language : using ui_locales parameter
          req.session.requestedLanguage='en';
          if(req.queryParams.ui_locales){
            log('Requested languages: ' + req.queryParams.ui_locales);

            var lang=req.queryParams.ui_locales.toLowerCase().split(' ');
            for(var i=lang.length-1;i>=0;i--){
                var l=lang[i];
                l=l.replace('-','_');
                var u=l.indexOf('_');
                if(u>=0){
                    l=l.substr(0,u);
                }
                if(l==='en' || l==='fr' || l==='es' || l==='de' || l==='it' || l==='pt'){
                  req.session.requestedLanguage=l;
                }
            }
          }
          log('set language: ' + req.session.requestedLanguage);

          req.session.save(function (err, session){
            if (err) {
                log('authorizeRouteParamCheck: Error saving sessiondata in. Error: ' + JSON.stringify(err),true);
                // create new session
                log("generate new session and redirect to /authorize",true);
                req.session.regenerate(function(err) {
                // will have a new session here. try again.
                req.session.client = theClient.toObject();
                req.session.AuthParams = req.queryParams;
                req.session.requestedLanguage='en';
                return res.redirect('/authorize?'+ querystring.stringify(req.queryParams));
              })
            } else {
              log('authorizeRouteParamCheck: detected flow: ' + req.session.flow);
              log('authorizeRouteParamCheck: client found based on client_id :'+ req.session.client.name);
              return next();
            }
          });

        });
    }
}


// check whether user is already logged in, or should login
function loginneccessary(req, res, next) {
    log('enter loginneccessary middleware...');
    if (!req.session.user) {
        log('loginneccessary: User has no session');
        return next();
    } else {
        models.EcoUser.findOne({_id: req.session.user._id}).exec(function (err, user){
          if(err){
              return next(new Error());
          }

          if(user && user.loggedIn ) {
            // a user must fysically log in once a week.
            if(moment().isAfter(moment(user.lastLoggedIn).add(appSettings.IDPSessionLengthDays, 'days'))){
              log('loginneccessary: User known and already logged in, but > IDPSessionLengthDays ago. Must login again.');
              user.loggedIn=false;
              user.stayLoggedIn=true;
              return next();
            } else {
              log('loginneccessary: User known and already logged in. Redirect to consent');
              // set referrer, so get consent will accept the submit
              req.session.referrer ='authorize';
              res.redirect('/consent');
            }
          } else {
              return next();
          }
        });
    }
}

