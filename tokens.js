var Q = require('q');
var crypto = require('crypto');
var moment = require('moment');
var base64url=require('base64url');

var log = require('./log.js');
var errorHandle=require('./errorHandle.js');
var models=require('./models.js');
var appSettings = require('./appSettings.js');

function createUserAccessCode(userID, clientID, nonce, scope, redirect_uri) {
    var deferred = Q.defer();
    var createAuthorizationCode = function() {
        var theCode = crypto.createHash('md5').update(clientID+'', 'binary').update(Math.random()+'', 'binary').digest('hex');
        models.AuthorizationCode.findOne({code: theCode}).exec(function (err, authorizationCode)
            {
                if (authorizationCode) {
                    createAuthorizationCode()
                } else {
                    saveAuthorizationCode(theCode);
                }
            }
        );
    };
    var saveAuthorizationCode = function(code) {
        var authorizationCode = new models.AuthorizationCode(
            {code: code,
            createdOn: new Date(),
            redirect_uri: redirect_uri,
            _user: userID,
            used: false,
            scope: scope || null,
            nonce: nonce || null,
            _client: clientID}
        );
        authorizationCode.save(function (err, theAuthorizationCode)
            {
                if (err) {
                    log('Error saving accessCode. Error: ' + JSON.stringify(err));
                    deferred.reject(err);
                } else {
                    log('generated accesscode :'+ JSON.stringify(theAuthorizationCode.toObject()));
                    deferred.resolve(theAuthorizationCode.code);
                }
            }
        );
    }
    createAuthorizationCode();
    return deferred.promise;
}

function createRefreshToken(userID, clientID, scope) {
    var deferred = Q.defer();
    var refreshToken = crypto.createHash('md5').update('rf' + Math.random()+'').digest('hex');
    // TODO: controle op uniekheid van token, token opslaan in reatie met clientID
    deferred.resolve(refreshToken);
    return deferred.promise;
}

function createIdToken(userID, clientKey, nonce,access_token) {
    var deferred = Q.defer();

    // determine at_hash

    // response_type 'token id_token' returns both id_token and accesstoken
    // but response_type 'id_token' returns only an id_token. No at_hash in that case
    if(access_token){
      var h=crypto.createHash('sha256');
      var hashBuffer = h.update(access_token.token).digest();
      // take first 128 bits=16octets
      var at_hash = hashBuffer.slice(0,16);
      var at_hashB64Url = base64url(at_hash);
    }


    var iat = moment().unix();
    var id_token = {
      iss: appSettings.id_tokenIssuerIdentifier,
      sub: userID || null,
      aud: clientKey ||null,
      iat: iat,
      exp: iat+(3600*24*7)   // one week valid
    };

    if(access_token){
      id_token.at_hash = at_hashB64Url;
    }

    if (nonce) {
        id_token.nonce = nonce;
    }
    deferred.resolve({id_token:id_token,access_token:access_token});
    return deferred.promise;
}

function createAccessToken(userID, clientID, scope) {
    var deferred = Q.defer();
    var createToken = function() {
        var theToken = crypto.createHash('md5').update(Math.random()+'').digest('hex');
        models.AccessToken.findOne({token: theToken}).exec(function (err, accessToken){
          if (accessToken) {
              createToken()
          } else {
              saveAccessToken(theToken);
          }
        });
    };

    var saveAccessToken = function(token) {
        var accessToken = new models.AccessToken({
            token: token,
            _user: userID,
            _client: clientID,
            scope: scope,
            expiresIn: 3600*24*7,   // one week valid
            createdOn: new Date(),
        });

        accessToken.save(function (err, theAccessToken){
          if (err) {
              log('Error saving accessToken\. Error: ' + JSON.stringify(err));
              deferred.reject(err);
          } else {
              log('generated accesstoken :'+ JSON.stringify(theAccessToken));
              deferred.resolve(theAccessToken.toObject());
          }
        });
    }

    createToken();
    return deferred.promise;
}





module.exports = {
    createUserAccessCode:createUserAccessCode,
    createAccessToken:createAccessToken,
    createRefreshToken:createRefreshToken,
    createIdToken:createIdToken,
}
