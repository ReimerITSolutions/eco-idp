module.exports = function(app){
  app.post('/temppwsent', function(req, res, next){
     req.session.referrer='temppwsent';
     res.redirect('/login');
  });
}
