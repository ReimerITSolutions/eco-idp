$(function(){
  app = {};
  app.clientErrors=false ;
  app.viewModel=kendo.observable({
      email: $("#email").val(),
      nickName:$("#nickname").val(),
      password:'',
      password2:'',
      accept:false,
  });

  app.chckPwValid=function(){
    var pw=$("#password").val();
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
       $("#password + span").removeClass("pwvalid");
       $("#password + span").addClass("pwinvalid");
       app.tooltip.show();
    } else {
      app.tooltip.hide();
      $("#password + span").removeClass("pwinvalid");
      $("#password + span").addClass("pwvalid");
    }
  };


  app.tooltip = $("#pwlabel").kendoTooltip({
    showOn: "",
    position: "bottom",
    callout:true,
    content: 'Le mot de passe doit respecter les critères suivants:<ul><li>Il doit être composé d’au moins 8 caractères</li><li>Il doit contenir un chiffre au minimum</li><li>Il doit contenir une lettre majuscule au minimum</li><li>Il ne doit pas être le même que l’adresse de messagerie</li></ul>',
  }).data("kendoTooltip");

  $("#password").keyup(app.chckPwValid);
  $("#password").blur(function(){app.tooltip.hide();});
  $("#password").focus(function(){app.chckPwValid();});

  kendo.bind("#register", app.viewModel);

  app.validator = $("#register").kendoValidator({validateOnBlur: true}).data("kendoValidator");

  $("#btnRegister").click(function(e){
      if (app.validator.validate()) {
        // mimic html input element name="cancel"
        $("form").append('<input name="register" value="register" type="hidden">');
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