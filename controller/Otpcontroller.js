const crypto = require("crypto"); // To generate a random OTP
const emailService = require("../services/Emailservice");
const userdetails = require("../models/Userdb");
const otpDetails = require("../models/Otpdb");
// Function to generate a 6-digit OTP
const generateOTP = () => {
  return crypto.randomInt(100000, 999999).toString();
};

// Function to handle OTP request and email sending
const sendOTP = async (req, res) => {
  const { email } = req.body;
  const otp = generateOTP();
  const otpExpiry = Date.now() + 5 * 60 * 1000;

  try {
    const user = await userdetails.findOne({ Emailaddress: email }, { _id: 1 });


    if (!user) {
      return res.status(401).send("Not a registered user");
    }

    // Update if exists, insert if not (upsert)
    await otpDetails.findOneAndUpdate(
      { User: user._id },
      {
        User: user._id,
        PasswordresetOTP: otp,
        PasswordresetOTPExpiry: otpExpiry,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    await emailService.sendEmail(email, otp); // Send OTP via email
    return res.status(200).send("Otp Sent Sucessfully!!")
  } catch (error) {
    console.log(error);
    res.status(500).send("Internal server error");
  }
};

const validateOTP = async (req, res) => {
  const { email, inputOtp } = req.body;
  if (!email || !inputOtp) {
    return res.status(422).send("Email and OTP are required");
  }

  const user = await userdetails.findOne({ Emailaddress: email });
  const userId = user._id;
  const otpDetail = await otpDetails.findOne({ User: userId });
  if (
    !user ||
    !otpDetail.PasswordresetOTP ||
    !otpDetail.PasswordresetOTPExpiry
  ) {
    return res.status(401).send("Invalid or expired OTP");
  }

  if (Date.now() > Number(otpDetail.PasswordresetOTPExpiry)) {
    return res.status(410).send("OTP has expired");
  }

  if (otpDetail.PasswordresetOTP !== inputOtp) {
    return res.status(401).send("Incorrect OTP");
  }

  return res.status(200).send("OTP verified successfully");
};

module.exports = { sendOTP, validateOTP };
