var Q = require('q');
var crypto = require('crypto');
var jwt = require('jwt-simple');
var async = require('async');
var moment = require('moment');

var log = require('../log.js');
var errorHandle=require('../errorHandle.js');
var models=require('../models.js');
var tokens=require('../tokens.js');
var utils=require('../utils.js');


function tokenRouteParamCheck(req, res, next) {
    log('post /token: request body :'+ JSON.stringify(req.body));
    // grant_type controle
    if(req.queryParams.grant_type && req.queryParams.grant_type === 'authorization_code') {
        // controleer op geldige code: voor deze client en ook nog geldig
        var error = {
          error: 'invalid_request',
          msg: 'Code invalid or expired.'
        };
        async.waterfall([
          function(callback) {
              var ok = false;
              // authcode populaten, zodat user- en clientgegevens bekend zijn
              models.AuthorizationCode.findOne({code: req.queryParams.code})
              .populate('_client _user').exec(function (err, theAuthorizationCode)
                  {
                      if(!err && theAuthorizationCode) {
                          log('post /token: code gevonden :'+ JSON.stringify(theAuthorizationCode.toObject()));
                          // code mag niet al eerder zijn ingewisseld
                          if (!theAuthorizationCode.used) {
                              models.AuthorizationCode.update({_id: theAuthorizationCode._id}, {$set: {used: true}}, null,
                                  function (err, numberAffected, raw) {
                                      if (err) {
                                          log('post /token: Error updating authcode ' + JSON.stringify(err));
                                      }
                                  }
                              );
                              ok = true;
                          }
                      }
                      callback((ok? null: error), (ok? theAuthorizationCode.toObject(): null));
                  }
              );
          },
          // HTTP auth headers decoderen en client controleren
          function(theAuthorizationCode, callback) {
              // check client depending on registered Client Authentication
              if(!theAuthorizationCode._client.client_authentication_method || theAuthorizationCode._client.client_authentication_method == 'client_secret_basic'){
                  log('post /token: client authorization: client_secret_basic. header:'+req.headers.authorization);
                  var authorization = utils.parseAuthorizationHeader(req.headers.authorization);
              } else if(theAuthorizationCode._client.client_authentication_method == 'client_secret_post') {
                // Client Credentials are in the request body
                log('post /token: client authorization: client_secret_post');
                var authorization = new Array(req.body.client_id||'',req.body.client_secret||'');
              } else {
                error = {
                  error: 'invalid_request',
                  msg: 'Unsupported client authentication method'
                };
                callback(error,null);
              }

              var ok = false;
              if(authorization) {
                  var client_key = authorization[0];
                  var client_secret = authorization[1];
                  // controle of client van token dezelfde is als client in HTTP authorization header
                  if((theAuthorizationCode._client.key == client_key) &&(theAuthorizationCode._client.secret == client_secret)) {
                      log('post /token: code/client match');
                      // als redirect is aangegeven, dan moet deze ook overeenkomen die uris die gelden voor de client
                      ok = true;
                      if (req.body.redirect_uri) {
                          if(req.body.redirect_uri !== theAuthorizationCode._client.redirect_uri) {
                              error = {
                                error: 'invalid_request',
                                msg: 'invalid redirect_uri.'
                              };
                              ok = false;
                          }
                      }
                      if(ok) {
                          //TODO TTL check
                      }
                  }
              } else {
                  error = {
                    error: 'invalid_request',
                    msg: 'invalid client authorization'
                  };
              }
              callback((ok? null: error), (ok? theAuthorizationCode: null));
          }], function(err, theAuthorizationCode) {
            if (err) {
                  var error=new Error();
                  error.message=err.msg;
                  error.sendpostresponse=true;
                  error.idp_error=err.error;
                  return next(error);
            } else {
                req.authorizationCode = theAuthorizationCode;
                return next();
            }
        });
    } else if(req.queryParams.grant_type && req.queryParams.grant_type === 'client_credentials') {
        log('POST token: client_credentials grant');
    }  else {
        var error=new Error();
        error.message='Only authorization_code or client_credentials grants are supported';
        error.sendpostresponse=true;
        error.idp_error='invalid_request';
        return next(error);
    }
}


module.exports = function(app){
    // token route is called by CLIENT. Not the user's useragent! No session.
    app.post('/token', tokenRouteParamCheck, function(req, res, next){
        // accesstoken en idtoken  aanmaken en versturen
        async.waterfall([
          function (callback) {
              tokens.createRefreshToken()
              .then(function(refreshToken){
                  log('refreshToken: ' + JSON.stringify(refreshToken));
                  callback(null, refreshToken)
              })
              .fail(function(err){
                callback({});
              })
              .done();
          },
          function(refreshToken, callback) {
            tokens.createAccessToken(req.authorizationCode._user._id, req.authorizationCode._client._id, req.authorizationCode.scope)
            .then(function(accessToken){
                callback(null, accessToken, refreshToken);
            })
            .fail(function(err){
              callback({});
            })
            .done();
          },
          function(accessToken, refreshToken, callback) {
            tokens.createIdToken(req.authorizationCode._user._id, req.authorizationCode._client.key, req.authorizationCode.nonce,accessToken)
            .then(function(theTokens){
                log('id_token: ' + JSON.stringify(theTokens.id_token));
                callback(null, accessToken, refreshToken, theTokens.id_token)

            .fail(function(err){
              callback({});
            })
            .done()
            })
          }
      ], function(err, accessToken, refreshToken, id_token) {
                if (err) {
                    var error=new Error();
                    error.sendpostresponse=true;
                    error.idp_error='invalid_request';
                    return next(error);
                } else {
                    var jsonResponse = {
                      access_token: accessToken.token,
                      token_type: 'Bearer',
                      expires_in: accessToken.expiresIn,
                      refresh_token: refreshToken,
                      id_token: jwt.encode(id_token, req.authorizationCode._client.secret)
                    };
                    log('tokens created. response to client: ' + JSON.stringify(jsonResponse));
                    res.header('Cache-Control', 'no-store');
                    res.header('Pragma', 'no-cache');
                    res.json(jsonResponse);
                    // update user.lastLoggedIn with current timestamp
                    utils.logLastLoggedIn(req.authorizationCode._user._id, req.authorizationCode._client._id);

                    // send xapistatement regarding user logging in
                    log('post /token: about to send xapistatement');
                    try {
                        utils.sendxApiStatement({
                          actor: req.authorizationCode._user._id,
                          verb: "https://brindlewaye.com/xAPITerms/verbs/loggedin",
                          object: {
                              id:"http://EcoIDPLogin"
                          },
                          context:{
                              id: req.authorizationCode._client._id
                          }
                        });
                    } catch (e) {
                      log('post /token: error in sending xapistatement',true);
                    }
                    log('post /token: xapistatement sent');

                }
            }
        );
    }
);


}