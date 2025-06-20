const nodemailer = require("nodemailer");
const dotenv = require("dotenv");
dotenv.config();
const transPorter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAILUSER,
    pass: process.env.EMAILPASS,
  },
  tls: {
    rejectUnauthorized: false,
  },
});

const sendEmail = (email, otp) => {
  const mailOptions = {
    from: process.env.EMAILUSER, // Sender's email
    to: email, // Recipient's email
    subject: "Weefly OTP Verfication",
    text: `Dear User, your One-Time Password (OTP) for resetting your password is: ${otp}. This code is valid for 5 minutes. Please do not share it with anyone.`,
  };

  return new Promise((resolve, reject) => {
    transPorter.sendMail(mailOptions, (error, info) => {
      if (error) {
        reject(error);
      } else {
        resolve(info.response);
      }
    });
  });
};

module.exports = { sendEmail };
