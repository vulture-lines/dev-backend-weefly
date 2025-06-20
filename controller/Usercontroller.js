require("dotenv").config();
const JWT = require("jsonwebtoken");
const userDetails = require("../models/Userdb");
const { encryptPassword, decryptPassword } = require("../utils/Password");
const { cookieencrypt, cookiedecrypt, getKey } = require("../utils/Cookie");
const { tokengenerator } = require("../utils/Jwt");
const userdetails = require("../models/Userdb");

exports.Signup = async (req, res) => {
  try {
    const {
      Name,
      Mobilenumber,
      Emailaddress,
      Password,
      Createdat,
      Modifiedat,
    } = req.body;
    properuserdata = Emailaddress.trim();
    const encryptedpass = await encryptPassword(Password);
    const existinguser = await userDetails.findOne(
      {
        Emailaddress: properuserdata,
      },
      { id: 1 }
    );
    if (existinguser !== null) {
      return res.status(409).json({ message: "Email already exists" });
    } else {
      const newuser = new userDetails({
        Name,
        Mobilenumber,
        Emailaddress,
        Password: encryptedpass,
        Createdat,
        Modifiedat,
      });
      const saveduser = await newuser.save();
      res.status(200).send("Registered Successfully!!");
    }
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

exports.signIn = async (req, res) => {
  const { Emailaddress, Password } = req.body;
  try {
    const existinguser = await userDetails.findOne(
      { Emailaddress: Emailaddress },
      { id: 1, Password: 1, Emailaddress: 1 }
    );
    console.log(existinguser);

    if (!existinguser) {
      res.status(400).send("User doesn't exist");
    } else {
      const authenticatinguser = await decryptPassword(
        Password,
        existinguser.Password
      );
      if (!authenticatinguser) {
        res.status(401).send("Invalid Password");
      } else {
        try {
          const id = existinguser.Emailaddress;
          console.log(id);
          const token = await tokengenerator(id);
          console.log("JWT Token: " + "  " + token);
          const key = await getKey();
          const encryptedtoken = cookieencrypt(token, key);
          res
            .status(200)
            .cookie("jwt", encryptedtoken, {
              maxAge: 60 * 60 * 1000,
              path: "/",
            })
            .send("Sign Successful!!");
        } catch (error) {
          console.log(error);
        }
      }
    }
  } catch (error) {
    console.log(error);
  }
};

exports.getUsers = async (req, res) => {
  const jwt = req.cookies.jwt;
  let email = "";
  try {
    const secretKey = getKey();
    const jwtKey = process.env.JWT_KEY;
    const decryptedJwt = await cookiedecrypt(jwt, secretKey);
    const decodedPayload = JWT.verify(decryptedJwt, jwtKey);
    email = decodedPayload.id;
  } catch (error) {
    console.log("Encryption/Decryption error" + error);
  }
  try {
    const users = await userdetails.findOne(
      { Emailaddress: email },
      { Name: 1, Mobilenumber: 1, Emailaddress: 1 }
    );
    res.status(200).json(users);
  } catch (error) {
    console.log("Error in fetching User Detail" + error);
  }
};
