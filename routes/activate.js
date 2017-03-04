var log = require('../log.js');
var models=require('../models.js');
var async = require('async');

var appSettings = require('../appSettings.js');
var utils=require('../utils.js');


module.exports = function(app){

  app.get('/activate', function(req, res, next){
    var ok=false;
    var redirectUrl=appSettings.defaultLoginUrl;
    var initiator=appSettings.defaultInitiator;


    req.query.id=req.query.id||null;
    models.RegisterConfirmation.findOne({_id: req.query.id}).populate('_user').exec(function (err, theConfirmation) {
      // conformation must have valid  user. User must activate just once
      if(theConfirmation && theConfirmation._user && !theConfirmation.confirmedOn) {
        // Direct the user to the after registration url
        if(theConfirmation.loginUrl && theConfirmation.loginUrl!==''){
            redirectUrl=theConfirmation.loginUrl;
        }
        if(theConfirmation.initiator && theConfirmation.initiator!==''){
            initiator=theConfirmation.initiator;
        }

        theConfirmation.confirmedOn = new Date();
        theConfirmation._user.confirmed = true;
        theConfirmation._user.registeredOn = new Date();
        theConfirmation._user.email_verified = true;

        async.parallel([
            function(callback){
              theConfirmation._user.save(function (err, theUser){
                if (err) {
                  log('Error saving activationconfirmation. Error: ' + JSON.stringify(err));
                  callback(new Error('Error updating user data'),null);
                } else {
                  callback(null,theUser);
                }
              });
            },
            function(callback){
              theConfirmation.save(function (err, theConfirmation){
                if (err) {
                    log('Error saving activationconfirmation. Error: ' + JSON.stringify(err));
                    callback(new Error('Error updating user data'),null);
                } else {
                  callback(null,theConfirmation);
                }
              });
            }
        ],
        function(err, results){
          if (err){
              return next(err);
          }

          if(!theConfirmation.language || theConfirmation.language===''){
            var language='en';
          }  else {
            var language=theConfirmation.language;
          }

          res.render(language+'/activated.ejs',{
              afterRegisterUrl:redirectUrl,
              clientName: initiator,
          });

          // send xapistatement regarding user activating registration
          log('post /token: send xapistatement');
          try {
              utils.sendxApiStatement({
                actor: theConfirmation._user._id,
                verb: "http://activitystrea.ms/schema/1.0/confirm",
                object: {
                    id:"https://idp.ecolearning.eu/register"
                },
              });
          } catch (e) {
            log('post /token: error in sending xapistatement',true);
          }

        });
      } else {
        res.render('activatederror.ejs');
      }
    });
  });
}
