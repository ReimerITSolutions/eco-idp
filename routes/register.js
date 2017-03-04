var utils=require('../utils.js');
var validator = require('validator');
var log = require('../log.js');
var models=require('../models.js');
var appSettings = require('../appSettings.js');
var crypto = require('crypto');
var async = require('async');
var mail=require('../sendMail.js');
var utils=require('../utils.js');


module.exports = function(app){
  app.get('/register', function(req, res, next){
    log('/get register');

    // store session parameters regarding registration in a separate object so they wont interfere
    // with normal idp session vars (and can give unpredictable errors when multiple browsertabs are open)
    req.session.reg = {};

    // 3 url parameters:
    // -lang
    // -cancelurl: defaults to portal
    // the below link and name will be used in the activation email:
    // -loginurl:: defaults to portal login
    // -initiator: defaults to EcoPortal

    // set language
    req.session.reg.requestedLanguage='en';
    if(req.query.lang){
        log('/get register: requested language: ' + req.query.lang);
        req.session.reg.requestedLanguage=utils.getValidLanguage(req.query.lang);
    }

    //set cancelUrl
    req.session.reg.cancelUrl = appSettings.defaultRegistrationCancelUrl;
    if(req.query.cancelurl && validator.isURL(req.query.cancelurl,{require_protocol:true})){
        req.session.reg.cancelUrl = req.query.cancelurl
    }

    //set loginUrl
    req.session.reg.loginUrl = appSettings.defaultRegistrationLoginUrl;
    if(req.query.loginurl && validator.isURL(req.query.loginurl,{require_protocol:true})){
        req.session.reg.loginUrl = req.query.loginurl
    }

    //set initiator
    req.session.reg.initiator = appSettings.defaultRegistrationInitiator;
    if(req.query.initiator && validator.isAlphanumeric(req.query.initiator) ){
        req.session.reg.initiator = req.query.initiator
    }

    req.session.reg.referrer='registerstart';
    res.render(req.session.reg.requestedLanguage+'/reg.ejs',{errors:[], formfields: utils.createFormFields(req)});

    // send xapistatement regarding user starting registration
    log('post /token: send xapistatement');
    try {
        utils.sendxApiStatement({
          actor: "unknown",
          verb: "http://activitystrea.ms/schema/1.0/starts",
          object: {
              id:"https://idp.ecolearning.eu/register"
          },
        });
    } catch (e) {
      log('post /token: error in sending xapistatement',true);
    }

  });






   app.post('/register', function(req, res, next){
      log('/post register body: '  + JSON.stringify(req.body));

      if(!req.session.reg || !req.session.reg.referrer || (req.session.reg.referrer!=='registerstart' && req.session.reg.referrer!=='registerpost')){
          res.redirect('/register');  // start over....
          return;
      }
      if(req.body.cancel && req.body.cancel=="cancel"){
          // BYE bye!
          res.redirect(req.session.reg.cancelUrl);
          req.session.reg = {};
          req.session.save();
          return;
      }
      if(!req.body.register || req.body.register !=="register"){
          // at this point, the ony button that the user could have been pressed, is 'Register'
          res.redirect('/register');  // start over....
          return;
      }

      req.session.reg.referrer='registerpost';
      if(!req.session.reg.requestedLanguage){
            req.session.reg.requestedLanguage='en';
      }


      var formErrors=new Array();

      req.body.email = validator.escape(req.body.email);
      if(!validator.isEmail(req.body.email)){
          if(req.session.reg.requestedLanguage==='es'){
            formErrors.push('Dirección email no válida');
          } else if(req.session.reg.requestedLanguage==='fr'){
              formErrors.push('Adresse de messagerie invalide');
          } else if(req.session.reg.requestedLanguage==='de'){
              formErrors.push('Diese E-mail Adresse ist nicht gültig');
          } else if(req.session.reg.requestedLanguage==='it'){
              formErrors.push('Indirizzo email non valido');
          } else if(req.session.reg.requestedLanguage==='pt'){
            formErrors.push('Endereço de e-mail inválido');
          } else {
            formErrors.push('Invalid email address');
          }
      }

      req.body.password = validator.escape(req.body.password);
      var pwError=false;
      if(req.body.password.length < 8){
          pwError=true;
      }
      if(!req.body.password.match(/\d/ig)){
          pwError=true;
      }
      if(!req.body.password.match(/[A-Z]/g)){
          pwError=true;
      }

      if(pwError){
          if(req.session.reg.requestedLanguage==='es'){
            formErrors.push('La contraseña no cumple los criterios');
          } else if(req.session.reg.requestedLanguage==='fr'){
              formErrors.push('Le mot de passe ne répond pas aux critères demandés');
          } else if(req.session.reg.requestedLanguage==='de'){
              formErrors.push('Das angegebene Kennwort erfüllt nicht die Mindestanforderungen');
          } else if(req.session.reg.requestedLanguage==='it'){
              formErrors.push('La password non rispetta i criteri');
          } else if(req.session.reg.requestedLanguage==='pt'){
            formErrors.push('A palavra-passe não cumpre os critérios');
          } else {
            formErrors.push('Password does not meet criteria');
          }

      }
      req.body.password2 = validator.escape(req.body.password2);
      if(req.body.password !== req.body.password2){
          if(req.session.reg.requestedLanguage==='es'){
            formErrors.push('La confirmación de la contraseña es erronea');
          } else if(req.session.reg.requestedLanguage==='fr'){
              formErrors.push('La confirmation du mot de passe est erronée');
          } else if(req.session.reg.requestedLanguage==='de'){
              formErrors.push('Die Doppelprüfung auf das Kennwort ist gescheitert');
          } else if(req.session.reg.requestedLanguage==='it'){
              formErrors.push('Doppio controllo sulla password fallito');
          } else if(req.session.reg.requestedLanguage==='pt'){
            formErrors.push('A confirmação da palavra-passe está incorreta');
          } else {
            formErrors.push('Doublecheck on password failed');
          }
      }

      if(req.body.password === req.body.email){
          if(req.session.reg.requestedLanguage==='es'){
            formErrors.push('La contraseña no puede ser la misma que el email');
          } else if(req.session.reg.requestedLanguage==='fr'){
              formErrors.push('Le mot de passe ne peut pas être le même que l’adresse de messagerie');
          } else if(req.session.reg.requestedLanguage==='de'){
              formErrors.push('Das Kennwort darf nicht gleich Ihrer zugehörigen E-mail Adresse sein');
          } else if(req.session.reg.requestedLanguage==='it'){
              formErrors.push('La password non può essere uguale alla email');
          } else if(req.session.reg.requestedLanguage==='pt'){
            formErrors.push('A palavra-passe não pode ser igual ao e-mail');
          } else {
            formErrors.push('Password cannot be the same as email');
          }
      }

      if(!req.body.accept ){
          if(req.session.reg.requestedLanguage==='es'){
            formErrors.push('Las condiciones de servicio deben ser aceptadas');
          } else if(req.session.reg.requestedLanguage==='fr'){
              formErrors.push('Les conditions d’utilisation doivent être acceptées');
          } else if(req.session.reg.requestedLanguage==='de'){
              formErrors.push('Bitte akzeptieren Sie die Nutzungsbedingungen');
          } else if(req.session.reg.requestedLanguage==='it'){
              formErrors.push('I termini di servizio devono essere accettati');
          } else if(req.session.reg.requestedLanguage==='pt'){
            formErrors.push('Os termos do serviço têm que ser aceites');
          } else {
            formErrors.push('Term of service must be accepted');
          }
      }

      req.body.nickname = utils.sanitizeNickname(req.body.nickname);

      // email cannot be in use
      models.EcoUser.findOne({emailcanonical: utils.createCanonicalEmail(req.body.email)}).exec(function (err, user) {
          if(err || user) {
            if(req.session.reg.requestedLanguage==='es'){
              formErrors.push('La dirección email ya está siendo usada');
            } else if(req.session.reg.requestedLanguage==='fr'){
                formErrors.push('Cette adresse de messagerie est déjà utilisée');
            } else if(req.session.reg.requestedLanguage==='de'){
                formErrors.push('Diese E-mail Adresse wurde schon benutzt bei ECO');
            } else if(req.session.reg.requestedLanguage==='it'){
                formErrors.push('L’indirizzo email è già utilizzato');
            } else if(req.session.reg.requestedLanguage==='pt'){
              formErrors.push('O endereço do e-mail já está sendo usado');
            } else {
              formErrors.push('The emailaddress is already in use');
            }
          }

          if(formErrors.length>0){
            log('/post reg errors in registerform');
                res.render(req.session.reg.requestedLanguage +'/reg.ejs',{errors:formErrors, formfields: utils.createFormFields(req)});
          } else {
              async.waterfall([
                  function(callback) {
                    // save user
                    var sha256 = crypto.createHash('sha256');
                    sha256.update(req.body.password);

                    var user = new models.EcoUser({
                      nickname: (req.body.nickname !==''?req.body.nickname:''),
                      email: req.body.email,
                      email_verified: false,
                      password: sha256.digest('hex'),
                      lastLoggedIn: null,
                      loggedIn: false,
                      stayLoggedIn: true,
                      confirmed:false,
                      language:req.session.reg.requestedLanguage,
                      registeredOn:new Date(),
                      emailcanonical:utils.createCanonicalEmail(req.body.email)
                    });

                    var uniqueUserName= ((!user.nickname||user.nickname=='')? utils.extractUserFromEmailAddress(user.email): user.nickname);
                    uniqueUserName = utils.sanitizeUniqueUserName(uniqueUserName);
                    models.Sequence.genId('users',function(err, sequence){
                       if(err){
                            log('Error saving user. Error: ' + JSON.stringify(err));
                            error = new Error('Error creating sequence.');
                            callback(error,null);
                       } else {
                        uniqueUserName+=sequence;
                        user.uniqueUserName =uniqueUserName;
                        user.save(function (err, theUser){
                          if (err) {
                              log('Error saving user. Error: ' + JSON.stringify(err));
                              error = new Error('Error saving userdata.');
                              callback(error,null);
                          } else {
                            callback(null,theUser.toObject());
                          }
                        });
                       }
                    });
                  },
                  function(user,callback) {
                    var confirmation = new models.RegisterConfirmation({
                      _user: user._id,
                      language: req.session.reg.requestedLanguage,
                      createdOn: new Date(),
                      confirmedOn: null,
                      loginUrl: req.session.reg.loginUrl,
                      initiator: req.session.reg.initiator
                    });

                    confirmation.save(function (err, theConfirmation){
                        if (err) {
                            log('Error saving registerconfirmation. Error: ' + JSON.stringify(err));
                            error = new Error('Error saving userdata.');
                            callback(error,null);
                        } else {
                          callback(null,user,theConfirmation.toObject());
                        }
                    });
                  }], function (err,user,confirmation, callback) {
                        if (err){
                            req.session.reg = {};
                            req.session.save();
                            return next(err);
                        }

                        // send confirmation email
                        if(req.session.reg.requestedLanguage==='es'){
                          var textMessage = "¡Bienvenido a ECO! \n\nVd. acaba de crear una cuenta en ECO.\nPara confirmar que es realmente Vd., por favor active su cuenta haciendo click sobre enlace siguiente.\n\nSi Vd. no creó ninguna cuenta y no tiene idea de lo que es ECO, alguien debió entrar en su cuenta email o cometió un error. En ese caso le pedimos perdón por los inconvenientes y le rogamos que ignore este mensaje.\n\nPuede activar su cuenta aquí: " + appSettings.accountActivationUrl + "?id=" + confirmation._id.toString() +"\n\n\n\nQue tenga un buen día.\n\nEl equipo ECO.";
                          var subject= '¡Bienvenido a ECO! ';
                        } else if(req.session.reg.requestedLanguage==='fr'){
                          var textMessage = "Bienvenue dans ECO ! \n\nVous venez de créer votre compte sur ECO.\nAfin de confirmer votre inscription, merci d’activer votre compte en cliquant sur le lien suivant.\n\nSi vous n’avez pas créé de compte ECO et n’avez pas connaissance du projet ECO, merci d’ignorer ce message et de l’effacer. Nous vous prions d’accepter nos excuses pour les désagréments engendrés.\n\nActivez votre compte ici: " + appSettings.accountActivationUrl + "?id=" + confirmation._id.toString() +"\n\n\n\nNous vous souhaitons une bonne journée.\n\nL’équipe ECO";
                          var subject= 'Bienvenue dans ECO !';
                        } else if(req.session.reg.requestedLanguage==='de'){
                          var textMessage = "Wilkommen auf ECO!\n\nSie haben gerade ein Konto auf ECO erstellt. \nBitte bestätigen Sie das Konto und klicken Sie bitte auf folgenden Link.\n\nWenn Sie nicht dieses ECO-Konto erstellt haben, und auch keinen Bezug zum ECO-Learning Projekt haben, ignorieren und löschen Sie bitte diese E-Mail. Wir entschuldigen uns für die aufgetretenen Unannehmlichkeiten.\n\nAktivieren Sie Ihren Account hier: " + appSettings.accountActivationUrl + "?id=" + confirmation._id.toString() +"\n\n\n\nMit freundlichen Grüßen,\n\nIhr ECO-Team";
                          var subject= 'Willkommen auf ECO! ';
                        } else if(req.session.reg.requestedLanguage==='it'){
                          var textMessage = "Benvenuto in ECO! \n\nHai appena creato un’utenza su ECO.\nPer confermare che si tratta di te, per favore attiva la tua utenza cliccando sul link qui sotto.\n\nSe non hai creato un’utenza e non hai idea di cosa sia ECO, qualcuno potrebbe avere abusato del tuo indirizzo e-mail o fatto un errore di battitura. In questo caso ci scusiamo per l’inconveniente e ti chiediamo per favore di ignorare il messaggio.\n\nAttiva la tua utenza qui: " + appSettings.accountActivationUrl + "?id=" + confirmation._id.toString() +"\n\n\n\nTi auguriamo una buona giornata,\n\nIl team ECO";
                          var subject= 'Benvenuto in ECO! ';
                        } else if(req.session.reg.requestedLanguage==='pt'){
                          var textMessage = "Bem vindo ao ECO! \n\nAcabou de criar uma conta no ECO.\nPara confirmar e iniciar a sua conta, por favor carregue no link abaixo.\n\nSe não criou a sua conta no ECO e não tem conhecimento sobre o Projeto ECO, por favor ignore e apague este e-mail. Pedimos desculpas pelo incómodo.\n\nAtive a sua conta aqui : " + appSettings.accountActivationUrl + "?id=" + confirmation._id.toString() +"\n\n\n\nTenha um bom dia!\n\nA equipa do ECO";
                          var subject= 'Bem vindo ao ECO! ';
                        } else {
                          var textMessage = "Welcome on ECO! \n\nYou have just created an account on ECO.\nTo confirm and initiate your account, please click on link below.\n\nIf you have not created an ECO account and have no knowledge in reference to the ECO-learning project, please ignore and delete this email. We apologise for the inconvenience.\n\nActivate your account here: " + appSettings.accountActivationUrl + "?id=" + confirmation._id.toString() +"\n\n\n\nHave a nice day,\n\nThe ECO team";
                          var subject= 'Welcome on ECO! ';
                        }

                        mail.sendSingleTextMail(appSettings.idpMailFrom, user.email, subject, textMessage);
                        res.render(req.session.reg.requestedLanguage+'/regok.ejs',{email:user.email});

                        // Auto-Add total consent for EcoPortal PROD
                        var consent = new models.Consent({
                            _user: user._id,
                            _client: "53a5821c5ae078a98af6f127",
                            createdOn: new Date(),
                            scope: "openid profile email address eco"
                        });

                        consent.save(function (err, theConsent){
                          if (err) {
                              log('Error saving EcoPortal auto-consent. Error: ' + JSON.stringify(err),true);
                          }
                        });

                        // send xapistatement regarding user finishing registration
                        log('post /token: send xapistatement');
                        try {
                            utils.sendxApiStatement({
                              actor: user._id,
                              verb: "http://adlnet.gov/expapi/verbs/registered",
                              object: {
                                  id:"https://idp.ecolearning.eu/register"
                              },
                            });
                        } catch (e) {
                          log('post /token: error in sending xapistatement',true);
                        }


                        // we are done!
                        req.session.reg = {};
                        req.session.save();
              }); //end waterfall
          } // end if
      }); // end findone
});  // end app.post('/register'
}