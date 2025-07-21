require("dotenv").config();
const axios = require("axios");
const { Builder } = require("xml2js");
const { parseStringPromise } = require("xml2js");

const getAvailability = async (req, res) => {
  const username = process.env.API_USERNAME_CABOVERDE;
  const password = process.env.API_PASSWORD_CABOVERDE;

  const builder = new Builder({ headless: true });

const xmlPayload = builder.buildObject({
  "soapenv:Envelope": {
    $: {
      "xmlns:soapenv": "http://schemas.xmlsoap.org/soap/envelope/",
      "xmlns:impl": "http://impl.soap.ws.crane.hititcs.com/",
    },
    "soapenv:Header": {},
    "soapenv:Body": {
      "impl:GetAvailability": {
        AirAvailabilityRequest: {
          clientInformation: {
            clientIP: req.headers["x-forwarded-for"] || req.connection.remoteAddress,
            member: false,
            password: password,
            userName: username,
            preferredCurrency: "CVE",
          },
          originDestinationInformationList: {
            dateOffset: 0,
        departureDateTime: "2025-07-30", 
            destinationLocation: { locationCode: "BVR" },
            originLocation: { locationCode: "RAI" },
            flexibleFaresOnly: false,
            includeInterlineFlights: true,
            openFlight: true,
          },
          travelerInformation: {
            passengerTypeQuantityList: {
              hasStrecher: "",
              passengerType: { code: "ADLT" },
              quantity: 1,
            },
          },
          tripType: "ONE_WAY",
        },
      },
      "impl:GetAirAvailability": "", // optional if needed
    },
  },
});


  try {
    const response = await axios.post(
      "https://tcv-stage.crane.aero/craneota/CraneOTAService?wsdl",
      xmlPayload,
      {
        headers: {
          "Content-Type": "text/xml;charset=UTF-8",
          SOAPAction: "", // Usually empty for Crane, unless explicitly required
        },
        timeout: 60000,
      }
    );
    console.log(xmlPayload)
console.log(response.data)
 

    const parsed = await parseStringPromise(response.data, { explicitArray: false });
    res.send(response.data);
  } catch (err) {
       console.log("xm" , xmlPayload)
    console.error("Crane OTA Error:", err);
    res.status(500).json({ error: "Failed to fetch availability", details: err.message });
  }
};

module.exports = {
  getAvailability,
};
