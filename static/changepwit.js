﻿$(function(){
  app = {};
  app.clientErrors=false ;
  app.viewModel=kendo.observable({
      email:'',
      oldpassword:'',
      newpassword:'',
      newpassword2:'',
  });

  app.chckPwValid=function(){
    var pw=$("#newpassword").val();
    app.clientErrors=false;
    if(pw.length < 8){
        app.clientErrors=true;
    }
    if(!pw.match(/\d/ig)){
        app.clientErrors=true;
    }
    if(!pw.match(/[A-Z]/g)){
        app.clientErrors=true;
    }

    if (app.clientErrors){                                   
      // popup
       $("#newpassword + span").removeClass("pwvalid");
       $("#newpassword + span").addClass("pwinvalid");
       app.tooltip.show();
    } else {
      app.tooltip.hide();
      $("#newpassword + span").removeClass("pwinvalid");
      $("#newpassword + span").addClass("pwvalid");
    }
  };


  app.tooltip = $("#pwlabel").kendoTooltip({
    showOn: "",
    position: "bottom",
    callout:true,
    content: 'La password deve rispettare i seguenti criteri:<ul><li>Lunghezza minima 8 caratteri</li><li>Almeno un numero</li><li>Almeno una lettera maiuscola</li><li>Non può essere uguale all’indirizzo email</li></ul>',
  }).data("kendoTooltip");

  $("#newpassword").keyup(app.chckPwValid);
  $("#newpassword").blur(function(){app.tooltip.hide();});
  $("#newpassword").focus(function(){app.chckPwValid();});

  kendo.bind("#changepw", app.viewModel);

  app.validator = $("#changepw").kendoValidator({validateOnBlur: true}).data("kendoValidator");

  $("#btnChange").click(function(e){
      if (app.validator.validate()) {
        $("form").append('<input name="change" value="change" type="hidden">');
        $("form").submit();
      }
  });

  $("#btnCancel").click(function(e){
    app.validator.destroy();  // no validation please!
    // mimic html input element name="cancel"
    $("form").append('<input name="cancel" value="cancel" type="hidden">');
    $("form").submit();
  });


});