// controllers/searchController.js
require("dotenv").config();
const axios = require("axios");
const { Builder } = require("xml2js");
const { parseStringPromise } = require("xml2js");
const geoip = require("geoip-lite");
// const { fetchLoginID } = require("../../Loginidgenerator"); // Import the login function
const cache = require("../../../utils/Cache");
const travelFusionUrl = process.env.TRAVEL_FUSION_API_URL;
const loginId = process.env.XML_LOGIN_ID;
const getBranchSupplierList = async (req, res) => {
  try {
    // const loginId = await fetchLoginID();

    // build the XML structure
    const builder = new Builder({ headless: true });

    const requestObj = {
      CommandList: {
        GetBranchSupplierList: {
          XmlLoginId: loginId,
          LoginId: loginId,
        },
      },
    };

    const requestXml = builder.buildObject(requestObj);

    // send it to Travelfusion
    const response = await axios.post(travelFusionUrl, requestXml, {
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        "Accept-Encoding": "gzip, deflate",
        Accept: "text/xml",
        "Accept-Encoding": "gzip, deflate",
      },
      timeout: 120000,
    });

    // parse the XML response to JS
    const parsed = await parseStringPromise(response.data);

    res.status(200).json(parsed);
  } catch (err) {
    console.error("GetBranchSupplierList Error:", err.message);
    res.status(500).json({ error: err.message });
  }
};

const startRouting = async (req, res) => {
  try {
    const {
      mode = "plane",
      origin,
      destination,
      dateOfSearch,
      returnDateOfSearch,
      timeout = 40,
      travellers = [],
      incrementalResults = true,
      travelClass,
      xmllog,
      xmlreq,
      location,
      maxChanges = 1,
      maxHops = 2,
    } = req.body;

    const preferredLanguage = "EN";
    if (!origin || !destination || !dateOfSearch || travellers.length === 0) {
      return res.status(422).json({ error: "Missing required fields" });
    }
    let countryCode;
    if (location) {
    }

    // const loginId = await fetchLoginID();
    const builder = new Builder({ headless: true });

    const startRoutingObj = {
      CommandList: {
        StartRouting: {
          XmlLoginId: loginId,
          LoginId: loginId,
          Mode: mode,
          Origin: {
            Descriptor: origin.descriptor,
            Type: "airportcode",
            Radius: 1000,
          },
          Destination: {
            Descriptor: destination.descriptor,
            Type: "airportcode",
            Radius: 1000,
          },
          OutwardDates: {
            DateOfSearch: dateOfSearch,
          },
          ...(returnDateOfSearch && {
            ReturnDates: {
              DateOfSearch: returnDateOfSearch,
            },
          }),
          MaxChanges: maxChanges,
          MaxHops: maxHops,
          Timeout: timeout,
          TravellerList: {
            Traveller: travellers.map((age) => ({ Age: age })),
          },
          IncrementalResults: incrementalResults,
          ...(travelClass && { SupplierClass: travelClass }),
          BookingProfile: {
            CustomSupplierParameterList: {
              CustomSupplierParameter: [
                { Name: "IncludeStructuredFeatures", Value: "y" },
                {
                  Name: "EndUserDeviceMACAddress",
                  Value: req.headers["x-edusermacaddress"] || "not-mac",
                },
                {
                  Name: "EndUserIPAddress",
                  Value: (
                    req.ip ||
                    req.connection.remoteAddress ||
                    "unknown"
                  ).replace(/^::ffff:/, ""),
                },
                {
                  Name: "EndUserBrowserAgent",
                  Value: req.headers["user-agent"] || "unknown",
                },
                {
                  Name: "RequestOrigin",
                  Value:
                    req.headers["origin"] ||
                    req.headers["referer"] ||
                    "postman",
                },
                {
                  Name: "Pointofsale",
                  Value: countryCode || "CV",
                },

                ...(preferredLanguage
                  ? [{ Name: "PreferredLanguage", Value: preferredLanguage }]
                  : []),
              ],
            },
          },
        },
      },
    };

    const routingXml = builder.buildObject(startRoutingObj);

    let response;

    try {
      // First attempt with 4s timeout
      response = await axios.post(travelFusionUrl, routingXml, {
        headers: {
          "Content-Type": "text/xml; charset=utf-8",
          Accept: "text/xml",
          "Accept-Encoding": "gzip, deflate",
        },
        timeout: 4000,
      });
    } catch (err) {
      if (err.code === "ECONNABORTED") {
        // Retry with 15s timeout
        try {
          response = await axios.post(travelFusionUrl, routingXml, {
            headers: {
              "Content-Type": "text/xml; charset=utf-8",
              Accept: "text/xml",
              "Accept-Encoding": "gzip, deflate",
            },
            timeout: 15000,
          });
        } catch (retryErr) {
          console.error("Retry failed:", retryErr.message);
          return res.status(504).json({ error: "Timeout on both attempts" });
        }
      } else {
        throw err;
      }
    }

    if (xmllog === "yes" && xmlreq === "yes") {
      return res.status(200).send(routingXml);
    } else if (xmllog == "yes") {
      return res.status(200).send(response.data);
    }

    const parsed = await parseStringPromise(response.data);
    const startRoutingResponse = parsed?.CommandList?.StartRouting?.[0];

    if (!startRoutingResponse?.RoutingId?.[0]) {
      return res.status(422).json({
        error: "No RoutingId returned",
        requestdata: response.data,
      });
    }

    res.status(200).json({
      routingId: startRoutingResponse.RoutingId[0],
    });
  } catch (err) {
    console.error("StartRouting Error:", err);
    res.status(500).json({ error: err.message });
  }
};

const checkRouting = async (req, res) => {
  try {
    const { routingId, xmllog, xmlreq } = req.body;
    if (!routingId) {
      return res.status(422).json({ error: "RoutingId is required" });
    }

    let flightList = [];
    let routeId = "";
    let hasIncomplete = true;
    let parsed;
    let checkRoutingXml;
    let xmlresponse;

    while (hasIncomplete) {
      // const loginId = await fetchLoginID(); // new login ID each time

      checkRoutingXml = new Builder({ headless: true }).buildObject({
        CommandList: {
          CheckRouting: {
            XmlLoginId: loginId,
            LoginId: loginId,
            RoutingId: routingId,
          },
        },
      });

      try {
        const response = await axios.post(travelFusionUrl, checkRoutingXml, {
          headers: {
            "Content-Type": "text/xml; charset=utf-8",
            Accept: "text/xml",
            "Accept-Encoding": "gzip, deflate",
          },
          timeout: 7000, // 7-second read timeout
        });

        xmlresponse = response.data;
        parsed = await parseStringPromise(response.data);

        const checkRoutingResponse = parsed?.CommandList?.CheckRouting?.[0];
        routeId = checkRoutingResponse?.RoutingId;
        flightList = checkRoutingResponse?.RouterList;

        hasIncomplete = (flightList || []).some(
          (router) => router?.Router?.Complete?.[0]?.toLowerCase() === "false"
        );
      } catch (err) {
        if (err.code === "ECONNABORTED") {
          console.warn("CheckRouting timeout — continuing polling loop");
          // Assume incomplete and continue loop
          hasIncomplete = true;
          continue;
        } else {
          throw err; // For other errors, break the loop and return error
        }
      }
    }

    if (xmllog === "yes" && xmlreq === "yes") {
      return res.status(200).send(checkRoutingXml);
    } else if (xmllog === "yes") {
      return res.status(200).send(xmlresponse);
    }
    if (flightList) {
      return res
        .status(200)
        .json({ routingId: routeId, flightList: flightList });
    } else {
      return res
        .status(204)
        .json({ message: "No flights available for the routeId" });
    }
  } catch (err) {
    console.error("CheckRouting Error:", err.message);
    res.status(500).json({ error: err.message });
  }
};

const processDetails = async (req, res) => {
  try {
    const { routingId, outwardId, returnId = null, xmllog, xmlreq } = req.body;

    if (!routingId || !outwardId) {
      return res
        .status(422)
        .json({ error: "RoutingId and OutwardId are required" });
    }

    // const loginId = await fetchLoginID();

    const requestObj = {
      CommandList: {
        ProcessDetails: {
          XmlLoginId: loginId,
          LoginId: loginId,
          RoutingId: routingId,
          OutwardId: outwardId,
          ...(returnId && { ReturnId: returnId }),
          HandoffParametersOnly: false,
          BookingProfile: {
            CustomSupplierParameterList: {
              CustomSupplierParameter: [
                {
                  Name: "IncludeAlternativeFares",
                  Value: "y",
                },
              ],
            },
          },
        },
      },
    };

    const builder = new Builder({ headless: true });
    const xml = builder.buildObject(requestObj);

    const response = await axios.post(travelFusionUrl, xml, {
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        Accept: "text/xml",
        "Accept-Encoding": "gzip, deflate",
      },
      timeout: 150000,
    });

    if (xmllog === "yes" && xmlreq === "yes") {
      return res.status(200).send(xml);
    } else if (xmllog == "yes") {
      return res.status(200).send(response.data);
    }

    const parsed = await parseStringPromise(response.data);
    const processResponse = parsed?.CommandList?.ProcessDetails?.[0];
    // if (processResponse) {
    //   res.status(200).json({ processResponse });
    // } else {
    //   res.status(200).send(response.data);
    // }

    // return res.status(200).json({ processResponse });

    // return res.status(200).json({ processResponse });
    const router = processResponse?.Router?.[0];
    const requiredParameterList = router?.RequiredParameterList || [];
    const groupList = router?.GroupList || [];
    const routeid = processResponse?.RoutingId?.[0] || null;
    const supportedCardlist =
      processResponse?.SupportedCardList?.[0].SupportedCard?.[0];
    const AlternativeFares = router?.AlternativeFares?.[0];
    const Features = router?.Features?.[0];
    res.status(200).json({
      routeid,
      requiredParameterList,
      groupList,
      supportedCardlist,
      AlternativeFares,
      Features,
    });
  } catch (err) {
    console.error("ProcessDetails Error:", err.message);
    res.status(500).json({ error: err.message });
  }
};

const processTerms = async (req, res) => {
  try {
    const {
      mode = "plane",
      routingId,
      bookingProfile,
      seatOptions = [],
      luggageOptions = [],
      outwardLuggageOptions = [],
      returnLuggageOptions = [],
      mealTypes=[],
      outwardId,
      returnId = null,
      countryOfUser,
      xmlreq,
      xmllog,
      useTFPay,
    } = req.body;

    if (!routingId || !bookingProfile) {
      return res.status(422).json({
        error: "routingId and bookingProfile are required",
      });
    }

    // const loginId = await fetchLoginID();

    const {
      ContactDetails: {
        Email,
        MobilePhone,
        Name: { Title, NamePartList },
      } = {},
    } = bookingProfile;

    const phone = MobilePhone
      ? `${MobilePhone.InternationalCode || ""}${MobilePhone.AreaCode || ""}${
          MobilePhone.Number || ""
        }`
      : "";

    const nameParts = Array.isArray(NamePartList?.NamePart)
      ? NamePartList.NamePart.join(" ")
      : "";
    const fullName = `${Title || ""} ${nameParts}`.trim();
    const userData = `${Email || ""}, ${phone || ""}, ${fullName}`;

    // Handle travellers
    let travellers = bookingProfile.TravellerList?.Traveller || [];
    if (!Array.isArray(travellers)) {
      travellers = [travellers];
    }

    travellers = travellers.map((traveller, index) => {
      const seat = seatOptions[index] || "";
      const outwardLuggage = outwardLuggageOptions[index] || "";
      const returnLuggage = returnLuggageOptions[index] || "";
      const luggage = luggageOptions[index] || "";
      const mealType = mealTypes?.[index] || "";
      let csps =
        traveller.CustomSupplierParameterList?.CustomSupplierParameter || [];

      if (!Array.isArray(csps)) {
        csps = [csps];
      }

      if (seat) {
        csps.push({ Name: "SeatOptions", Value: `${seat}` });
      }

      if (luggage) {
        csps.push({ Name: "LuggageOptions", Value: luggage });
      } else {
        if (outwardLuggage) {
          csps.push({ Name: "OutwardLuggageOptions", Value: outwardLuggage });
        }
        if (returnLuggage) {
          csps.push({ Name: "ReturnLuggageOptions", Value: returnLuggage });
        }
      }
            if (mealType) {
        csps.push({ Name: "MealType", Value: mealType });
      }

      return {
        ...traveller,
        CustomSupplierParameterList: {
          CustomSupplierParameter: csps,
        },
      };
    });

    // Build global CSPs
    const globalCSPs = [
      {
        Name: "EndUserDeviceMACAddress",
        Value: req.headers["x-edusermacaddress"] || "not-mac",
      },
      {
        Name: "EndUserIPAddress",
        Value: (req.ip || req.connection?.remoteAddress || "unknown").replace(
          /^::ffff:/,
          ""
        ),
      },
      {
        Name: "EndUserBrowserAgent",
        Value: req.headers["user-agent"] || "unknown",
      },
      {
        Name: "RequestOrigin",
        Value: req.headers["origin"] || req.headers["referer"] || "postman",
      },
      { Name: "UserData", Value: userData },
    ];

    if (countryOfUser) {
      globalCSPs.push({
        Name: "CountryOfTheUser",
        Value: countryOfUser,
      });
    }
    if (useTFPay === "yes") {
      globalCSPs.push({
        Name: "UseTFPrepay",
        Value: "Always",
      });
    }

    // ✅ Rebuild bookingProfileObj with CSPs first
    const bookingProfileObj = {
      CustomSupplierParameterList: {
        CustomSupplierParameter: globalCSPs,
      },
      TravellerList: {
        Traveller: travellers,
      },
      ContactDetails: bookingProfile.ContactDetails,
      BillingDetails: bookingProfile.BillingDetails,
      // Add more fields here if necessary
    };

    // Final ProcessTerms object
    const processTermsObj = {
      XmlLoginId: loginId,
      LoginId: loginId,
      Mode: mode,
      RoutingId: routingId,
      OutwardId: outwardId,
      ...(returnId ? { ReturnId: returnId } : {}),
      BookingProfile: bookingProfileObj,
    };

    const requestObj = {
      CommandList: {
        ProcessTerms: processTermsObj,
      },
    };

    // Convert to XML
    const builder = new Builder({ headless: true });
    const xml = builder.buildObject(requestObj);

    // Send XML to TravelFusion
    const response = await axios.post(travelFusionUrl, xml, {
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        Accept: "text/xml",
        "Accept-Encoding": "gzip, deflate",
      },
      timeout: 150000,
    });

    // Logging/Return options
    if (xmllog === "yes" && xmlreq === "yes") {
      return res.status(200).send(xml);
    } else if (xmllog === "yes") {
      return res.status(200).send(response.data);
    }

    const parsed = await parseStringPromise(response.data);
    const termsResponse = parsed?.CommandList?.ProcessTerms?.[0];

    if (termsResponse && Object.keys(termsResponse).length > 0) {
      res.status(200).json({ data: termsResponse });
    } else {
      let parsed = await parseStringPromise(response.data);
      const error =
        parsed?.CommandList?.CommandExecutionFailure?.[0]?.ProcessTerms?.[0]?.$;
      if (error?.ecode === "2-2460") {
        return res.status(422).json({ error: error });
      } if(error?.ecode==="2-2435"){
        return res.status(422).json({ error: error });
      } if(error?.ecode==="3-3044"){
        return res.status(409).json({ error: error });
      }
      res.status(200).send(response.data);
    }
  } catch (err) {
    console.error("ProcessTerms Error:", err.message);
    res.status(500).json({ error: err.message });
  }
};

const startBooking = async (req, res) => {
  try {
    const {
      expectedAmount,
      expectedCurrency,
      TFBookingReference,
      fakeBooking = true,
      xmlreq,
      xmllog,
    } = req.body;

    // const loginId = await fetchLoginID();
    if (!TFBookingReference && !expectedAmount && !expectedCurrency) {
      return res.status(422).json({ error: "Missing required parameters" });
    }
    const builder = new Builder({ headless: true });

    const startBookingObj = {
      CommandList: {
        StartBooking: {
          XmlLoginId: loginId,
          LoginId: loginId,
          TFBookingReference: TFBookingReference,
          ExpectedPrice: {
            Amount: expectedAmount,
            Currency: expectedCurrency,
          },
          ...(fakeBooking && {
            FakeBooking: {
              EnableFakeBooking: true,
              FakeBookingSimulatedDelaySeconds: 0,
              FakeBookingStatus: "Succeeded",
            },
          }),
        },
      },
    };

    const xml = builder.buildObject(startBookingObj);

    if (xmllog === "yes" && xmlreq === "yes") {
      return res.status(200).send(xml);
    }

    const response = await axios.post(travelFusionUrl, xml, {
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        Accept: "text/xml",
        "Accept-Encoding": "gzip, deflate",
      },
      timeout: 20000,
    });
    if (xmllog == "yes") {
      return res.status(200).send(response.data);
    }
    console.log(xml);
    const parsed = await parseStringPromise(response.data);
    const result = parsed?.CommandList?.StartBooking?.[0];
    if (result) {
      res.status(200).json({
        bookingReference: result?.TFBookingReference?.[0],
        routerInfo: result?.Router,
      });
    } else {
      return res.status(200).send(response.data);
    }
  } catch (err) {
    console.error("StartBooking Error:", err.message);
    res.status(500).json({ error: err.message });
  }
};

const checkBooking = async (req, res) => {
  try {
    const { TFBookingReference, xmllog, xmlreq } = req.body;
    if (!TFBookingReference) {
      return res.status(422).json({ error: "TFBookingReference is required" });
    }

    // const loginId = await fetchLoginID();
    const builder = new Builder({ headless: true });

    const checkBookingObj = {
      CommandList: {
        CheckBooking: {
          XmlLoginId: loginId,
          LoginId: loginId,
          TFBookingReference: TFBookingReference,
        },
      },
    };

    const xml = builder.buildObject(checkBookingObj);

    let response;
    try {
      response = await axios.post(travelFusionUrl, xml, {
        headers: {
          "Content-Type": "text/xml; charset=utf-8",
          Accept: "text/xml",
          "Accept-Encoding": "gzip, deflate",
        },
        timeout: 10000,
      });
    } catch (error) {
      if (error.code === "ECONNABORTED") {
        // Timeout occurred – return a specific response or trigger retry logic
        console.warn("CheckBooking timed out, continuing polling...");
        return res.status(202).json({
          message: "Timeout occurred. Continue polling.",
        });
      } else {
        throw error; // rethrow other errors
      }
    }

    if (xmllog === "yes" && xmlreq === "yes") {
      return res.status(200).send(xml);
    } else if (xmllog === "yes") {
      return res.status(200).send(response.data);
    }

    const parsed = await parseStringPromise(response.data);
    const result = parsed?.CommandList?.CheckBooking?.[0];

    res.status(200).json({
      bookingReference: result?.TFBookingReference?.[0],
      bookingStatus: result?.BookingStatus?.[0],
      additionalInfo: result,
    });
  } catch (err) {
    console.error("CheckBooking Error:", err.message);
    res.status(500).json({ error: err.message });
  }
};

const getBookingDetails = async (req, res) => {
  try {
    const { TFBookingReference, xmllog, xmlreq } = req.body;
    // const loginId = await fetchLoginID();
    if (!TFBookingReference) {
      return res.status(400).json({ error: "TFBookingReference is required" });
    }
    const builder = new Builder({ headless: true });

    const getBookingObj = {
      CommandList: {
        GetBookingDetails: {
          XmlLoginId: loginId,
          LoginId: loginId,
          TFBookingReference: TFBookingReference,
        },
      },
    };

    const xml = builder.buildObject(getBookingObj);

    const response = await axios.post(travelFusionUrl, xml, {
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        Accept: "text/xml",
        "Accept-Encoding": "gzip, deflate",
      },
      timeout: 120000,
    });

    if (xmllog === "yes" && xmlreq === "yes") {
      return res.status(200).send(xml);
    } else if (xmllog == "yes") {
      return res.status(200).send(response.data);
    }
    const parsed = await parseStringPromise(response.data);

    // const result = parsed?.CommandList?.CheckBooking?.[0];

    res.status(200).json({
      Bookingdetails: parsed,
    });
  } catch (err) {
    console.error("CheckBooking Error:", err.message);
    res.status(500).json({ error: err.message });
  }
};

const getBookingDetailsForCancellation = async (req, res) => {
  try {
    const { TFBookingReference, customParams = [] } = req.body;

    if (!TFBookingReference) {
      return res.status(422).json({ error: "TFBookingReference is required" });
    }

    // const loginId = await fetchLoginID();
    const customSupplierParams = [
      {
        Name: "IsBookingForCancellation",
        Value: "true",
      },
      ...customParams,
    ];

    const requestObj = {
      CommandList: {
        GetBookingDetails: {
          XmlLoginId: loginId,
          LoginId: loginId,
          TFBookingReference: TFBookingReference,
          BookingProfile: {
            CustomSupplierParameterList: {
              CustomSupplierParameter: customSupplierParams,
            },
          },
        },
      },
    };

    const builder = new Builder({ headless: true });
    const xml = builder.buildObject(requestObj);
    const response = await axios.post(travelFusionUrl, xml, {
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        Accept: "text/xml",
        "Accept-Encoding": "gzip, deflate",
      },
      timeout: 120000,
    });

    const parsed = await parseStringPromise(response.data);
    const bookingDetails = parsed?.CommandList?.GetBookingDetails?.[0];
    if (bookingDetails === "") {
      res.status(200).json({ data: bookingDetails });
    } else {
      res.status(400).send(response.data);
    }
  } catch (err) {
    console.error("GetBookingDetails Error:", err.message);
    res.status(500).json({ error: err.message });
  }
};

const startBookingCancelPlane = async (req, res) => {
  try {
    const { TFBookingReference, customSupplierParameters = [] } = req.body;

    if (!TFBookingReference) {
      return res.status(422).json({
        error: "TFBookingReference is required",
      });
    }

    // const loginId = await fetchLoginID();

    // Build BookingProfile with optional CustomSupplierParameters
    let bookingProfile = undefined;

    if (customSupplierParameters.length > 0) {
      bookingProfile = {
        CustomSupplierParameterList: {
          CustomSupplierParameter: customSupplierParameters.map((param) => ({
            Supplier: param.supplier,
            Name: param.name,
            Value: param.value,
          })),
        },
      };
    }

    const requestObj = {
      CommandList: {
        StartBookingCancelPlane: {
          XmlLoginId: loginId,
          LoginId: loginId,
          TFBookingReference: TFBookingReference,
          ...(bookingProfile ? { BookingProfile: bookingProfile } : {}),
        },
      },
    };

    const builder = new Builder({ headless: true });
    const xml = builder.buildObject(requestObj);

    const response = await axios.post(travelFusionUrl, xml, {
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        Accept: "text/xml",
        "Accept-Encoding": "gzip, deflate",
      },
      timeout: 120000,
    });
    res.status(200).json({
      message: "Cancellation request started",
      rawResponse: response.data,
    });
  } catch (err) {
    console.error("StartBookingCancelPlane Error:", err.message);
    res.status(500).json({ error: err.message });
  }
};

const checkBookingCancelPlane = async (req, res) => {
  try {
    const { TFBookingReference } = req.body;

    if (!TFBookingReference) {
      return res.status(422).json({
        error: "TFBookingReference is required",
      });
    }

    // const loginId = await fetchLoginID();

    const requestObj = {
      CommandList: {
        CheckBookingCancelPlane: {
          XmlLoginId: loginId,
          LoginId: loginId,
          TFBookingReference: TFBookingReference,
        },
      },
    };

    const builder = new Builder({ headless: true });
    const xml = builder.buildObject(requestObj);

    const response = await axios.post(travelFusionUrl, xml, {
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        Accept: "text/xml",
        "Accept-Encoding": "gzip, deflate",
      },
      timeout: 120000,
    });

    const parsed = await parseStringPromise(response.data);
    const cancelStatus = parsed?.CommandList?.CheckBookingCancelPlane?.[0];

    // respond with useful data for the client
    res.status(200).json({
      status: cancelStatus?.Status?.[0] || "Unknown",
      supplierData:
        cancelStatus?.SupplierConfirmationDataItemList?.[0]
          ?.SupplierConfirmationDataItem || [],
      rawResponse: response.data,
    });
  } catch (err) {
    console.error("CheckBookingCancelPlane Error:", err.message);
    res.status(500).json({ error: err.message });
  }
};

const getCurrencyList = async (req, res) => {
  try {
    // const loginId = await fetchLoginID();

    const builder = new Builder({ headless: true });

    const currencyObj = {
      CommandList: {
        GetCurrencies: {
          XmlLoginId: loginId,
          LoginId: loginId,
        },
      },
    };

    const xml = builder.buildObject(currencyObj);

    const response = await axios.post(travelFusionUrl, xml, {
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        Accept: "text/xml",
        "Accept-Encoding": "gzip, deflate",
      },
      timeout: 120000,
    });

    const parsed = await parseStringPromise(response.data);

    res.status(200).json({
      Currencydata: parsed,
    });
  } catch (err) {
    console.error("Getting Currency Error:", err.message);
    res.status(500).json({ error: err.message });
  }
};

const getAirports = async (req, res) => {
  try {
    // const loginId = await fetchLoginID();
    const cachedData = cache.get("airportData");
    if (cachedData) {
      return res
        .status(200)
        .json({ Airportdata: cachedData, message: "fromcache" });
    }
    const builder = new Builder({ headless: true });

    const currencyObj = {
      CommandList: {
        GetAirportsData: {
          XmlLoginId: loginId,
          LoginId: loginId,
        },
      },
    };

    const xml = builder.buildObject(currencyObj);

    const response = await axios.post(travelFusionUrl, xml, {
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        Accept: "text/xml",
        "Accept-Encoding": "gzip, deflate",
      },
      timeout: 120000,
    });

    const parsed = await parseStringPromise(response.data);
    const airports =
      parsed?.CommandList?.GetAirportsData[0]?.AirportList[0]?.Airport;
    const simplifiedAirports = airports.map((airport) => {
      return {
        Iata: airport.IataCode?.[0] || null,
        Airportname:
          airport.AirportNameList?.[0]?.AirportName?.[0]?.Name?.[0] || null,
        Cityname: airport.City?.[0]?.CityName?.[0] || null,
        Countrycode: airport.Country?.[0]?.CountryCode?.[0] || null,
        Countryname: airport.Country?.[0]?.CountryName?.[0] || null,
      };
    });
    cache.set("airportData", simplifiedAirports);
    res.status(200).json({
      Airportdata: simplifiedAirports,
    });
  } catch (error) {
    console.log(error);
    console.error("Getting Airport Code Error", error.message);
    res.status(500).json({ error: error.message });
  }
};

const getSupplierRoutes = async (req, res) => {
  try {
    // const loginId = await fetchLoginID();
    const suppliers = ["tapairportugal"]; // Hardcoded suppliers
    const builder = new Builder({ headless: true });

    const allRoutes = [];
    const cachedData = cache.get("supplierData");
    if (cachedData) {
      return res
        .status(200)
        .json({ Supplierdata: cachedData, message: "fromcache" });
    }
    for (const supplier of suppliers) {
      const routesObj = {
        CommandList: {
          ListSupplierRoutes: {
            XmlLoginId: loginId,
            LoginId: loginId,
            Supplier: supplier,
            OneWayOnlyAirportRoutes: false,
          },
        },
      };

      const xml = builder.buildObject(routesObj);

      const response = await axios.post(travelFusionUrl, xml, {
        headers: {
          "Content-Type": "text/xml; charset=utf-8",
          Accept: "text/xml",
          "Accept-Encoding": "gzip, deflate",
        },
        timeout: 120000,
      });

      const parsed = await parseStringPromise(response.data);
      const routeList =
        parsed?.CommandList?.ListSupplierRoutes?.[0]?.RouteList?.[0];

      const airportRoutesRaw = routeList?.AirportRoutes?.[0] || "";
      const airportRoutes = airportRoutesRaw
        .split("\n")
        .map((r) => r.trim())
        .filter(Boolean)
        .map((route) => ({
          from: route.slice(0, 3),
          to: route.slice(3, 6),
        }));

      allRoutes.push({ supplier, airportRoutes });
    }
    cache.set("supplierData", allRoutes);
    return res.status(200).json({ suppliers: allRoutes });
  } catch (err) {
    console.error("Getting Supplier Routes Error", err.message);
    res.status(500).json({ error: err.message });
  }
};

const createVirtualCard = async (req, res) => {
  try {
    const {
      amount,
      currency,
      expirationDate, // format: "dd/mm/yyyy"
      locator
    } = req.body;

    // Check for required inputs
    if (!amount || !currency || !expirationDate) {
      return res.status(422).json({
        error: "amount, currency, and expirationDate are required",
      });
    }

    // const loginId = await fetchLoginID();
    const builder = new Builder({ headless: true });

    const vccObj = {
      CommandList: {
        CreatePrepayVirtualCard: {
          XmlLoginId: loginId,
          LoginId: loginId,
          ...(locator ? { Locator: locator } : {}),
          ExpirationTime: expirationDate,
          Currency: currency,
          Amount: amount,
        },
      },
    };

    const xml = builder.buildObject(vccObj);

    const response = await axios.post(travelFusionUrl, xml, {
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        Accept: "text/xml",
        "Accept-Encoding": "gzip, deflate",
      },
      timeout: 150000,
    });

    const parsed = await parseStringPromise(response.data);

    res.status(200).json({
      virtualCardData: parsed,
    });
  } catch (err) {
    console.error("VCC Creation Error:", err.message);
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  startRouting,
  checkRouting,
  processDetails,
  processTerms,
  startBooking,
  checkBooking,
  getBookingDetails,
  getBookingDetailsForCancellation,
  startBookingCancelPlane,
  checkBookingCancelPlane,
  getBranchSupplierList,
  getCurrencyList,
  getAirports,
  getSupplierRoutes,
  createVirtualCard
};
