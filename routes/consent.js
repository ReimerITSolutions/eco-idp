var Q = require('q');
var moment = require('moment');
var jwt = require('jwt-simple');
var querystring = require('querystring');
var async = require('async');


var log = require('../log.js');
var errorHandle=require('../errorHandle.js');
var models=require('../models.js');
var tokens=require('../tokens.js');
var utils=require('../utils.js');


module.exports = function(app){

  app.get('/consent', function(req, res,next){
      log('get /consent...');

      if(!req.session || !req.session.referrer || (req.session.referrer !=='authorize' && req.session.referrer !=='login' && req.session.referrer !=='changepw'  )){
        error = utils.createAccessDeniedError(req);
        req.session.referrer=null;
        req.session.save();
        return next(error);
      }

      // check if session still valid.
      if(!(req.session.user && req.session.user._id && req.session.client && req.session.client._id && req.session.AuthParams)){
        log('PREVENTED missing AUthparams bug. Raizing error.',true);
        var error = new Error();
        error.idp_error = null;
        req.session.save();
        return next(error);
      }

      if(!req.session.requestedLanguage){
        req.session.requestedLanguage='en';
      }
      req.session.referrer = "consent";
      req.session.save();

      getCurrentConsent(req.session.user._id, req.session.client._id)
      .then(function(currentScopes){
         log('get /consent currentScopes for user '+ req.session.user._id + '(' + req.session.user.name + ')' + ' and client ' + req.session.client.name + ': ' + JSON.stringify(currentScopes));

        var extraScopes = getExtraScopes(currentScopes, req.session.AuthParams.scope.split(' ') );

        // remove openid scope
        var i=currentScopes.indexOf('openid');
        if(i>-1){
          currentScopes.splice(i, 1);
        }
        i=extraScopes.indexOf('openid');
        if(i>-1){
          extraScopes.splice(i, 1);
        }
        log('get /consent extraScopes: ' + JSON.stringify(extraScopes));


        // add scope descriptions
        var currentScopeList=new Array();
        for(i=0;i<currentScopes.length;i++){
          currentScopeList.push(app.get('appSettings')['supportedScopes'+req.session.requestedLanguage][currentScopes[i]]);
        }
        var newScopeList=new Array();
        for(i=0;i<extraScopes.length;i++){
          newScopeList.push(app.get('appSettings')['supportedScopes'+req.session.requestedLanguage][extraScopes[i]]);
        }

        // when there are no new scopes to give consent for, dont show this screen
        if(newScopeList.length >0){
          log('get /consent: show consent screen');
          res.render(req.session.requestedLanguage +'/consent.ejs', {
              appName: req.session.client.public_AppName,
              currentScopeList:currentScopeList,
              newScopeList: newScopeList,
              legal_terms_url: req.session.client.legal_terms_url||null,
              privacy_policy_url: req.session.client.privacy_policy_url||null,
          });
        } else {
            log('get /consent: no user consent needed');
            next();
        }
      })
      .done();
      },
      sendTokens
  );


  app.post('/consent', function(req, res,next){
      log('post /consent...');

      if(!req.session || !req.session.referrer || req.session.referrer !=='consent' ){
        error = utils.createAccessDeniedError(req);
        req.session.referrer=null;
        req.session.save();
        return next(error);
      }

      if(req.body.ok){
        // save the consent
        models.Consent.findOne({_user:req.session.user._id, _client:req.session.client._id}).exec(function (err, theConsent){
          if(theConsent) {
              theConsent.scope = req.session.AuthParams.scope;
              theConsent.createdOn =  new Date();
              theConsent.save(function (err, theConsent){
                if (err) {
                    log('Error saving consent. Error: ' + JSON.stringify(err));
                } else {
                    log('consent saved:'+ JSON.stringify(theConsent.toObject()));
                }
              });
          } else {
              var consent = new models.Consent({
                  _user: req.session.user._id,
                  _client: req.session.client._id,
                  createdOn: new Date(),
                  scope: req.session.AuthParams.scope
              });

              consent.save(function (err, theConsent){
                if (err) {
                    log('Error saving consent. Error: ' + JSON.stringify(err));
                } else {
                    log('consent saved:'+ JSON.stringify(theConsent.toObject()));
                }
              });
          }
          next();
        });
      } else {
        // cancel login
        error = utils.createAccessDeniedError(req);
        req.session.referrer=null;
        req.session.save();
        return next(error);
      }
  },
  sendTokens
  );
}


function sendTokens(req, res, next){
    log('enter send tokens...');
    req.session.referrer=null;
    req.session.save();

    // request updating of this user's course progress
    utils.updateUserCourseProgress(req.session.user._id);

    if(req.session.flow=='code'){
      tokens.createUserAccessCode(req.session.user._id, req.session.client._id, req.session.AuthParams.nonce, req.session.AuthParams.scope, req.session.client.redirect_uri)
      .then(function(code){
        log('sendTokens: code: ' + JSON.stringify(code));
        var state = req.session.AuthParams.state;
        var concat='?';
        if(req.session.AuthParams.redirect_uri.indexOf('?')>0){
            concat='&';
        }
        var redirectUrl = req.session.AuthParams.redirect_uri + concat +'code=' + encodeURIComponent(code) + '&state=' + encodeURIComponent(state);
        // send user back to client. Our work is done
        log('sendTokens: finished for now. Code ready. redirect to '+ redirectUrl);
        if (req.session.client.redirect_httpcode){
            utils.cleanSession(req,false);  // clean session. Keeps user.
            res.redirect(redirectUrl);
        } else {
            utils.cleanSession(req,false); //clean session. Keeps user.
            res.redirect(200, redirectUrl);
        }
      })
      .fail(function(err){
          log('sendTokens: error creating code: '+ err);
          return next(new Error());
      })
      .done();
    }

    if(req.session.flow=='implicit'){
        async.waterfall([
          function(callback){
            if(req.session.AuthParams.response_type ==='id_token'){
              callback(null,null);  // no accestoken when implicit flow and response_type=id_token
            } else {
              tokens.createAccessToken(req.session.user._id, req.session.client._id, req.session.AuthParams.scope)
              .then(function(access_token){
                  callback(null, access_token)
              })
              .fail(function(err){
                  callback({});
              })
              .done();
            }
          },

          function (access_token, callback) {
              tokens.createIdToken(req.session.user._id, req.session.client.key, (req.session.AuthParams.nonce||null), access_token)
              .then(function(theTokens){
                  log('id_token: ' + JSON.stringify(theTokens.id_token));
                  log('access_token ' + JSON.stringify(theTokens.access_token));
                  var jwtID_token=jwt.encode(theTokens.id_token, req.session.client.secret);  // default encoding HS256
                  var data={
                      id_token: jwtID_token,
                  }

                  // only an accestoken in implicit flow when response_type=id_token token
                  if(req.session.AuthParams.response_type !=='id_token'){
                      data.access_token= theTokens.access_token.token;
                      data.token_type= 'Bearer';
                  }

                  if (req.session.AuthParams.state){
                      data.state=req.session.AuthParams.state ;
                  }

                  var redirectUrl = req.session.AuthParams.redirect_uri + '#'+ querystring.stringify(data);
                  // send user back to client. Our work is done
                  log('finished. tokens ready. redirect to '+ redirectUrl);
                  if (req.session.client.redirect_httpcode){
                      utils.cleanSession(req,false);  // clean session. Keeps user.
                      res.redirect(redirectUrl);
                  } else {
                      utils.cleanSession(req,false); //clean session. Keeps user.
                      res.redirect(200, redirectUrl);
                  }
                  // update user.lastLoggedIn with current timestamp
                  utils.logLastLoggedIn(req.session.user._id, req.session.client._id);

                  // send xapistatement regarding user logging in
                  log('sendTokens: send xapistatement');
                  try {
                      utils.sendxApiStatement({
                        actor: req.session.user._id,
                        verb: "https://brindlewaye.com/xAPITerms/verbs/loggedin",
                        object: {
                            id:"http://EcoIDPLogin"
                        },
                        context:{
                            id: req.session.client._id
                        }
                      });
                  } catch (e) {
                    log('sendTokens: error in sending xapistatement',true);
                  }
                  log('sendTokens: sent xapistatement');
                  callback(null);
              })
              .fail(function(err){
                callback({});
              })
              .done();
          }],function(err) {
                if (err) {
                    utils.cleanSession(req,true); //clean session, inclusing user.
                    var error=new Error();
                    error.sendpostresponse=true;
                    error.idp_error='invalid_request';
                    next(error);
                }
            }
        );
    }
}


function getCurrentConsent(userId,clientId){
    var deferred = Q.defer();

    models.Consent.findOne({_user: userId, _client:clientId}).exec(function (err, theConsent){
        var scopeList=new Array();

        if(theConsent) {
          scopeList=theConsent.scope.split(' ');
        }
        deferred.resolve(scopeList);
    });

    return deferred.promise;
}

function getExtraScopes(oldScopes, newScopes){
    // compare new scopes with old scopes, returns a list of scopes that are present in new but not in old.
    var extraScopeList=new Array();
    for(var i=0;i < newScopes.length;i++){
        if(oldScopes.indexOf(newScopes[i]) == -1){
            extraScopeList.push(newScopes[i]);
        }
    }
    return extraScopeList;
}

