var Q = require('q');
var moment = require('moment');
var jwt = require('jwt-simple');
var querystring = require('querystring');
var async = require('async');
var validator = require('validator');
var crypto = require('crypto');
var fs = require('fs');
var sanitizeHtml = require('sanitize-html');
var validator = require('validator');

var log = require('../log.js');
var errorHandle=require('../errorHandle.js');
var models=require('../models.js');
var tokens=require('../tokens.js');
var utils=require('../utils.js');


module.exports = function(app){
  app.put('/api/users/:sub', utils.checkAuth, function(req, res,next){
      var apiResult = {
                    code:'200',
                    message:'OK'
      };

      log('put /api/users/:sub req body:'+JSON.stringify(req.body));
      log('put /api/users/:sub sub param:'+req.params.sub);

      // the supplied sub must equal to user._id
      if(req.params.sub !== req.accessToken._user._id.toHexString()){
            apiResult.code= '401',
            apiResult.message='Unauthorized'
            res.status(apiResult.code).json(apiResult);
            return;
      }

      models.EcoUser.findOne({_id: req.accessToken._user._id}).exec(function (err, theUser){
        if (err || !theUser) {
            apiResult.code= '404',
            apiResult.message='User not found'
            res.status(apiResult.code).json(apiResult);
        } else {
            // profile scope
            if (req.accessToken.scope.indexOf('profile')>=0) {
              if('given_name' in req.body){
                var clean = sanitizeHtml(req.body.given_name, {
                  allowedTags: [],
                  allowedAttributes: {}
                });
                theUser.given_name = (clean||'');
              }

              if('middle_name' in req.body){
                var clean = sanitizeHtml(req.body.middle_name, {
                  allowedTags: [],
                  allowedAttributes: {}
                });
                theUser.middle_name = (clean||'');
              }

              if('family_name' in req.body){
                var clean = sanitizeHtml(req.body.family_name, {
                  allowedTags: [],
                  allowedAttributes: {}
                });
                theUser.family_name = (clean||'');
              }

              if('nickname' in req.body){
                var clean = sanitizeHtml(req.body.nickname, {
                  allowedTags: [],
                  allowedAttributes: {}
                });
                theUser.nickname = utils.sanitizeNickname(clean);
              }

              if('gender' in req.body){
                req.body.gender=req.body.gender.toLowerCase();
                if((req.body.gender==='' || req.body.gender==='male' || req.body.gender==='female')){
                    theUser.gender = req.body.gender;
                }
              }

              if('birthdate' in req.body){
                if(req.body.birthdate=== null || req.body.birthdate===""){
                    theUser.birthdate = null;
                } else {
                  try {
                      theUser.birthdate = moment(req.body.birthdate,"YYYY-MM-DD").toDate();  // convert to Date object
                  } catch(e) {}
                }
              }

              if('website' in req.body){
                  var clean = sanitizeHtml(req.body.website, {
                    allowedTags: [],
                    allowedAttributes: {}
                  });

                  // only proceed when no tamper attempt
                  if(clean === req.body.website) {
                      if(req.body.website ==="" || validator.isURL(req.body.website)){
                          theUser.website=req.body.website;
                      }
                  }
              }

            }

            // address scope
            if (req.accessToken.scope.indexOf('address')>=0) {
              if('postal_code' in req.body){
                var clean = sanitizeHtml(req.body.postal_code, {
                  allowedTags: [],
                  allowedAttributes: {}
                });
                theUser.postal_code = (clean||'');
              }

              if('locality' in req.body){
                var clean = sanitizeHtml(req.body.locality, {
                  allowedTags: [],
                  allowedAttributes: {}
                });
                theUser.locality = (clean||'');
              }

              if('country' in req.body){
                var clean = sanitizeHtml(req.body.country, {
                  allowedTags: [],
                  allowedAttributes: {}
                });

                theUser.country = (clean||'').toUpperCase();
              }
            }


            // eco scope
            if (req.accessToken.scope.indexOf('eco')>=0) {
                if('language' in req.body){
                    var clean = sanitizeHtml(req.body.language.toLowerCase(), {
                      allowedTags: [],
                      allowedAttributes: {}
                    });
                    if (clean === '' || clean === 'en' || clean === 'fr' || clean === 'de' || clean === 'pt' || clean === 'it' || clean === 'es'){
                        theUser.language = req.body.language.toLowerCase()
                    }
                }

                if('interests' in req.body){
                  var clean = sanitizeHtml(req.body.interests.toUpperCase(), {
                    allowedTags: [],
                    allowedAttributes: {}
                  });

                  var interests= (clean+'').split(',');
                  var result=new Array();
                  for(var i=0;i<interests.length;i++){
                      if(interests[i]=='ES'||interests[i]=='SS'||interests[i]=='HUM'||interests[i]=='NSM'||interests[i]=='BS'||interests[i]=='TS'){
                          result.push(interests[i]);
                      }
                  }
                  theUser.interests = result.join(',');
                }

                if('twitterUrl' in req.body){
                    var clean = sanitizeHtml(req.body.twitterUrl, {
                      allowedTags: [],
                      allowedAttributes: {}
                    });

                    // only proceed when no tamper attempt
                    if(clean === req.body.twitterUrl) {
                        if(req.body.twitterUrl ==="" || validator.isURL(req.body.twitterUrl)){
                            theUser.twitterUrl=req.body.twitterUrl;
                        }
                    }
                }

                if('facebookUrl' in req.body){
                    var clean = sanitizeHtml(req.body.facebookUrl, {
                      allowedTags: [],
                      allowedAttributes: {}
                    });

                    // only proceed when no tamper attempt
                    if(clean === req.body.facebookUrl) {
                        if(req.body.facebookUrl ==="" || validator.isURL(req.body.facebookUrl)){
                            theUser.facebookUrl=req.body.facebookUrl;
                        }
                    }
                }

                if('linkedInUrl' in req.body){
                    var clean = sanitizeHtml(req.body.linkedInUrl, {
                      allowedTags: [],
                      allowedAttributes: {}
                    });

                    // only proceed when no tamper attempt
                    if(clean === req.body.linkedInUrl) {
                        if(req.body.linkedInUrl ==="" || validator.isURL(req.body.linkedInUrl)){
                            theUser.linkedInUrl=req.body.linkedInUrl;
                        }
                    }
                }

                if('bio' in req.body){
                    theUser.bio=cleanUp(req.body.bio);
                }

            }

            theUser.save(function (err, theUser){
              if (err){
                apiResult.code= '500',
                apiResult.message='User update failed'
                res.status(apiResult.code).json(apiResult);
              } else {
                res.status(apiResult.code).json(apiResult);
              }
            });
        }
      });
  });

  app.post('/api/users/:sub/logout', utils.checkAuth, function(req, res, next){
    var apiResult = {
                  code:'200',
                  message:'OK'
    };

    log('post /api/users/:sub/logout ');
    log('post /api/users/:sub/logout sub param:'+req.params.sub);

    // the supplied sub must equal to user._id
    if(req.params.sub !== req.accessToken._user._id.toHexString()){
          apiResult.code= '401',
          apiResult.message='Unauthorized'
          res.status(apiResult.code).json(apiResult);
          return;
    }

    models.EcoUser.findOne({_id: req.accessToken._user._id}).exec(function (err, user){
      if(!err && user) {
          log('post /api/users/:sub/logout: User '+JSON.stringify(user) + 'logged out');
          user.loggedIn = false;
          user.save();
          res.status(apiResult.code).json(apiResult);
      } else {
          log('post /api/users/:sub/logout: No User found');
          apiResult.code= '404',
          apiResult.message='User not found'
          res.status(apiResult.code).json(apiResult);
      }
    });

  });




  app.post('/api/register', function(req, res, next){
    var apiResult = {
                  code:'200',
                  message:'OK'
    };

    log('post /api/register ');
    log('post /api/register params:'+ JSON.stringify(req.body));

    //email
    //nickname
    //hash: MD5(email)
/*
1.	Email
2.	given_name
3.	family_name
4.	language (just two letter code)
  */

    if(!req.body.GUID || req.body.GUID !== '1dbfaf7fff0ca014e05e508c2244db83'){
        apiResult.code= '401';
        apiResult.message='Not authorized';
        res.status(apiResult.code).json(apiResult);
        return;
    }

    req.body.email = validator.escape(req.body.email);

    req.body.given_name = validator.escape(req.body.given_name||'');
    req.body.family_name = validator.escape(req.body.family_name||'');
    if(('language' in req.body) && (req.body.language.toLowerCase() === 'en' || req.body.language.toLowerCase() === 'fr' ||req.body.language.toLowerCase() === 'de' ||req.body.language.toLowerCase() === 'pt' || req.body.language.toLowerCase() === 'it' || req.body.language.toLowerCase() === 'es')){
        req.body.language = req.body.language.toLowerCase();
    } else {
        req.body.language='en';
    }



    var md5 = crypto.createHash('md5');
    md5.update(req.body.email);
    var md5Digest = md5.digest('hex');
    console.log('md5:'+md5Digest);

    if(!req.body.hash || req.body.hash !== md5Digest ){
        apiResult.code= '424';
        apiResult.message='Invalid hash';
        res.status(apiResult.code).json(apiResult);
        return;
    }


    if(!validator.isEmail(req.body.email)){
        apiResult.code= '412';
        apiResult.message='Invalid email address';
        res.status(apiResult.code).json(apiResult);
        return;
    }


    models.EcoUser.findOne({email: req.body.email}).exec(function (err, user) {
        if(err || user) {
          apiResult.code= '417';
          apiResult.message="The emailadress is already in use";
          res.status(apiResult.code).json(apiResult);
          return;
        } else {
            // create temp password
              var tempPassword=crypto.createHash('md5').update(Math.random()*23+'', 'binary').digest('hex').substr(0,8);
              var sha256 = crypto.createHash('sha256');
              sha256.update(tempPassword);

              var user = new models.EcoUser({
                nickname: '',
                email: req.body.email,
                email_verified: true,
                password: null,
                tempPassword:sha256.digest('hex'),
                lastLoggedIn: null,
                loggedIn: false,
                stayLoggedIn: true,
                confirmed:true,
                given_name:req.body.given_name,
                family_name: req.body.family_name,
                language:req.body.language,
                registeredOn:new Date()
              });

              var uniqueUserName= utils.extractUserFromEmailAddress(user.email);
              models.Sequence.genId('users',function(err, sequence){
                 if(err){
                      log('Error saving user. Error: ' + JSON.stringify(err));
                      apiResult.code= '500';
                      apiResult.message='User update failed';
                      res.status(apiResult.code).json(apiResult);
                      return;
                 } else {
                  uniqueUserName+=sequence;
                  user.uniqueUserName =uniqueUserName;
                  user.save(function (err, theUser){
                      if (err) {
                          log('Error saving user. Error: ' + JSON.stringify(err));
                          apiResult.code= '500';
                          apiResult.message='User update failed';
                          res.status(apiResult.code).json(apiResult);
                          return
                      } else {
                          apiResult.pw=tempPassword;
                          res.status(apiResult.code).json(apiResult);
                      }
                  });
                 }
              });
        }
    });

  });


  app.get('/api/userstats', utils.checkAuth, checkRoles("idpadmin"), function(req, res, next){
      log('get /api/userstats',true);

      var apiResult = {
        code:'500',
        message:'Internal server error'
      };

      models.EcoUser.aggregate([
          {
             $project: {
              "dateRegistered":{
                    "$subtract" : ["$registeredOn",
                      {"$add":[
                            {"$millisecond" : "$registeredOn"},
                            {"$multiply":[{"$second" : "$registeredOn"},1000]},
                            {"$multiply":[{"$minute" : "$registeredOn"},60,1000]},
                            {"$multiply":[{"$hour" : "$registeredOn"},60,60,1000]}
                        ]}
                     ]},
             }
          },
          {
              $group:{
                  "_id": "$dateRegistered",
                  count: { $sum: 1 },
              }
          },
          {
              $sort: {"_id":1}
          }], function (err, aggresResult){
            if(err){
                log(err);
                return res.status(apiResult.code).json(apiResult);
            } else {
                  var d, result=new Array();

                  if(aggresResult.length>0){
                        // fix newUserStats: On a day when there are no results, enter dummy zero data.
                        var currentDate = moment(aggresResult[0]._id); // startdate
                        var totalUsers = 0;

                        for(var n=0;n<aggresResult.length;n++){
                            if(moment(aggresResult[n]._id).isSame(currentDate)){
                                totalUsers=totalUsers+aggresResult[n].count;
                                d={
                                  "date": currentDate.format("YYYY-MM-DD"),
                                  "newUsers": aggresResult[n].count,
                                  "totalUsers": totalUsers
                                }
                                result.push(d);
                                currentDate = currentDate.add(1,'days');
                            } else {
                                // no data for this date available.
                                // Insert dummy zero data until we reached the date where actual data is present
                                while(currentDate.isBefore(moment(aggresResult[n]._id))){
                                    d = {"date": currentDate.format("YYYY-MM-DD"),
                                      "newUsers": 0,
                                      "totalUsers": totalUsers
                                    };
                                    result.push(d);
                                    currentDate = currentDate.add(1,'days');
                                }

                                // now there is data
                                totalUsers=totalUsers+aggresResult[n].count;
                                d = {"date": currentDate.format("YYYY-MM-DD"),
                                    "newUsers": aggresResult[n].count,
                                    "totalUsers": totalUsers
                                };
                                result.push(d);
                                currentDate = currentDate.add(1,'days');
                            }
                        }  // end for
                  }

                  return res.json(result);
          }
      });
    });

}


function cleanUp(str){
  clean = sanitizeHtml(str, {
    allowedTags: [ 'br' ],
    allowedAttributes: {
    }
  });

  //remove rubbish characters
  clean = clean.replace(/\t/g, '');  // tabs

  // convert \r\n to <br>
  clean = clean.replace(/\r\n/g, '<br/>');
  clean = clean.replace(/\r/g, '<br/>');
  clean = clean.replace(/\n/g, '<br/>');

  return clean;
}

// custom middleware
function checkRoles(role){
    return function(req,res,next){
      if(!req.accessToken || !req.accessToken._user ||! req.accessToken._user._id){
        var apiResult = {
          code:'500',
          message:'Internal server error'
        };
        return res.status(apiResult.code).json(apiResult);;
      }

      models.UserRoles.findOne({_user: req.accessToken._user._id}).lean().exec(function(err, theUserRoles){
          if (err || !theUserRoles || (theUserRoles.roles.indexOf(role)==-1) ){
              var apiResult = {
                      code:'401',
                      message:'Unauthorized'
              };
            return res.status(apiResult.code).json(apiResult);
          } else {
              return next()
          }
      });
    }
}



