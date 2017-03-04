module.exports = function(app){
    app.get('/', function(req, res){
        res.render('index.ejs', {version: app.get('appSettings').versionInfo});
    });
}

