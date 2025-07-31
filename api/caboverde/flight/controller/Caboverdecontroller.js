require("dotenv").config();
const axios = require("axios");
const { Builder } = require("xml2js");
const { parseStringPromise } = require("xml2js");
const { extractBookFlightSegmentList } = require("../utils/Parser");

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
    xmlreq,
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
    if (xmllog && xmlreq) {
      return res.send(xmlPayload);
    }

    const parsed = await parseStringPromise(response.data, {
      explicitArray: false,
    });
    if (xmllog) {
      // Return raw XML for now, you can adapt this to return parsed JSON if needed
      return res.send(response.data);
    }
    res.json({
      rawResponse: parsed,
    });
  } catch (err) {
    console.error("Crane OTA Error:", err);
    res
      .status(500)
      .json({ error: "Failed to fetch availability", details: err.message });
  }
};

const getExtraChargesAndProducts = async (req, res) => {
  const username = process.env.API_USERNAME_CABOVERDE;
  const password = process.env.API_PASSWORD_CABOVERDE;

  const builder = new Builder({ headless: true });

  const {
    preferredCurrency,
    tripType,
    journeyStartLocationCode,
    passengers,
    bookFlightSegmentList,
    xmllog,
    xmlreq,
  } = req.body;

  // Build passenger list
  const passengerTypeQuantityList = passengers.map((pax) => ({
    hasStrecher: "",
    passengerType: { code: pax.code },
    quantity: pax.quantity,
  }));

  // Build full XML payload
  const xmlPayload = builder.buildObject({
    "soapenv:Envelope": {
      $: {
        "xmlns:soapenv": "http://schemas.xmlsoap.org/soap/envelope/",
        "xmlns:impl": "http://impl.soap.ws.crane.hititcs.com/",
      },
      "soapenv:Header": {},
      "soapenv:Body": {
        "impl:GetAirExtraChargesAndProducts": {
          AirExtraChargesAndProductsRequest: {
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
            bookFlightSegmentList,
            journeyStartLocation: {
              locationCode: journeyStartLocationCode,
            },
            travelerInformation: {
              passengerTypeQuantityList,
            },
            tripType,
          },
        },
      },
    },
  });

      if (xmllog && xmlreq) {
      return res.send(xmlPayload);
    }
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



    const parsed = await parseStringPromise(response.data, {
      explicitArray: false,
    });

    if (xmllog) {
      return res.send(response.data);
    }

    res.json({
      rawResponse: parsed,
    });
  } catch (err) {
    console.error("Crane OTA Error:", err);
    res
      .status(500)
      .json({ error: "Failed to fetch extra charges", details: err.message });
  }
};

const createBooking = async (req, res) => {
  const username = process.env.API_USERNAME_CABOVERDE;
  const password = process.env.API_PASSWORD_CABOVERDE;

  const builder = new Builder({ headless: true });

  const {
    preferredCurrency,
    tripType,
    airTravelerList,
    bookFlightSegmentList,
    specialRequestDetails = [],
    xmllog,
    xmlreq,
  } = req.body;

  // Convert SSRs to XML-friendly format
  const specialServiceRequestList = specialRequestDetails.map((ssr) => ({
    airTravelerSequence: 1,
    flightSegmentSequence: 0,
    paymentStatus: "FR",
    SSR: {
      allowedQuantityPerPassenger: 1,
      code: ssr.code,
      explanation: ssr.explanation,
      groupCode: "OTH",
      groupCodeExplanation: "OTH",
      free: true,
      refundable: false,
      exchangeable: false,
      bundleRelatedSsr: false,
      ssrReasonCode: "USER_SELECTION",
      unitOfMeasureExist: false,
      extraBaggage: false,
      iciAllowed: false,
      showOnItinerary: false
    },
    serviceQuantity: 1,
    status: "HK",
    ticketed: false
  }));

  const envelope = {
    "soapenv:Envelope": {
      $: {
        "xmlns:soapenv": "http://schemas.xmlsoap.org/soap/envelope/",
        "xmlns:impl": "http://impl.soap.ws.crane.hititcs.com/"
      },
      "soapenv:Header": {},
      "soapenv:Body": {
        "impl:CreateBooking": {
          AirBookingRequest: {
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
            tripType,
            airTravelerList,
            bookFlightSegmentList,
            specialRequestDetails: {
              specialServiceRequestList
            }
          }
        }
      }
    }
  };

  const xmlPayload = builder.buildObject(envelope);

  try {
    const response = await axios.post(
      "https://tcv-stage.crane.aero/craneota/CraneOTAService?wsdl",
      xmlPayload,
      {
        headers: {
          "Content-Type": "text/xml;charset=UTF-8",
          SOAPAction: ""
        },
        timeout: 60000
      }
    );

    if (xmllog && xmlreq) return res.send(xmlPayload);
    if (xmllog) return res.send(response.data);

    const parsed = await parseStringPromise(response.data, {
      explicitArray: false
    });

    res.json({
      rawResponse: parsed
    });
  } catch (err) {
    console.error("Create Booking Error:", err.message);
    res.status(500).json({
      error: "Failed to create booking",
      details: err.message
    });
  }
};



const getSeatMap = async (req, res) => {
  const username = process.env.API_USERNAME_CABOVERDE;
  const password = process.env.API_PASSWORD_CABOVERDE;

  const builder = new Builder({ headless: true });

  const {
    preferredCurrency,
    flightSegment,
    bookingReferenceID,
    xmllog,
    xmlreq,
  } = req.body;

  const xmlPayload = builder.buildObject({
    "soapenv:Envelope": {
      $: {
        "xmlns:soapenv": "http://schemas.xmlsoap.org/soap/envelope/",
        "xmlns:impl": "http://impl.soap.ws.crane.hititcs.com/",
      },
      "soapenv:Header": {},
      "soapenv:Body": {
        "impl:GetSeatMap": {
          AncillaryOtaSeatMapRequest: {
            clientInformation: {
              clientIP: (req.ip || req.connection.remoteAddress || "unknown").replace(/^::ffff:/, ""),
              member: false,
              password: password,
              userName: username,
              preferredCurrency: preferredCurrency || "CVE",
            },
            flightSegment,
            frequentFlyerRedemption: {},
            bookingReferenceID,
          },
        },
      },
    },
  });

  try {
    const response = await axios.post(
      "https://tcv-stage.crane.aero/craneota/CraneAncillaryOTAService?wsdl",
      xmlPayload,
      {
        headers: {
          "Content-Type": "text/xml;charset=UTF-8",
          SOAPAction: "",
        },
        timeout: 60000,
      }
    );

    if (xmllog && xmlreq) {
      return res.send(xmlPayload);
    }

    const parsed = await parseStringPromise(response.data, {
      explicitArray: false,
    });

    if (xmllog) {
      return res.send(response.data);
    }

    res.json({
      rawResponse: parsed,
    });
  } catch (err) {
    console.error("Crane OTA SeatMap Error:", err);
    res.status(500).json({
      error: "Failed to fetch seat map",
      details: err.message,
    });
  }
};


const getAvailableSpecialServices = async (req, res) => {
  const username = process.env.API_USERNAME_CABOVERDE;
  const password = process.env.API_PASSWORD_CABOVERDE;

  const builder = new Builder({ headless: true });

  const {
    preferredCurrency = "CVE",
    bookingReferenceID = {},
    xmllog = false,
    xmlreq = false,
  } = req.body;

  const {
    ID = "12S5B1",
    referenceID = "13898148",
    companyName = {},
  } = bookingReferenceID;

  const {
    cityCode = "SID",
    code = "VR",
    codeContext = "CRANE",
    companyFullName = "Hitit Admin",
    companyShortName = "Hitit Admin",
    countryCode = "CV",
  } = companyName;

  const clientIP =
    (req.ip || req.connection?.remoteAddress || "129.0.0.1").replace(
      /^::ffff:/,
      ""
    );

  const xmlPayload = builder.buildObject({
    "soapenv:Envelope": {
      $: {
        "xmlns:soapenv": "http://schemas.xmlsoap.org/soap/envelope/",
        "xmlns:impl": "http://impl.soap.ws.crane.hititcs.com/",
      },
      "soapenv:Header": {},
      "soapenv:Body": {
        "impl:GetAvailableSpecialServices": {
          AncillaryOtaSsrAvailRequest: {
            clientInformation: {
              clientIP,
              member: false,
              password,
              userName: username,
              preferredCurrency,
            },
            bookingReferenceID: {
              companyName: {
                cityCode,
                code,
                codeContext,
                companyFullName,
                companyShortName,
                countryCode,
              },
              ID,
              referenceID,
            },
            cabinUpgradeAvailable: "",
            frequentFlyerRedemption: "",
          },
        },
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

    if (xmllog && xmlreq) {
      return res.send(xmlPayload);
    }

    const parsed = await parseStringPromise(response.data, {
      explicitArray: false,
    });

    if (xmllog) {
      return res.send(response.data);
    }

    res.json({ rawResponse: parsed });
  } catch (err) {
    console.error("Crane SSR Availability Error:", err.message);
    res.status(500).json({
      error: "Failed to fetch special service availability",
      details: err.message,
    });
  }
};


module.exports = {
  getAvailability,
  getExtraChargesAndProducts,
  createBooking,
  getSeatMap,
  getAvailableSpecialServices
};
