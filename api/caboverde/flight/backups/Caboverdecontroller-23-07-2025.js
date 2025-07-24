require("dotenv").config();
const axios = require("axios");
const { Builder } = require("xml2js");
const { parseStringPromise } = require("xml2js");
const {buildBookFlightSegmentList,transformAvailabilityToFlightList}=require("../utils/Parser")

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
    let bookingSegments;
    let flightList = transformAvailabilityToFlightList(parsed);
    try {
      bookingSegments = buildBookFlightSegmentList(parsed, 0, 0, 0);
      // console.log(JSON.stringify(bookingSegments, null, 2));
    } catch (error) {
      console.log(error);
    }

    res.json({
      rawResponse: parsed,
      bookingSegment: bookingSegments,
      flightList: flightList,
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

  const { preferredCurrency = "CVE", bookingSegment = [] } = req.body;

  if (
    !Array.isArray(bookingSegment) ||
    bookingSegment.length === 0
  ) {
    return res
      .status(400)
      .json({ error: "Invalid or missing bookingSegment" });
  }

  const builder = new Builder({ headless: true });

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
              userName: username,
              password: password,
              clientIP: (
                req.ip ||
                req.connection.remoteAddress ||
                "unknown"
              ).replace(/^::ffff:/, ""),
              preferredCurrency,
            },
            bookingSegment: bookingSegment.map((segment) => {
              const fs = segment.flightSegment || {};
              const fi = segment.fareInfo || {};
              const bc = segment.bookingClass;

              // Normalize booking class
              const normalizedBookingClass = Array.isArray(bc)
                ? bc
                : [
                    {
                      resBookDesigCode: fi.resBookDesigCode || "Y",
                      resBookDesigQuantity:
                        bc?.resBookDesigQuantity?.[0] || "1",
                    },
                  ];

              return {
                flightSegment: {
                  flightSegmentID: fs.flightSegmentID,
                  flightNumber: fs.flightNumber,
                  airlineCode: fs.airline?.code,
                  departureAirportCode: fs.departureAirport?.locationCode,
                  arrivalAirportCode: fs.arrivalAirport?.locationCode,
                  departureDateTime: fs.departureDateTime,
                  arrivalDateTime: fs.arrivalDateTime,
                },
                fareInfo: {
                  cabin: fi.cabin,
                  fareReferenceCode: fi.fareReferenceCode,
                  fareReferenceID: fi.fareReferenceID,
                  fareReferenceName: fi.fareReferenceName,
                  resBookDesigCode: fi.resBookDesigCode,
                  flightSegmentSequence: fi.flightSegmentSequence,
                },
                bookingClass: normalizedBookingClass.map((b) => ({
                  resBookDesigCode: b.resBookDesigCode || "Y",
                  resBookDesigQuantity: b.resBookDesigQuantity || "1",
                })),
              };
            }),
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

    const parsed = await parseStringPromise(response.data, {
      explicitArray: false,
    });

    res.json({
      rawXml: response.data,
      parsed,
    });
  } catch (error) {
    console.error("GetAirExtraChargesAndProducts Error:", error);
    res.status(500).json({
      error: "Failed to get extra charges and products",
      details: error.message,
    });
  }
};

module.exports = {
  getAvailability,
  getExtraChargesAndProducts,
};
