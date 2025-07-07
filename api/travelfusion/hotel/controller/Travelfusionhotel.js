// controllers/searchController.js
require("dotenv").config();
const axios = require("axios");
const { Builder } = require("xml2js");
const { parseStringPromise } = require("xml2js");
const { fetchLoginID } = require("../../Loginidgenerator"); // Import the login function

const travelFusionUrl = process.env.TRAVEL_FUSION_API_URL;

const startRoutingHotel = async (req, res) => {
  try {
    const {
      destination,
      checkinDate,
      checkoutDate,
      accommodationTypes = [],
      supplierList = [],
      timeout = 40,
      rooms = [],
    } = req.body;

    if (!destination || !checkinDate || !checkoutDate || rooms.length === 0) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // get loginId
    const loginId = await fetchLoginID();

    const builder = new Builder({ headless: true });

    const startRoutingHotelObj = {
      CommandList: {
        StartRoutingHotel: {
          XmlLoginId: loginId,
          LoginId: loginId,
          Destination: {
            Descriptor: destination.descriptor,
            Type: "citycode",
            Radius: destination.radius || 10000,
          },
          CheckinDates: {
            DateOfSearch: checkinDate,
          },
          CheckoutDates: {
            DateOfSearch: checkoutDate,
          },
          SupplierList: {
            Supplier: supplierList,
          },
          Timeout: timeout,
          AccommodationTypeList: {
            AccommodationType: accommodationTypes,
          },
          RoomList: {
            Room: rooms.map((room) => ({
              Type: room.type,
              TravellerList: {
                Traveller: room.travellers.map((trav) => ({
                  Age: trav.age,
                })),
              },
            })),
          },
        },
      },
    };

    const routingXml = builder.buildObject(startRoutingHotelObj);

    const response = await axios.post(travelFusionUrl, routingXml, {
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        Accept: "text/xml",
      },
      timeout: 120000,
    });

    const parsed = await parseStringPromise(response.data);
    const startRoutingHotelResponse =
      parsed?.CommandList?.StartRoutingHotel?.[0];

    if (!startRoutingHotelResponse?.RoutingId?.[0]) {
      return res.status(422).json({
        error: "No RoutingId returned",
        requestdata: response.data,
      });
    }

    res.status(200).json({
      routingId: startRoutingHotelResponse.RoutingId[0],
    });
  } catch (err) {
    console.error("StartRoutingHotel Error:", err.message);
    res.status(500).json({ error: err.message });
  }
};

const checkRoutingHotel = async (req, res) => {
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

    const response = await axios.post(travelFusionUrl, checkRoutingXml, {
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        Accept: "text/xml",
      },
      timeout: 120000,
    });

    const parsed = await parseStringPromise(response.data);

    const checkRoutingResponse = parsed?.CommandList?.CheckRouting?.[0];
    return res.status(200).json({ checkRoutingResponse });
    // const routeId = checkRoutingResponse?.RoutingId;
    // const flightList = checkRoutingResponse?.RouterList;
    // res.status(200).json({ routingId: routeId, flightList: flightList });
  } catch (err) {
    console.error("CheckRouting Error:", err.message);
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  startRoutingHotel,
  checkRoutingHotel,
};
