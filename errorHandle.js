module.exports = function(app){
  var url = require('url');
  var log = require('./log.js');
  var utils=require('./utils.js');

  // Error object is extended with these properties:
  // - idp_error
  // - status, in case of 404
  // - sendpostresponse

  // handling 404 errors
  app.use(function(err, req, res, next) {
    if(err.status && err.status == 404) {
        log('show 404 page. route:' + req.url + '. Headers: '+ JSON.stringify(req.headers)  ,true);
        res.render('404error.ejs');
    } else {
      return next(err);
    }
  });

  app.use(function(err, req, res, next) {
    log('Error occurred!:' + err,true);
    if(err.sendpostresponse){
        return next(err);
    }

    if(req.session){
        log('Session object:' + JSON.stringify(req.session||null),true);
    }

    if(!err.idp_error){
        err.idp_error = 'Internal error';
        log('Callstack:' + err.stack,true);
    }

    if(!err.message){
        err.message = 'An internal server error occurred.';
    }

    // We will try to return the error to the client, whenever possible.
    if( !req || !req.session){
        return next(err);  // not possible..... :(
    }

    if(!req.session.client  || !req.session.client.redirect_uri || !req.session.flow) {
        return next(err);  // not possible..... :(
    }

    if(!req.session.AuthParams  || !req.session.AuthParams.state ) {
        return next(err);  // not possible..... :(
    }

    var redirectHttpcode = req.session.client.redirect_httpcode|| true;
    var flow= req.session.flow;
    var state = req.session.AuthParams.state ||'';

    if(flow=='code'){
      var redirect = url.parse(req.session.client.redirect_uri, true);
      redirect.query.error = err.idp_error;
      redirect.query.error_description = err.message;
      redirect.query.state = state;
    }

    if(flow=='implicit'){
        var redirect = url.parse(req.session.client.redirect_uri + '#error=' +err.idp_error + '&error_description='+err.message+'&state='+state , true);
    }

    req.session.client = null;
    utils.cleanSession(false);

    if (redirectHttpcode){
          res.redirect(url.format(redirect));
      } else {
          res.redirect(200,url.format(redirect));
    }
    return;

  });


  // handle errors that require a post response
  app.use(function(err, req, res, next) {
    if(err.sendpostresponse){
      log('Sending POST error response',true);
      res.header('Cache-Control', 'no-store');
      res.header('Pragma', 'no-cache');
      res.json({"error": err.idp_error});
    }  else {
        next(err);
    }
  });

  // No other option than to show errormessage to the user
  app.use(function(err, req, res, next) {
    utils.cleanSession(false);
    res.status(500);
    res.render('usererror.ejs',{idp_error: err.idp_error, message:err.message});
  });

}


