// controllers/loginController.js
require("dotenv").config();

const fetchLoginID = async (req, res) => {
  const username = process.env.API_USERNAME;
  const password = process.env.API_PASSWORD;
  // models/travelfusionModel.js
  const axios = require("axios");
  const { Builder } = require("xml2js");
  const { parseStringPromise } = require("xml2js");

  function createLoginCommand(username, password) {
    const builder = new Builder({ headless: true });
    const xmlObj = {
      CommandList: {
        Login: {
          Username: username,
          Password: password,
        },
      },
    };
    return builder.buildObject(xmlObj);
  }

  async function sendPostRequest(xmlPayload) {
    const response = await axios.post(
      "https://api.travelfusion.com",
      xmlPayload,
      {
        headers: {
          "Content-Type": "text/xml; charset=utf-8",
          Accept: "text/xml",
          "Accept-Encoding": "gzip, deflate",
        },
        timeout: 120000,
      }
    );
    return response.data;
  }

  async function getLoginID(username, password) {
    const loginXml = createLoginCommand(username, password);
    const responseXml = await sendPostRequest(loginXml);
    const parsed = await parseStringPromise(responseXml);
    const loginId = parsed?.CommandList?.Login?.[0]?.LoginId?.[0];
    if (!loginId) {
      throw new Error("Unauthorised");
    }
    return loginId;
  }

  try {
    const loginId = await getLoginID(username, password);
    return loginId
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
};

module.exports = {
  fetchLoginID,
};
