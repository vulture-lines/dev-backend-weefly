const Userdb = require("mongoose");

const userschema = new Userdb.Schema({
  Name: {
    type: String,
    required: true,
  },
  Mobilenumber: {
    type: String,
    required: true,
  },
  Emailaddress: {
    type: String,
    required: true,
  },
  Password: {
    type: String,
    required: true,
  },
  Createdat: {
    required: true,
    type: String,
  },
  Modifiedat:{
    required: true,
    type: String,
  },
});

//User Model
const userdetails = Userdb.model("userdetails", userschema);

module.exports = userdetails;