var log = require('../log.js');
var validator = require('validator');
var models=require('../models.js');
var moment = require('moment');
var crypto = require('crypto');
var async = require('async');
var utils=require('../utils.js');


module.exports = function(app){
  app.get('/changepw', function(req, res, next){
    log('get /changepw');

    if(req.session && (req.session.referrer ==='login' || req.session.referrer ==='authorize')){
      req.session.referrer ='changepw';
      if(!req.session.requestedLanguage){
        req.session.requestedLanguage='en';
      }
      res.render(req.session.requestedLanguage +'/changepw.ejs',{errors: new Array()});
    } else {
        // serve no content if this url is not redirected from login page
        var error = new Error();
        error.status = 404;
        return next(error);
    }
  });


  app.post('/changepw', function(req, res, next){
      log('/post changepw body: '  + JSON.stringify(req.body));

      if(!req.session || req.session.referrer !=='changepw'){
          var error = new Error();
          error.status = 404;
          return next(error);
      }

      var formErrors=new Array();

      if(req.body.cancel && req.body.cancel=="cancel"){
        error = utils.createAccessDeniedError(req);
        req.session.referrer=null;
        req.session.save();
        return next(error);
      }

      if(!req.body.change || req.body.change !=="change"){
        error = utils.createAccessDeniedError(req);
        req.session.referrer=null;
        req.session.save();
        return next(error);
      }

      req.body.email = validator.escape(req.body.email);
      req.body.oldpassword = validator.escape(req.body.oldpassword);
      req.body.newpassword = validator.escape(req.body.newpassword);
      var pwError=false;
      if(req.body.newpassword.length < 8){
          pwError=true;
      }
      if(!req.body.newpassword.match(/\d/ig)){
          pwError=true;
      }
      if(!req.body.newpassword.match(/[A-Z]/g)){
          pwError=true;
      }

      if(pwError){
          if(req.session.requestedLanguage==='es'){
            formErrors.push('La nueva contraseña no cumple los criterios');
          } else if(req.session.requestedLanguage==='fr'){
              formErrors.push('Le nouveau mot de passe ne remplit pas les critères exigés');
          } else if(req.session.requestedLanguage==='de'){
              formErrors.push('Ihr neues Kennwort erfüllt die entsprechende Kriterien nicht.');
          } else if(req.session.requestedLanguage==='it'){
              formErrors.push('La nuova password nonrispetta i criteri');
          } else if(req.session.requestedLanguage==='pt'){
            formErrors.push('a nova  palavra-passe  nao cumpre os criterios');
          } else {
            formErrors.push('New password does not meet criteria');
          }
      }

      req.body.newpassword2 = validator.escape(req.body.newpassword2);
      if(req.body.newpassword !== req.body.newpassword2){
          if(req.session.requestedLanguage==='es'){
            formErrors.push('La verificación de la nueva contraseña falló');
          } else if(req.session.requestedLanguage==='fr'){
              formErrors.push('La vérification du nouveau mot de passe a échoué');
          } else if(req.session.requestedLanguage==='de'){
              formErrors.push('Die Doppelprüfung auf das Kennwort ist gescheitert');
          } else if(req.session.requestedLanguage==='it'){
              formErrors.push('Il doppio controllo sulla nuova password è fallito');
          } else if(req.session.requestedLanguage==='pt'){
            formErrors.push('A confirmação da palavra-passe está incorreta');
          } else {
            formErrors.push('Doublecheck on new password failed');
          }
      }
      if(req.body.newpassword === req.body.email){
          if(req.session.requestedLanguage==='es'){
            formErrors.push('La contraseña no puede ser la misma que el email');
          } else if(req.session.requestedLanguage==='fr'){
              formErrors.push('Le mot de passe ne peut pas être le même que l’adresse de messagerie');
          } else if(req.session.requestedLanguage==='de'){
              formErrors.push('Das Kennwort darf nicht gleich Ihrer zugehörigen E-mail Adresse sein');
          } else if(req.session.requestedLanguage==='it'){
              formErrors.push('La password non può essere uguale alla email');
          } else if(req.session.requestedLanguage==='pt'){
            formErrors.push('A palavra-passe não pode ser igual ao e-mail');
          } else {
            formErrors.push('Password cannot be the same as email');
          }
      }

      // emailadress must match old password
      var sha256 = crypto.createHash('sha256');
      sha256.update(req.body.oldpassword);

      models.EcoUser.findOne({email: req.body.email, tempPassword:sha256.digest('hex')}).exec(function (err, theUser) {
        if(err || !theUser) {
          if(req.session.requestedLanguage==='es'){
            formErrors.push('La contraseña antigua no pertenece a esa dirección email');
          } else if(req.session.requestedLanguage==='fr'){
              formErrors.push(' L’ancien mot de passe ne correspond pas à l’adresse mail');
          } else if(req.session.requestedLanguage==='de'){
              formErrors.push('Ihre E-mail Adresse und Ihr altes Kennwort passen nicht zusammen');
          } else if(req.session.requestedLanguage==='it'){
              formErrors.push('La vecchia password non appartiene a questo indirizzo email');
          } else if(req.session.requestedLanguage==='pt'){
            formErrors.push('a antiga  palavra-passe  nao pertence a este endereço de e-mail');
          } else {
            formErrors.push('Old password does not belong to this email address');
          }
        }

        if(formErrors.length>0){
          log('/post register errors in changepwform');
              res.render(req.session.requestedLanguage +'/changepw.ejs',{errors:formErrors});
        } else {
            // update user
            var sha256 = crypto.createHash('sha256');
            sha256.update(req.body.newpassword);
            theUser.password= sha256.digest('hex');
            theUser.loggedIn= true;
            theUser.lastLoggedIn = moment().unix();
            theUser.tempPassword = null;
            theUser.save(function (err, theUser){
              if (err) {
                  log('Error saving user. Error: ' + JSON.stringify(err));
                  error = new Error('Error saving userdata.');
                  req.session.referrer=null;
                  return next(err);
              } else {
                req.session.user = theUser.toObject();
                req.session.save();
                res.redirect('/consent');
              }
            });
        }
      });

  });



}