var log = require('../log.js');
var validator = require('validator');
var models=require('../models.js');
var moment = require('moment');
var crypto = require('crypto');
var async = require('async');

var appSettings = require('../appSettings.js');
var mail=require('../sendMail.js');


module.exports = function(app){
  app.get('/notactivated', function(req, res, next){
    log('get /notactivated');

    if(req.session && (req.session.referrer ==='login')){
      req.session.referrer ='notactivated';

      if(!req.session.requestedLanguage){
        req.session.requestedLanguage='en';
      }

      res.render(req.session.requestedLanguage +'/notactivated.ejs');
    } else {
        // serve no content if this url is not redirected from login page
        var error = new Error();
        error.status = 404;
        return next(error);
    }
  });


  app.post('/notactivated', function(req, res, next){
      log('/post notactivated body: '  + JSON.stringify(req.body));

      if(!req.session || req.session.referrer !=='notactivated'){
          var error = new Error();
          error.status = 404;
          return next(error);
      }

      if(req.body.login){
        res.redirect('/login');
      } else if(req.body.resend){
        // delete old confirmations
        models.RegisterConfirmation.remove({
            _user: req.session.user._id
        }, function(err){
            if(err){
              var error = new Error();
              return next(error);
            } else {
                // create new confirmation
                var loginUrl= appSettings.defaultRegistrationLoginUrl;
                if(req.session.client && req.session.client.afterRegisterUrl && req.session.client.afterRegisterUrl !== ""){
                    loginUrl=req.session.client.afterRegisterUrl;
                }

                var initiator = "";
                if(req.session.client && req.session.client.public_AppName && req.session.client.public_AppName !== ""){
                    initiator=req.session.client.public_AppName;
                }


                var confirmation = new models.RegisterConfirmation({
                  _user: req.session.user._id,
                  language: req.session.requestedLanguage,
                  createdOn: new Date(),
                  confirmedOn: null,
                  loginUrl: loginUrl,
                  initiator: initiator
                });

                confirmation.save(function (err, theConfirmation){
                  if(err){
                        var error = new Error();
                        return next(error);
                  } else {
                        // send mail
                        if(req.session.requestedLanguage==='es'){
                          var textMessage = "¡Bienvenido a ECO! \n\nVd. acaba de solicitar un nuevo link de activación para su cuenta en ECO.\n\n\nActive su cuenta aquí: " + appSettings.accountActivationUrl + "?id=" + theConfirmation._id.toString() +"\n\n\n\nQue tenga un buen día,\n\nEl equipo de ECO";
                          var subject= '¡Bienvenido a ECO!';
                        } else if(req.session.requestedLanguage==='fr'){
                        var textMessage = "Bienvenue dans ECO! \n\nVous venez de recevoir un nouveau lien d’activation pour votre compte ECO.\n\n\nActivez votre compte ici : " + appSettings.accountActivationUrl + "?id=" + theConfirmation._id.toString() +"\n\n\n\nBonne journée,\n\nL’équipe ECO";
                        var subject= 'Bienvenue dans ECO';
                        } else if(req.session.requestedLanguage==='de'){
                        var textMessage = "Willkommen auf ECO! \n\nSie haben soeben einen neuen Aktivierungslink für Ihr ECO-Konto angefordert.\n\n\nAktivieren Sie hier Ihr Konto: " + appSettings.accountActivationUrl + "?id=" + theConfirmation._id.toString() +"\n\n\n\nMit freundlichen Grüßen,\n\nIhr ECO-Team";
                        var subject= 'Willkommen auf ECO!';
                        } else if(req.session.requestedLanguage==='it'){
                        var textMessage = "Benvenuto in ECO! \n\nHai richiesto un nuovo link di attivazione della tua utenza ECO.\n\n\nAttiva la tua utenza qui: " + appSettings.accountActivationUrl + "?id=" + theConfirmation._id.toString() +"\n\n\n\nTi auguriamo una buona giornata,\n\nIl team ECO";
                        var subject= 'Benvenuto in ECO!';
                        } else if(req.session.requestedLanguage==='pt'){
                        var textMessage = "Bem vindo ao ECO! \n\nAcabou de requerer um novo link de ativação na sua conta do ECO.\n\n\nAtive a sua conta aqui: " + appSettings.accountActivationUrl + "?id=" + theConfirmation._id.toString() +"\n\n\n\nTenha um bom dia,\n\nA equipa do ECO ";
                        var subject= 'Bem vindo ao ECO!';
                        } else {
                          var textMessage = "Welcome on ECO! \n\nYou just requested a new activation link for your ECO account.\n\n\nActivate your account here: " + appSettings.accountActivationUrl + "?id=" + theConfirmation._id.toString() +"\n\n\n\nHave a nice day,\n\nThe ECO team";
                          var subject= 'Welcome on ECO!';
                        }

                        mail.sendSingleTextMail(appSettings.idpMailFrom, req.session.user.email, subject, textMessage);
                        res.redirect('/login');

                  }
                });
            }

        });
      }
  });



}