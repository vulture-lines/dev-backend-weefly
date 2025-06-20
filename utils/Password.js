const bcrypt = require("bcryptjs");
const saltlvl = 10; 

//Function to generate password
const encryptPassword = async (plainpassword) => {
  const salt = await bcrypt.genSalt(saltlvl);
  const encryptedpass = await bcrypt.hash(plainpassword, salt);
  return encryptedpass;
};

const decryptPassword = async (plainpassword, encryptedpassword) => {
  const result = await bcrypt.compare(plainpassword, encryptedpassword);
  return result;
};

module.exports = { encryptPassword,decryptPassword}; 

