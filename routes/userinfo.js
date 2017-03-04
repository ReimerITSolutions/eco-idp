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
  app.get('/userinfo', utils.checkAuth, function(req, res,next){
      log('get /userinfo. Scope:'+req.accessToken.scope);
      var userInfo = {
        sub: req.accessToken._user._id,
        uniqueUserName: req.accessToken._user.uniqueUserName
      }

      if (req.accessToken.scope.indexOf('profile')>=0) {
          userInfo.name = req.accessToken._user.name ||'';
          userInfo.given_name = req.accessToken._user.given_name||'';
          userInfo.middle_name = req.accessToken._user.middle_name||'';
          userInfo.family_name = req.accessToken._user.family_name||'';
          userInfo.nickname = req.accessToken._user.nickname||'';
          userInfo.preferred_username = req.accessToken._user.preferred_username||'';
          userInfo.birthdate = (req.accessToken._user.birthdate?moment(req.accessToken._user.birthdate).format("YYYY-MM-DD"):null);
          userInfo.gender = req.accessToken._user.gender||'';
          userInfo.website = req.accessToken._user.website||'';
          //userInfo.updated_at = req.accessToken._user.updated_at||'';
         
      }

      if (req.accessToken.scope.indexOf('email')>=0) {
          userInfo.email = req.accessToken._user.email||'';;
          userInfo.email_verified = req.accessToken._user.email_verified||'false';
      }

      if (req.accessToken.scope.indexOf('address')>=0) {
          var address={};
          address.postal_code = req.accessToken._user.postal_code||'';
          address.locality = req.accessToken._user.locality||'';
          address.country = req.accessToken._user.country||'';
          userInfo.address=JSON.stringify(address);
      }
      if (req.accessToken.scope.indexOf('eco')>=0) {
          userInfo.language = req.accessToken._user.language||'';
          userInfo.interests = req.accessToken._user.interests||'';
          userInfo.twitterUrl = req.accessToken._user.twitterUrl||'';
          userInfo.facebookUrl = req.accessToken._user.facebookUrl||'';
          userInfo.linkedInUrl = req.accessToken._user.linkedInUrl||'';
          userInfo.bio = req.accessToken._user.bio||'';
      }
      log(JSON.stringify(userInfo));
      res.json(userInfo);
  });

}

