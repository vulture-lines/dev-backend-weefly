// controllers/searchController.js
require("dotenv").config();
const axios = require("axios");
const { Builder } = require("xml2js");
const { parseStringPromise } = require("xml2js");
const { fetchLoginID } = require("../Loginidgenerator"); // Import the login function

const getBranchSupplierList = async (req, res) => {
  try {
    // get loginId
    const loginId = await fetchLoginID(); // your function to get login ID

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
    const response = await axios.post(
      "https://api.travelfusion.com",
      requestXml,
      {
        headers: {
          "Content-Type": "text/xml; charset=utf-8",
          Accept: "text/xml",
        },
        timeout: 120000,
      }
    );

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
      returnDateOfSearch, // for return trips
      maxChanges = 1,
      maxHops = 2,
      timeout = 40,
      travellers = [],
      incrementalResults = true,
      travelClass, // <-- added travelClass
    } = req.body;

    if (!origin || !destination || !dateOfSearch || travellers.length === 0) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // get loginId
    const loginId = await fetchLoginID();

    const builder = new Builder({ headless: true });

    const startRoutingObj = {
      CommandList: {
        StartRouting: {
          XmlLoginId: loginId,
          LoginId: loginId,
          Mode: mode,
          Origin: {
            Descriptor: origin.descriptor,
            Type: origin.type,
          },
          Destination: {
            Descriptor: destination.descriptor,
            Type: destination.type,
            Radius: destination.radius || 1000,
          },
          OutwardDates: {
            DateOfSearch: dateOfSearch,
          },
          // if return date is provided
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

          // include TravelClass if provided
          ...(travelClass && { TravelClass: travelClass }),
        },
      },
    };

    const routingXml = builder.buildObject(startRoutingObj);

    const response = await axios.post(
      "https://api.travelfusion.com",
      routingXml,
      {
        headers: {
          "Content-Type": "text/xml; charset=utf-8",
          Accept: "text/xml",
        },
        timeout: 120000,
      }
    );

    // return res.status(400).send(routingXml)

    const parsed = await parseStringPromise(response.data);
    const startRoutingResponse = parsed?.CommandList?.StartRouting?.[0];

    if (!startRoutingResponse?.RoutingId?.[0]) {
      return res.status(500).json({
        error: "No RoutingId returned",
        requestdata: response.data,
      });
    }

    res.status(200).json({
      routingId: startRoutingResponse.RoutingId[0],
      routerList: startRoutingResponse.RouterList || [],
    });
  } catch (err) {
    console.error("StartRouting Error:", err.message);
    res.status(500).json({ error: err.message });
  }
};

const checkRouting = async (req, res) => {
  try {
    const { routingId } = req.body;
    if (!routingId)
      return res.status(400).json({ error: "RoutingId is required" });

    const loginId = await fetchLoginID();

    const checkRoutingXml = new Builder({ headless: true }).buildObject({
      CommandList: {
        CheckRouting: {
          XmlLoginId: loginId,
          LoginId: loginId,
          RoutingId: routingId,
        },
      },
    });

    const response = await axios.post(
      "https://api.travelfusion.com",
      checkRoutingXml,
      {
        headers: {
          "Content-Type": "text/xml; charset=utf-8",
          Accept: "text/xml",
        },
        timeout: 120000,
      }
    );

    const parsed = await parseStringPromise(response.data);
    const checkRoutingResponse = parsed?.CommandList?.CheckRouting?.[0];

    res.status(200).json({ data: checkRoutingResponse });
  } catch (err) {
    console.error("CheckRouting Error:", err.message);
    res.status(500).json({ error: err.message });
  }
};

const processDetails = async (req, res) => {
  try {
    const { routingId, outwardId, returnId = null } = req.body;

    if (!routingId || !outwardId) {
      return res
        .status(400)
        .json({ error: "RoutingId and OutwardId are required" });
    }

    const loginId = await fetchLoginID();

    const requestObj = {
      CommandList: {
        ProcessDetails: {
          XmlLoginId: loginId,
          LoginId: loginId,
          RoutingId: routingId,
          OutwardId: outwardId,
          HandoffParametersOnly: false,
        },
      },
    };

    // Add ReturnId if provided
    if (returnId) {
      requestObj.CommandList.ProcessDetails.ReturnId = returnId;
    }

    const builder = new Builder({ headless: true });
    const xml = builder.buildObject(requestObj);

    const response = await axios.post("https://api.travelfusion.com", xml, {
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        Accept: "text/xml",
      },
      timeout: 120000,
    });

    const parsed = await parseStringPromise(response.data);
    const processResponse = parsed?.CommandList?.ProcessDetails?.[0];

    res.status(200).json({ data: processResponse });
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
      returnId = null,
      seatOptions = [],
    } = req.body;

    if (!routingId || !bookingProfile) {
      return res.status(400).json({
        error: "routingId and bookingProfile are required",
      });
    }

    const loginId = await fetchLoginID();

    // deep copy bookingProfile to modify
    let bookingProfileObj = JSON.parse(JSON.stringify(bookingProfile));

    // assign seatOptions per passenger
    if (seatOptions.length && bookingProfileObj.TravellerList?.Traveller) {
      let travellers = bookingProfileObj.TravellerList.Traveller;

      // if only one passenger, wrap in array
      if (!Array.isArray(travellers)) {
        travellers = [travellers];
      }

      travellers = travellers.map((traveller, index) => {
        const seat = seatOptions[index] || "";

        // get existing CSPs
        let csps = traveller.CustomSupplierParameterList?.CustomSupplierParameter || [];

        // normalize to array
        if (!Array.isArray(csps)) {
          csps = [csps];
        }

        // add seat if available
        if (seat) {
          csps.push({
            Name: "SeatOptions",
            Value: seat,
          });
        }

        return {
          ...traveller,
          CustomSupplierParameterList: {
            CustomSupplierParameter: csps,
          },
        };
      });

      bookingProfileObj.TravellerList.Traveller = travellers;
    }

    const processTermsObj = {
      XmlLoginId: loginId,
      LoginId: loginId,
      Mode: mode,
      RoutingId: routingId,
      BookingProfile: bookingProfileObj,
    };

    if (returnId) {
      processTermsObj.ReturnId = returnId;
    }

    const requestObj = {
      CommandList: {
        ProcessTerms: processTermsObj,
      },
    };

    // convert to XML
    const builder = new Builder({ headless: true });
    const xml = builder.buildObject(requestObj);

    // send to TravelFusion
    const response = await axios.post("https://api.travelfusion.com", xml, {
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        Accept: "text/xml",
      },
      timeout: 120000,
    });

    return res.status(400).send(response.data)

    // parse XML response
    const parsed = await parseStringPromise(response.data);
    const termsResponse = parsed?.CommandList?.ProcessTerms?.[0];

    res.status(200).json({ data: termsResponse });
  } catch (err) {
    console.error("ProcessTerms Error:", err.message);
    res.status(500).json({ error: err.message });
  }
};



const startBooking = async (req, res) => {
  try {
    const {
      expectedAmount,
      expectedCurrency = "GBP",
      TFBookingReference,
      fakeBooking = true,
    } = req.body;

    const loginId = await fetchLoginID();

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

    const response = await axios.post("https://api.travelfusion.com", xml, {
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        Accept: "text/xml",
      },
      timeout: 120000,
    });
    //  return res.status(200).send(response.data);

    const parsed = await parseStringPromise(response.data);
    const result = parsed?.CommandList?.StartBooking?.[0];
    if (result !== "") {
      res.status(200).json({
        bookingReference: result?.TFBookingReference?.[0],
        routerInfo: result?.Router || null,
      });
    } else {
      return res.status(200).json({
        requesteddata: response.data,
      });
    }
  } catch (err) {
    console.error("StartBooking Error:", err.message);
    res.status(500).json({ error: err.message });
  }
};

const checkBooking = async (req, res) => {
  try {
    const { TFBookingReference } = req.body;
    const loginId = await fetchLoginID();

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

    const response = await axios.post("https://api.travelfusion.com", xml, {
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        Accept: "text/xml",
      },
      timeout: 120000,
    });

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
    const { TFBookingReference } = req.body;
    const loginId = await fetchLoginID();

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

    const response = await axios.post("https://api.travelfusion.com", xml, {
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        Accept: "text/xml",
      },
      timeout: 120000,
    });

    const parsed = await parseStringPromise(response.data);

    const result = parsed?.CommandList?.CheckBooking?.[0];

    res.status(200).json({
      datsa: parsed,
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
      return res.status(400).json({ error: "TFBookingReference is required" });
    }

    const loginId = await fetchLoginID();
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

    const response = await axios.post("https://api.travelfusion.com", xml, {
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        Accept: "text/xml",
      },
      timeout: 120000,
    });

    const parsed = await parseStringPromise(response.data);
    const bookingDetails = parsed?.CommandList?.GetBookingDetails?.[0];
    if (bookingDetails === "") {
      res.status(200).json({ data: bookingDetails });
    } else {
      res.status(400).json({ requested: response.data });
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
      return res.status(400).json({
        error: "TFBookingReference is required",
      });
    }

    const loginId = await fetchLoginID();

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

    const response = await axios.post("https://api.travelfusion.com", xml, {
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        Accept: "text/xml",
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
      return res.status(400).json({
        error: "TFBookingReference is required",
      });
    }

    const loginId = await fetchLoginID();

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

    const response = await axios.post("https://api.travelfusion.com", xml, {
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        Accept: "text/xml",
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
};
