var log = require('../log.js');
var models=require('../models.js');
var appSettings = require('../appSettings.js');
var utils=require('../utils.js');
var crypto = require('crypto');
//var nodemailer = require('nodemailer');
//var sendmailTransport = require('nodemailer-sendmail-transport');
var async = require('async');
var mail=require('../sendMail.js');


module.exports = function(app){
  app.get('/forgotpw', function(req, res, next){
    log('get /forgotpw',true);

    if(!req.session || req.session.referrer!=='login' ){
          error = utils.createAccessDeniedError(req);
          req.session.referrer=null;
          req.session.save();
          return next(error);
    }

    if(!req.session.requestedLanguage){
        req.session.requestedLanguage='en';
    }
    req.session.referrer='forgotpw';

    res.render(req.session.requestedLanguage +'/requestnewpw.ejs');
  });


  app.post('/forgotpw', function(req, res, next){
      log('post /forgotpw',true);
      log(JSON.stringify(req.body));
      if(!req.session || !req.session.referrer || req.session.referrer !=='forgotpw'){
          error = utils.createAccessDeniedError(req);
          req.session.referrer=null;
          req.session.save();
          return next(error);
      }

      if(!req.body.cancel && !req.body.send && !req.body.login){
          error = utils.createAccessDeniedError(req);
          req.session.referrer=null;
          req.session.save();
          return next(error);
      }

      if(req.body.cancel){
          error = utils.createAccessDeniedError(req);
          req.session.referrer=null;
          req.session.save();
          return next(error);
      }

      if(req.body.send){
        // find user with this emailadres
        models.EcoUser.findOne({email: req.body.email}).exec(function (err, theUser) {
          if(theUser) {
              async.waterfall([
                  function (callback) {
                    var tempPassword=crypto.createHash('md5').update(theUser._id +'', 'binary').update(Math.random()+'', 'binary').digest('hex').substr(0,8);
                    var sha256 = crypto.createHash('sha256');
                    sha256.update(tempPassword);
                    theUser.tempPassword=sha256.digest('hex');
                    theUser.loggedIn = false; // force login on next visit
                    theUser.save(function (err, theUser){
                      if (err) {
                        log('Error saving user\. Error: ' + JSON.stringify(err));
                        callback(err,null);
                      } else {
                          callback(null,theUser.toObject(),tempPassword);
                      }
                    });
                  },
                  function(theUser,tempPassword,callback){
                    // send mail
                    if(req.session.requestedLanguage==='es'){
                      var textMessage = "Hola "+ (theUser.nickname||'') +",\n\nUna contraseña provisional para su cuenta en ECO ha sido solicitada.\nEsta es su contraseña provisional: " + tempPassword +"\n\nUna vez entre en ECO, se le pedirá que la cambie.\nSi Vd. no solicitó una nueva contraseña, por favor ignore este mensaje. Alguien probablemente cometió un error. Vd aún podrá entrar usando su antigua contraseña.";
                      var subject= 'Contraseña provisional para la cuenta ECO';
                    } else if(req.session.requestedLanguage==='fr'){
                      var textMessage = "Bonjour "+ (theUser.nickname||'') +",\n\nUn mot de passe temporaire pour le compte ECO a été demandé.\nVoici le mot de passe temporaire: " + tempPassword +"\n\nUne fois connecté à ECO, vous devrez changer ce mot de passe.\nSi vous n’avez pas demandé un nouveau message, merci d’ignorer ce message. Quelqu’un a du faire une erreur.Vous pouvez continuer à utiliser votre ancien mot de passe.";
                      var subject= 'Mot de passe temporaire du compte ECO';
                    } else if(req.session.requestedLanguage==='de'){
                      var textMessage = "Hallo "+ (theUser.nickname||'') +",\n\nEin temporäres Kennwort für Ihr ECO-Konto wurde beantragt.\nDies ist Ihr temporäres Kennwort: " + tempPassword +"\n\nSobald Sie am ECO-Platform eingeloggt sind, werden Sie aufgefordert dieses zu ändern.\nFalls Sie kein neues Passwort anfordert haben, ignorieren Sie bitte diese Nachricht; Sie können noch mit Ihrem alten Kennwort einloggen.";
                      var subject= 'Vorübergehendes Kennwort ECO';
                    } else if(req.session.requestedLanguage==='it'){
                      var textMessage = "Ciao "+ (theUser.nickname||'') +",\n\nè stata richiesta una password temporanea per la tua utenza ECO.\nQuesta è la tua password temporanea: " + tempPassword +"\n\nUna volta effettuato l’acesso a ECO, ti sarà chiesto di cambiarla.\nSe non hai richiesto una nuova password, per favore ignora questo messaggio. Qualcuno probabilmente ha fatto un errore di battitura. Potrai continuare ad accedere con la tua vecchia password.";
                      var subject= 'Password temporanea utenza ECO';
                    } else if(req.session.requestedLanguage==='pt'){
                      var textMessage = "Olá "+ (theUser.nickname||'') +",\n\nUma palavra-passe temporária de acesso à conta ECO foi requerida.\nEsta é a sua palavra-passe temporária: " + tempPassword +"\n\nQuando aceder no ECO, ser-lhe-á solicitado para alterar a palavra-passe.\nSe não solicitou uma palavra-passe nova, por favor ignore esta mensagem. Algum erro ocorreu. Pode entrar utilizando a sua palavra-passe antiga.";
                      var subject= 'Senha temporária de acesso à conta ECO ';
                    } else {
                      var textMessage = "Hello "+ (theUser.nickname||'') +",\n\nA temporary password for your ECO account was requested.\nThis is your temporary password: " + tempPassword +"\n\nOnce you log in on ECO, you will be asked to change it.\nIf you did not request a new password, please ignore this message. Someone probably made a typo. You can still log in using your old password.";
                      var subject= 'Temporary password ECO account';
                    }


                    var mailresult = mail.sendSingleTextMail(appSettings.idpMailFrom, theUser.email, subject, textMessage);
                    callback(null,theUser);

                    /*
                    var transporter = nodemailer.createTransport(sendmailTransport({
                      path:'/usr/sbin/sendmail',
                    }));

                    var mailOptions = {
                        from: appSettings.idpMailFrom,
                        to: theUser.email,
                        subject: 'Temporary password ECO account',
                        text: "Hello "+ theUser.nickname +",\n\nA temporary password for your ECO account was requested.\nThis is your temporary password: " + tempPassword +"\n\nOnce you log in on ECO, you will be asked to change it.\nIf you did not request a new password, pleae ignore this message. Someone probably made a typo. You can still log in using your old password."
                    };

                    transporter.sendMail(mailOptions, function(error, info){
                        if(error){
                          callback(error);
                        }else{
                          callback(null,theUser);
                        }
                    });
                    */
                  }
              ],function(err,theUser){
                  if(err){
                      var error=new Error();
                      next(error);
                  } else {
                      res.render(req.session.requestedLanguage +'/tempwsent.ejs',{email:theUser.email});
                  }
              });
          } else {
              res.render(req.session.requestedLanguage +'/usernotfound.ejs');
          }
        });
      }

      if(req.body.login){
        res.redirect('./login');
      }
  });

}