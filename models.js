var mongoose = require('mongoose');
var appSettings = require('./appSettings.js');

var OpenIDClientSchema = new mongoose.Schema({
    name: String,
    key: {
            type: String,
            index: true
    },
    secret: String,
    redirect_uri: String,
    redirect_httpcode : Boolean,
    public_AppName:String,
    legal_terms_url:String,
    privacy_policy_url:String,
    afterRegisterUrl:String,
    client_authentication_method:String,
    defaultClientUrl:String,
});

var userSchema = new mongoose.Schema({
    given_name: String,
    middle_name: String,
    family_name: String,
    nickname: String,
    email: {
            type: String,
            index: true
    },
    email_verified: Boolean,
    password: String,
    tempPassword:String,
    birthdate: Date,
    gender: String,
    language: String,
    postal_code: String,
    locality: String, //city
    country: String,  // 2 Letter ISO 3166-1 code
    interests:String,
    loggedIn: Boolean,
    stayLoggedIn: Boolean,
    confirmed:Boolean,
    registeredOn: Date,
    lastLoggedIn: Date,
    uniqueUserName: String,
    updated_at: Number, // Time the End-User's information was last updated. Its value is a JSON number representing the number of seconds from 1970-01-01T0:0:0Z as measured in UTC until the date/time.
    website: String,  // URL
    twitterUrl: String, // URL
    facebookUrl : String, // URL
    linkedInUrl: String, // URL
    bio:String, // Plaint text,no html, only <br/> allowed for new lines
    emailcanonical: {
            type: String,
            index: true
    },

});

userSchema.virtual('name').get(function () {
  return (this.given_name ||'') + ((this.given_name|| '')!==''?' ':'') + (this.middle_name ||'') + ((this.middle_name|| '')!==''?' ':'') + (this.family_name ||'');
});

userSchema.virtual('preferred_username').get(function () {
  return (this.email||'');
});

var userRolesSchema = new mongoose.Schema({
    _user: {type: mongoose.Schema.Types.ObjectId, ref: 'users', index:true},
    emailcanonical: String,
    roles: [String],
});


var rolesSchema = new mongoose.Schema({
    role: String,
});


var userLoggedInHistorySchema = new mongoose.Schema({
    _user: {type: mongoose.Schema.Types.ObjectId, ref: 'users', index:true},
    loggedIn: Date,
    _client: {type: mongoose.Schema.Types.ObjectId, ref: 'openidclients'},
});
userLoggedInHistorySchema.index({ "_user": 1, "loggedIn": 1});



var accessTokenSchema = new mongoose.Schema({
    token: {
        type:String,
        index:true
    },
    _user: {type: mongoose.Schema.Types.ObjectId, ref: 'users', index:true},
    _client: {type: mongoose.Schema.Types.ObjectId, ref: 'openidclients'},
    expiresIn: Number,
    createdOn: Date,
    scope: String,
});

var authorizationCodeSchema = new mongoose.Schema({
    code:  {
        type:String,
        index:true
    },
    createdOn: Date,
    redirect_uri: String,
    scope: String,
    nonce: String,
    used: Boolean,
    _user: {type: mongoose.Schema.Types.ObjectId, ref: 'users', index:true},
    _client: {type: mongoose.Schema.Types.ObjectId, ref: 'openidclients'},
});

var consentSchema = new mongoose.Schema({
    _user: {type: mongoose.Schema.Types.ObjectId, ref: 'users'},
    _client: {type: mongoose.Schema.Types.ObjectId, ref: 'openidclients'},
    createdOn: Date,
    scope: String,
});
consentSchema.index({ "_user": 1, "_client": 1});

var registerConfirmationSchema = new mongoose.Schema({
    _user: {type: mongoose.Schema.Types.ObjectId, ref: 'users', index:true},
    _client: {type: mongoose.Schema.Types.ObjectId, ref: 'openidclients'},
    language: String,
    createdOn: Date,
    confirmedOn: Date,
    loginUrl: String,
    initiator: String,
});

var sequenceSchema = new mongoose.Schema({
    name: String,
    sequence:Number
});

sequenceSchema.statics.genId = function (name,cb){
 this.findOneAndUpdate(
  { name: name },
  { $inc: {sequence:1} },
  { new: true,  upsert:true },
  function (err, theSequence) {
    if(err){
        return cb(err,null)
    } else {
        return cb(null,theSequence.sequence);
    }
  }
  )
}

var AuthorizationCode = appSettings.mongoIDPConnection.model('AuthorizationCodes', authorizationCodeSchema);
var AccessToken = appSettings.mongoIDPConnection.model('AccessTokens', accessTokenSchema);
var EcoUser = appSettings.mongoIDPConnection.model('users', userSchema);
var OpenIDClient = appSettings.mongoIDPConnection.model('openidclients', OpenIDClientSchema);
var Consent = appSettings.mongoIDPConnection.model('consents', consentSchema);
var RegisterConfirmation = appSettings.mongoIDPConnection.model('confirmations', registerConfirmationSchema);
var Sequence = appSettings.mongoIDPConnection.model('sequences', sequenceSchema);
var UserRoles = appSettings.mongoIDPConnection.model('userroles', userRolesSchema);
var Roles = appSettings.mongoIDPConnection.model('roles', rolesSchema);
var UserLoggedInHistory = appSettings.mongoIDPConnection.model('userloggedinhistories', userLoggedInHistorySchema);


module.exports = {
    AuthorizationCode:AuthorizationCode,
    AccessToken:AccessToken,
    EcoUser:EcoUser,
    OpenIDClient:OpenIDClient,
    Consent:Consent,
    RegisterConfirmation:RegisterConfirmation,
    Sequence:Sequence,
    UserLoggedInHistory:UserLoggedInHistory,
    UserRoles:UserRoles,
    Roles:Roles,
}
