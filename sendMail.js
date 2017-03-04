var log=require('./log.js');
var appSettings = require('./appSettings.js');
var sendgrid  = require('sendgrid')(appSettings.sendgridUsername, appSettings.sendgridPassword);

function sendSingleTextMail(from, to, subject, message){
  var payload   = {
    to      : to,
    from    : from,
    subject : subject,
    text    : message
  }

  sendgrid.send(payload, function(err, json) {
    if (err) {
        log(JSON.stringify(err));
    }
    log(JSON.stringify(json));
  });
}

/*
var mandrill=require('./mandrill.js');
var mandrillApiKey = 'btqsCzzohJ_q_LJyXtCzDw';
var mandrill_client = new mandrill.Mandrill(mandrillApiKey);
var log=require('./log.js');


function sendSingleTextMail(from, to, subject, message){
  var message = {
    "html": null,
    "text": message,
    "subject": subject,
    "from_email": from,
    "from_name": "ECO",
    "to": [{
            "email": to,
            "name": null,
            "type": "to"
        }],
    "headers": {
        "Reply-To": to
    },
    "important": false,
    "track_opens": null,
    "track_clicks": null,
    "auto_text": null,
    "auto_html": null,
    "inline_css": null,
    "url_strip_qs": null,
    "preserve_recipients": null,
    "view_content_link": null,
    "bcc_address": "",
    "tracking_domain": null,
    "signing_domain": null,
    "return_path_domain": null,
    "merge": true,
    "merge_language": "mailchimp",
    "global_merge_vars": [],
    "merge_vars": [],
    "tags": [],
    "subaccount": null,
    "google_analytics_domains": [],
    "google_analytics_campaign": "",
    "metadata": { },
    "recipient_metadata": [],
    "attachments": [],
    "images": []
  };
  var async = false;
  var ip_pool = null;
  var send_at = null ;
  mandrill_client.messages.send({"message": message, "async": async, "ip_pool": ip_pool, "send_at": send_at}, function(result) {
    log('Mail send. Result: ' + JSON.stringify(result));
  }
  , function(e) {
    log('Error sending mail. Error: ' +JSON.stringify(e));
  });
}
*/


module.exports = {
    sendSingleTextMail:sendSingleTextMail,
}