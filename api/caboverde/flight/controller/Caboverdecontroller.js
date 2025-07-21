require("dotenv").config();
const axios = require("axios");
const { Builder } = require("xml2js");
const { parseStringPromise } = require("xml2js");

const getAvailability = async (req, res) => {
  const username = process.env.API_USERNAME_CABOVERDE;
  const password = process.env.API_PASSWORD_CABOVERDE;

  const builder = new Builder({ headless: true });

  const {
    tripType,
    preferredCurrency,
    passengers,
    segments = [
      {
        departureDateTime,
        originLocationCode,
        destinationLocationCode,
        dateOffset: 0,
        includeInterlineFlights: true,
        openFlight: true,
        flexibleFaresOnly: false,
      },
    ],
    xmllog,
  } = req.body;

  // Build originDestinationInformationList dynamically
  const originDestinationInformationList = segments.map((seg) => ({
    dateOffset: seg.dateOffset || 0,
    departureDateTime: seg.departureDateTime,
    destinationLocation: { locationCode: seg.destinationLocationCode },
    flexibleFaresOnly: seg.flexibleFaresOnly || false,
    includeInterlineFlights: seg.includeInterlineFlights || false,
    originLocation: { locationCode: seg.originLocationCode },
    openFlight: seg.openFlight || false,
  }));

  // Build passenger list
  const passengerTypeQuantityList = passengers.map((pax) => ({
    hasStrecher: "",
    passengerType: { code: pax.code },
    quantity: pax.quantity,
  }));

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
              clientIP: (
                req.ip ||
                req.connection.remoteAddress ||
                "unknown"
              ).replace(/^::ffff:/, ""),
              member: false,
              password: password,
              userName: username,
              preferredCurrency: preferredCurrency,
            },
            originDestinationInformationList,
            travelerInformation: {
              passengerTypeQuantityList,
            },
            tripType,
          },
        },
        "impl:GetAirAvailability": "",
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
          SOAPAction: "",
        },
        timeout: 60000,
      }
    );
    if (xmllog) {
      return res.send(xmlPayload);
    }

    const parsed = await parseStringPromise(response.data, {
      explicitArray: false,
    });

    // Return raw XML for now, you can adapt this to return parsed JSON if needed
    res.send(response.data);
  } catch (err) {
    console.error("Crane OTA Error:", err);
    res
      .status(500)
      .json({ error: "Failed to fetch availability", details: err.message });
  }
};

module.exports = {
  getAvailability,
};
