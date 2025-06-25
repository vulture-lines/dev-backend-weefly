// controllers/searchController.js
require("dotenv").config();
const axios = require("axios");
const { Builder } = require("xml2js");
const { parseStringPromise } = require("xml2js");
const { fetchLoginID } = require("../Loginidgenerator"); // Import the login function

const startRouting = async (req, res) => {
  try {
    const {
      mode = "plane",
      origin,
      destination,
      dateOfSearch,
      maxChanges = 1,
      maxHops = 2,
      timeout = 40,
      travellers = [],
      incrementalResults = true,
    } = req.body;

    if (!origin || !destination || !dateOfSearch || travellers.length === 0) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // 🔐 Get loginId by calling the login function
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
          MaxChanges: maxChanges,
          MaxHops: maxHops,
          Timeout: timeout,
          TravellerList: {
            Traveller: travellers.map((age) => ({ Age: age })),
          },
          IncrementalResults: incrementalResults,
        },
      },
    };

    const routingXml = builder.buildObject(startRoutingObj);
    // console.log("Request XML:\n", routingXml);

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
    // return res.status(200).send(response.data)

    const parsed = await parseStringPromise(response.data);
    console.log(parsed)
    const startRoutingResponse = parsed?.CommandList?.StartRouting?.[0];
    
    if (!startRoutingResponse?.RoutingId?.[0]) {
      return res.status(500).json({ error: "No RoutingId returned" });
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
    if (!routingId) return res.status(400).json({ error: "RoutingId is required" });

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

    const response = await axios.post("https://api.travelfusion.com", checkRoutingXml, {
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        Accept: "text/xml",
      },
      timeout: 120000,
    });

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
      return res.status(400).json({ error: "RoutingId and OutwardId are required" });
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


module.exports = {
  startRouting,
    checkRouting,
    processDetails
};
