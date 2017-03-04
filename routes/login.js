var async = require('async');
var crypto = require('crypto');
var moment = require('moment');

var log = require('../log.js');
var errorHandle=require('../errorHandle.js');
var models=require('../models.js');
var utils=require('../utils.js');
var appSettings = require('../appSettings.js');

module.exports = function(app){
  app.get('/login', function(req, res, next){
    log('/get login');
    log('/get login referrer: ' +req.session.referrer);

    if(req.session && (req.session.referrer ==='authorize' || req.session.referrer ==='temppwsent' || req.session.referrer ==='reg' || req.session.referrer ==='forgotpw' || req.session.referrer ==='notactivated' || req.session.referrer ==='login' ) ){
        req.session.referrer ='login';
        req.session.save();

        // determine the url parameters for the registration url
        var cancelUrl= encodeURIComponent(appSettings.defaultRegistrationCancelUrl);
        if(req.session.client && req.session.client.defaultClientUrl && req.session.client.defaultClientUrl !== ""){
            cancelUrl=encodeURIComponent(req.session.client.defaultClientUrl);
        }

        var loginUrl= encodeURIComponent(appSettings.defaultRegistrationLoginUrl);
        if(req.session.client && req.session.client.afterRegisterUrl && req.session.client.afterRegisterUrl !== ""){
            loginUrl=encodeURIComponent(req.session.client.afterRegisterUrl);
        }

        var initiator = "";
        if(req.session.client && req.session.client.public_AppName && req.session.client.public_AppName !== ""){
            initiator=encodeURIComponent(req.session.client.public_AppName);
        }

        res.render(req.session.requestedLanguage +'/login.ejs', {
          loginErrorMessage: '',
          registerUrl: './register?lang='+req.session.requestedLanguage+'&cancelurl='+cancelUrl+'&loginurl='+loginUrl+'&initiator='+initiator
        });
    } else {
      error = utils.createAccessDeniedError(req);
      req.session.referrer=null;
      req.session.save();
      return next(error);
    }

  });


  app.post('/login', function(req, res, next){
    log('/post login: ' + JSON.stringify(req.body));

    if(req.body.cancel) {
        error = utils.createAccessDeniedError(req);
        req.session.referrer=null;
        req.session.save();
        return next(error);
    }

    if(!req.session || !req.session.referrer || req.session.referrer !=='login'){
        error = utils.createAccessDeniedError(req);
        error.idp_error= 'access_denied';
        req.session.referrer=null;
        req.session.save();
        return next(error);
    }


    if(req.body.languageButton==="en"){
        req.session.requestedLanguage='en';
        req.session.save();
        res.redirect('/login');
        log('post /login: Language set: en');
        return;
    } else if(req.body.languageButton==="de"){
        req.session.requestedLanguage='de';
        req.session.save();
        res.redirect('/login');
        log('post /login: Language set: de');
        return;
    } else if(req.body.languageButton==="fr"){
        req.session.requestedLanguage='fr';
        req.session.save();
        res.redirect('/login');
        log('post /login: Language set: fr');
        return;
    } else if(req.body.languageButton==="es"){
        req.session.requestedLanguage='es';
        req.session.save();
        res.redirect('/login');
        log('post /login: Language set: es');
        return;
    } else if(req.body.languageButton==="it"){
        req.session.requestedLanguage='it';
        req.session.save();
        res.redirect('/login');
        log('post /login: Language set: it');
        return;
    } else if(req.body.languageButton==="pt"){
        req.session.requestedLanguage='pt';
        req.session.save();
        res.redirect('/login');
        log('post /login: Language set: pt');
        return;
    }

    if(!req.session.requestedLanguage){
        req.session.requestedLanguage='en';
        req.session.save();
    }

    if(req.body.login){
      async.waterfall([
            function(callback) {
                log('post /login: processing login. flow: ' + req.session.flow);
                models.EcoUser.findOne({email: req.body.email}).exec(function (err, user){
                  if(err){
                      err.idp_error=true; // just a flag to indicate that the callback should return a server error to the client
                      callback(err);
                  } else if(user) {
                      req.session.user = user.toObject();
                      req.session.save();

                      if(user.confirmed){
                        var sha256 = crypto.createHash('sha256');
                        sha256.update(req.body.password);
                        var digest=sha256.digest('hex');
                        if (digest === user.password) {
                          log('post /login: user found!');
                          callback(null,user);
                        } else if (digest === user.tempPassword) {
                          var error=new Error();
                          error.changePw=true; // just a flag to indicate that a different redirect should take place
                          log('post /login: user found, using temp password! Redirect to change pw');
                          callback(error);
                        }
                        else {
                          log('post /login: Invalid login attempt');
                          if(req.session.requestedLanguage==='es'){
                            callback(new Error('Nombre de usuario o contraseña incorrectos'),null);
                          } else if(req.session.requestedLanguage==='fr'){
                            callback(new Error('Nom d’utilisateur ou mot de passe incorrect'),null);
                          } else if(req.session.requestedLanguage==='de'){
                            callback(new Error('Benutzer und / oder Kennwort nicht bekannt'),null);
                          } else if(req.session.requestedLanguage==='it'){
                            callback(new Error('Nome utente o password scorretti'),null);
                          } else if(req.session.requestedLanguage==='pt'){
                            callback(new Error('nome de utilizador e senha incorretos'),null);
                          } else {
                            callback(new Error('Username or Password incorrect'),null);
                          }
                        }
                      } else {
                          var error=new Error();
                          error.notActivatedYet=true; // just a flag to indicate that a different redirect should take place
                          log('post /login: user found, but not activated yet! Redirect to notactivated');
                          callback(error);
                      }
                  } else {
                      if(req.session.requestedLanguage==='es'){
                        callback(new Error('Nombre de usuario o contraseña incorrectos'),null);
                      } else if(req.session.requestedLanguage==='fr'){
                        callback(new Error('Nom d’utilisateur ou mot de passe incorrect'),null);
                      } else if(req.session.requestedLanguage==='de'){
                        callback(new Error('Benutzer und / oder Kennwort nicht bekannt'),null);
                      } else if(req.session.requestedLanguage==='it'){
                        callback(new Error('Nome utente o password scorretti'),null);
                      } else if(req.session.requestedLanguage==='pt'){
                        callback(new Error('nome de utilizador e senha incorretos'),null);
                      } else {
                        callback(new Error('Username or Password incorrect'),null);
                      }
                  }
              });
            },
            function(user,callback) {
              user.loggedIn = true;
              user.lastLoggedIn = moment().unix();
              user.stayLoggedIn = true; //(req.body.rememberme? true: false);
              user.tempPassword = null;  // if user requested new pw, but logs in using his old pw, the temp pw is deleted.
              log('post /login: update user...');
              user.save(function (err, user){
                if (err) {
                    log('post /login: Error saving usermetadata in /login. Error: ' + JSON.stringify(err));
                    err.idp_error=true; // just a flag to indicate that the callback should return a server error to the client
                    callback(err,null);
                } else {
                  callback(null, user);
                }
              });
            },
            function(user, callback) {
              req.session.user = user.toObject();
              req.session.save(function (err, session){
                if (err) {
                  log('post /login: Error saving sessiondata in /login. Error: ' + JSON.stringify(err));
                  err.idp_error=true; // just a flag to indicate that the callback should return a server error to the client
                  callback(err);
                } else {
                  callback(null);
                }
              });
            }],function(err) {
              if (err) {
                  if(err.idp_error){
                      req.session.save();
                      return next(new Error()); // internal error goes back to client
                  } else if(err.changePw){
                    // set referrer, so get changepw will accept the submit
                    req.session.referrer ='login';
                    req.session.save();
                    res.redirect('/changepw');
                  } else if(err.notActivatedYet){
                    // set referrer, so get notactivated will accept the submit
                    req.session.referrer ='login';
                    req.session.save();
                    res.redirect('/notactivated');
                  }
                  else {
                    // regular error message: errors in form
                    req.session.loginErrorMessage = err.message;
                    req.session.user = null;
                    req.session.save();
                    res.render(req.session.requestedLanguage +'/login.ejs', {
                      loginErrorMessage: req.session.loginErrorMessage||'',
                      registerUrl: './reg'
                    });
                  }
              } else {
                  // set referrer, so get consent will accept the submit
                  req.session.referrer ='login';
                  req.session.save();
                  res.redirect('/consent');
              }
            }
        );   // end waterfall
    }
  });


}