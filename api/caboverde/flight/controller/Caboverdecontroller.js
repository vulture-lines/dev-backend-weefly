require("dotenv").config();
const axios = require("axios");
const { Builder } = require("xml2js");
const { parseStringPromise } = require("xml2js");

const getAvailability = async (req, res) => {
  const username = process.env.API_USERNAME;
  const password = process.env.API_PASSWORD;

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
            clientIP: "129.0.0.1",
            member: false,
            password: password,
            userName: username,
            preferredCurrency: "CVE",
          },
          originDestinationInformationList: {
            dateOffset: 0,
            departureDateTime: "2025-10-10",
            destinationLocation: { locationCode: "LIS" },
            originLocation: { locationCode: "RAI" },
            flexibleFaresOnly: false,
            includeInterlineFlights: false,
            openFlight: false,
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
      "https://tcv-stage.crane.aero/craneota/CraneOTAService",
      xmlPayload,
      {
        headers: {
          "Content-Type": "text/xml;charset=UTF-8",
          SOAPAction: "", // Usually empty for Crane, unless explicitly required
        },
        timeout: 60000,
      }
    );

 

    const parsed = await parseStringPromise(response.data, { explicitArray: false });
    res.json(parsed);
  } catch (err) {
       console.log("xm" , xmlPayload)
    console.error("Crane OTA Error:", err);
    res.status(500).json({ error: "Failed to fetch availability", details: err.message });
  }
};

module.exports = {
  getAvailability,
};
