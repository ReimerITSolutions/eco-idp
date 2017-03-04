var log = require('./log.js');
var errorHandle=require('./errorHandle.js');
var async = require('async');
var models=require('./models.js');
var validator = require('validator');
var url = require('url');
var https = require('https');
var appSettings = require('./appSettings.js');



function cleanSession(req,cleanUser){
    // deletes all session variables, EXCEPT user and client.
    // The IDP wants to remember the user, because of SSO convenience
    // IDP needs client in order to redirect back
    if(req.session){
      req.session.loginErrorMessage = '';
      req.session.AuthParams = null;
      req.session.flow = null;
      req.session.referrer =null;

      if(cleanUser){
            req.session.user = null;
      }
      req.session.save();
    }
}

function parseAuthorizationHeader(authorizationHeader) {

    if(!authorizationHeader)
        return null;

    var parts = authorizationHeader.split(' ');
    if(parts.length != 2 || parts[0] != 'Basic')
        return null;
    var creds = new Buffer(parts[1], 'base64').toString('utf8'),
    i = creds.indexOf(':');
    if(i == -1)
        return null;
    var username = creds.slice(0, i);
    password = creds.slice(i + 1);
    return[username, password];
}

function getHeadersBearerToken(req) {
    if (!req.headers.authorization)
        return false;
    var parts = req.headers.authorization.split(' ');
    if(parts.length != 2 || parts[0] != 'Bearer')
        return false;
    return parts[1];
}

function createFormFields(req){
  var result = req.body || {};

  result.get=function(fieldName){
    if(result[fieldName]){
        return result[fieldName];
    } else return '';
  };


  result.selected = function(value,fieldName){
    if(result[fieldName]){
        if(result[fieldName]==value){
            return 'selected';
        };
    }
    return '';
  }

  result.checked = function(fieldName){
    if(result[fieldName]){
        return 'checked';
    }
    return '';
  }

  result.multiselected = function(value,fieldName){
    if(result[fieldName]){
      var values=result[fieldName].split(',');
      if(values.indexOf(value)>=0){
            return 'selected';
      }
    }
  }

  return result;
}

function checkAuth(req, res, next){
    log('Enter checkAuth middleware: headers:'+JSON.stringify(req.headers),true);
    var bearerToken = getHeadersBearerToken(req);
    // token opzoeken
    async.waterfall([
      function(callback) {
          models.AccessToken.findOne({token: bearerToken})
          .populate('_client _user')
          .exec(function (err, accessToken)
              {
                  if (err || !accessToken ||!accessToken._user || !accessToken._user._id || !accessToken._client || !accessToken._client._id) {
                      callback({});
                  } else {
                      callback(null, accessToken.toObject({virtuals : true}))
                  }
              }
          );
      },
      function (theAccessToken, callback) {
        // nog checken op TTL van het accesstoken
        callback(null, theAccessToken)
      }], function(err, theAccessToken) {
          if (err){
            var errorInfo = {
                    code:'401',
                    message:'Invalid accessToken'
                };
                res.status(401).json(errorInfo);
          } else {
            req.accessToken = theAccessToken;
            next();
          }
    });
}

function createAccessDeniedError(req){
        if(req.session.requestedLanguage==='es'){
            var error = new Error('Entrada cancelada por el usuario.');
        } else if(req.session.requestedLanguage==='fr'){
            var error = new Error('Connexion annulée par l’utilisateur.');
        } else if(req.session.requestedLanguage==='de'){
            var error = new Error('Anmeldung wurde von Ihnen abgebrochen.');
        } else if(req.session.requestedLanguage==='it'){
            var error = new Error('Accesso utente annullato.');
        } else if(req.session.requestedLanguage==='pt'){
            var error = new Error('Entrada cancelada pelo utilizador.');
        } else {
            var error = new Error('User cancelled login.');
        }
        error.idp_error= 'access_denied';
        return error;
}

function sanitizeNickname(nick){
    var result ='';
    try{
      nick=(nick||'');
      result=validator.trim(nick);
      result=result.replace(/\s/g, "_");
      result=result.replace(/[@]/g, "AT");
      result=result.replace(/[é,è,ë,ê]/g, "e");
      result=result.replace(/[É,È,Ë,Ê]/g, "E");
      result=result.replace(/[í,ì,î,ï]/g, "i");
      result=result.replace(/[Í,Ì,Î,Ï]/g, "I");
      result=result.replace(/[ò,ó,ô,õ,ö]/g, "o");
      result=result.replace(/[Ò,Ó,Ô,Õ,Ö]/g, "O");
      result=result.replace(/[á,à,â,ã,ä]/g, "a");
      result=result.replace(/[Á,À,Â,Ã,Ä]/g, "A");
      result=result.replace(/[ú,ù,û,ü]/g, "u");
      result=result.replace(/[Ú,Ù,Û,Ü]/g, "U");
      result=result.replace(/[ñ]/g, "n");
      result=result.replace(/[Ñ]/g, "N");
      result=validator.whitelist(result, 'a-zA-Z0-9-_.');
    } catch(e){
    }
    return result;
}

function extractUserFromEmailAddress(email){
 var result = '';
 try{
   email=email||'';
   result=email.substring(0,email.indexOf('@'));
   result = sanitizeNickname(result);
 } catch(e){}
 return result;
}

function sanitizeUniqueUserName(uniqueUserName){
    var result ='';
    try{
      nick=(uniqueUserName||'');
      result=validator.trim(uniqueUserName);
      result=result.replace(/\s/g, "_");
      result=result.replace(/[@]/g, "AT");
      result=result.replace(/[é,è,ë,ê]/g, "e");
      result=result.replace(/[É,È,Ë,Ê]/g, "E");
      result=result.replace(/[í,ì,î,ï]/g, "i");
      result=result.replace(/[Í,Ì,Î,Ï]/g, "I");
      result=result.replace(/[ò,ó,ô,õ,ö]/g, "o");
      result=result.replace(/[Ò,Ó,Ô,Õ,Ö]/g, "O");
      result=result.replace(/[á,à,â,ã,ä]/g, "a");
      result=result.replace(/[Á,À,Â,Ã,Ä]/g, "A");
      result=result.replace(/[ú,ù,û,ü]/g, "u");
      result=result.replace(/[Ú,Ù,Û,Ü]/g, "U");
      result=result.replace(/[ñ]/g, "n");
      result=result.replace(/[Ñ]/g, "N");
      result=result.replace(/\.(\.)+/g, ".");  // not more dots after another
      result=validator.whitelist(result, 'a-zA-Z0-9.');
    } catch(e){
    }
    return result;
}


function logLastLoggedIn(userId, clientId) {
    // update user.lastLoggedIn with current timestamp
    try {
      log('update user.lastLoggedIn....');
      models.EcoUser.findOne({_id:userId}).exec(function(err, theUser){
          if(theUser){
              theUser.lastLoggedIn=new Date();
              theUser.save();

              var UserLoggedInHistory  = new models.UserLoggedInHistory();
              UserLoggedInHistory._user = theUser._id;
              UserLoggedInHistory.loggedIn = theUser.lastLoggedIn;
              UserLoggedInHistory._client =  clientId;
              UserLoggedInHistory.save();
          }
      });
    } catch (e) {}
}


function getValidLanguage(languageString){
  var lang=languageString.toLowerCase().split(' ');
  var result='en';
  for(var i=lang.length-1;i>=0;i--){
      var l=lang[i];
      l=l.replace('-','_');
      var u=l.indexOf('_');
      if(u>=0){
          l=l.substr(0,u);
      }
      if(l==='en' || l==='fr' || l==='es' || l==='de' || l==='it' || l==='pt'){
        result=l;
      }
  }
  return result;
}


function sendxApiStatement(params){
    if(appSettings.sendXapiStatements){
      var o= {
          actor: params.actor,
          verb: params.verb,
          object: params.object
      }

      // context is optional
      if (params.context) {
          o.context=params.context;
      }
      var postData=JSON.stringify(o);

      var urlObject=url.parse(appSettings.EcoBackendEndPoint + '/xapiidp');
      var options = {
        host: urlObject.hostname,
        path: urlObject.path,
        method: 'POST',
        headers: {
            'User-Agent' : 'NodeJS Client',
            'Accept': '*/*',
            'Content-Type':'application/json',
            'Cache-Control': 'no-cache'
        }
      };

      // fire and forget.....
      if(urlObject.protocol=='https:'){
          var req = https.request(options, function(res) {
          });
          req.end(postData, 'utf8');

          req.on('error', function(e) {
          });
      }
    }
}

function updateUserCourseProgress(ecoUserId){
      var urlObject=url.parse(appSettings.EcoBackendEndPoint + '/updatecourseprogress/' + ecoUserId);
      var options = {
        host: urlObject.hostname,
        path: urlObject.path,
        method: 'POST',
        headers: {
            'User-Agent' : 'NodeJS Client',
            'Accept': '*/*',
            'Content-Type':'application/json',
            'Cache-Control': 'no-cache'
        }
      };

      // fire and forget.....
      if(urlObject.protocol=='https:'){
          var req = https.request(options, function(res) {
          });
          req.end('', 'utf8');

          req.on('error', function(e) {
          });
      }
}


function createCanonicalEmail(email){
    email = email + ' ';
    return email.toLowerCase().trim();
}

module.exports = {
    cleanSession:cleanSession,
    parseAuthorizationHeader:parseAuthorizationHeader,
    getHeadersBearerToken:getHeadersBearerToken,
    createFormFields:createFormFields,
    checkAuth:checkAuth,
    createAccessDeniedError:createAccessDeniedError,
    sanitizeNickname:sanitizeNickname,
    extractUserFromEmailAddress:extractUserFromEmailAddress,
    logLastLoggedIn:logLastLoggedIn,
    getValidLanguage:getValidLanguage,
    sendxApiStatement:sendxApiStatement,
    createCanonicalEmail:createCanonicalEmail,
    updateUserCourseProgress:updateUserCourseProgress,
    sanitizeUniqueUserName:sanitizeUniqueUserName,
}


