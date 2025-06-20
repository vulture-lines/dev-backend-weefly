const Otpdb = require("mongoose");

const otpSchema = new Otpdb.Schema({
  User:{
    type:Otpdb.Schema.Types.ObjectId
  },
  PasswordresetOTP:{
    type:Number
  },
  PasswordresetOTPExpiry:{
    type:String
  }
});

const otpdetails = Otpdb.model("otpdetails",otpSchema);

module.exports = otpdetails;