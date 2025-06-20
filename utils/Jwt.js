//importing the jwt library
const jwt = require("jsonwebtoken");

//Function to generate JSON web token
const tokengenerator = (id) => {
  const token = jwt.sign({ id}, process.env.JWT_KEY, {
    expiresIn: "2h",
  });
  return token;
};

module.exports = {tokengenerator}; //Exporting the function