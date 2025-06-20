require("dotenv").config();
const amadeus = require("../config/Amadeus");
const moment = require("moment");
const { getAirlineNames } = require("../utils/Airlinename");
const { getAirportCode } = require("../utils/Airportcode");
const { Extractcityname } = require("../utils/Extractcityname");

exports.getSeatMap = async (req, res) => {
  const {
    from,
    to,
    flightDepatureDate,
    flightReturnDate,
    travelClass,
    airlineNumber,
  } = req.body;
  const flightCode = airlineNumber.split(" ");
  const airlineCode = flightCode[0];
  const flightNumber = flightCode[1];
  if (
    !from ||
    !to ||
    !flightDepatureDate ||
    !flightReturnDate ||
    !travelClass ||
    from === to
  ) {
    return res.status(422).json({ error: "All fields are required." });
  }
  try {
    const originCode = await getAirportCode(from);
    const destinationCode = await getAirportCode(to);
    const response = await amadeus.shopping.flightOffersSearch.get({
      originLocationCode: originCode,
      destinationLocationCode: destinationCode,
      departureDate: flightDepatureDate,
      returnDate: flightReturnDate,
      travelClass: travelClass.replace(" ", "_").toUpperCase(), // Format: "Premium Economy" -> "PREMIUM_ECONOMY"
      currencyCode: "ZAR",
      adults: 2,
      includedAirlineCodes: airlineCode,
    });
    const offers = response.data;

    const selectedOffer = offers.find((offer) =>
      offer.itineraries.some((itinerary) =>
        itinerary.segments.some(
          (segment) =>
            segment.carrierCode === airlineCode &&
            segment.number === flightNumber
        )
      )
    );

    if (!selectedOffer) {
      console.log("Selected flight not found in available offers.");
      return;
    }
    const seatMapResponse = await amadeus.shopping.seatmaps.post(
      JSON.stringify({ data: [selectedOffer] })
    );
    return res.status(200).json(seatMapResponse.data);
  } catch (error) {
    console.log(error);
  }
};

exports.getFlightOffers = async (req, res) => {
  const { from, to, flightDepatureDate, flightReturnDate, travelClass } =
    req.body;

  if (
    !from ||
    !to ||
    !flightDepatureDate ||
    !flightReturnDate ||
    !travelClass ||
    from === to
  ) {
    return res.status(422).json({ error: "All fields are required." });
  }

  try {
    const originCode = await getAirportCode(from);
    const destinationCode = await getAirportCode(to);

    if (!originCode || !destinationCode) {
      return res.status(422).json({ error: "Invalid city names" });
    }

    const response = await amadeus.shopping.flightOffersSearch.get({
      originLocationCode: originCode,
      destinationLocationCode: destinationCode,
      departureDate: flightDepatureDate,
      returnDate: flightReturnDate,
      travelClass: travelClass.replace(" ", "_").toUpperCase(),
      currencyCode: "ZAR",
      adults: 2,
    });

    const flightOffers = response.data;
    const requestedClass = travelClass.replace(" ", "_").toUpperCase();

    const filteredOffers = flightOffers.filter((offer) => {
      const fareClass =
        offer.travelerPricings?.[0]?.fareDetailsBySegment?.[0]?.cabin;
      return fareClass && fareClass.toUpperCase() === requestedClass;
    });

    const carrierCodes = new Set();
    filteredOffers.forEach((offer) => {
      offer.itineraries.forEach((itinerary) => {
        itinerary.segments.forEach((segment) => {
          carrierCodes.add(segment.carrierCode);
        });
      });
    });

    const airlineCodeString = Array.from(carrierCodes).join(",");
    const airlineResponse = await amadeus.referenceData.airlines.get({
      airlineCodes: airlineCodeString,
    });

    const airlineMap = {};
    airlineResponse.data.forEach((airline) => {
      airlineMap[airline.iataCode] = airline.commonName || airline.businessName;
    });

    const formattedData = filteredOffers.map((offer) => {
      const outbound = offer.itineraries[0];
      const inbound = offer.itineraries[1];

      const firstSegmentOutbound = outbound.segments[0];
      const lastSegmentOutbound =
        outbound.segments[outbound.segments.length - 1];

      const firstSegmentInbound = inbound.segments[0];
      const lastSegmentInbound = inbound.segments[inbound.segments.length - 1];

      const airlineCode = firstSegmentOutbound.carrierCode;
      const airlineName = airlineMap[airlineCode] || "Unknown";

      return {
        id: offer.id,
        airline: airlineName,
        logo: `https://content.airhex.com/content/logos/airlines_${airlineCode}_200_200_s.png`,
        flightNumber: `${airlineCode} ${firstSegmentOutbound.number}`,
        class:
          offer.travelerPricings?.[0]?.fareDetailsBySegment?.[0]?.cabin ||
          "N/A",
        price: offer.price.total,
        originalPrice: offer.price.base,
        currency: offer.price.currency,
        refundable:
          offer.travelerPricings?.[0]?.fareDetailsBySegment?.[0]?.refundable ??
          false,

        outbound: {
          departureTime: firstSegmentOutbound.departure.at,
          departureCity: firstSegmentOutbound.departure.iataCode,
          arrivalTime: lastSegmentOutbound.arrival.at,
          arrivalCity: lastSegmentOutbound.arrival.iataCode,
          duration: outbound.duration,
          stops: outbound.segments.length - 1,
        },

        inbound: {
          departureTime: firstSegmentInbound.departure.at,
          departureCity: firstSegmentInbound.departure.iataCode,
          arrivalTime: lastSegmentInbound.arrival.at,
          arrivalCity: lastSegmentInbound.arrival.iataCode,
          duration: inbound.duration,
          stops: inbound.segments.length - 1,
        },
      };
    });

    res.status(200).json(formattedData);
  } catch (error) {
    console.error(
      "Amadeus API Error in getFlightOffers:",
      error.response?.data || error.message || error
    );

    const errorDetails = error.response?.data?.errors?.[0];

    if (errorDetails?.code === 425 && errorDetails?.title === "INVALID DATE") {
      res
        .status(422)
        .json({ error: "Departure or return date cannot be in the past." });
    } else if (
      error.message ===
      "Failed to get city IATA code: Invalid query parameter format"
    ) {
      res.status(422).json({ error: "Invalid query parameter format" });
    } else {
      res.status(500).json({
        error: error.response?.data || error.message || "Server error",
      });
    }
  }
};

exports.filterFlight = async (req, res) => {
  const {
    from,
    to,
    flightDepatureDate,
    flightReturnDate,
    travelClass,
    stops,
    maxPrice,
    airlineFilter,
    departureSlot,
    arrivalSlot,
    slotType,
  } = req.body;

  if (
    !from ||
    !to ||
    !flightDepatureDate ||
    !flightReturnDate ||
    !travelClass ||
    from === to
  ) {
    return res.status(422).json({ error: "All fields are required." });
  }

  const travelClassEnumMap = {
    economy: "ECONOMY",
    "premium economy": "PREMIUM_ECONOMY",
    business: "BUSINESS",
    first: "FIRST",
  };

  // 1. Travel Class and Stops
  if (travelClass.length > 0 && stops.length > 0) {
    try {
      const originCode = await getAirportCode(from);
      const destinationCode = await getAirportCode(to);

      if (!originCode || !destinationCode) {
        return res.status(422).json({ error: "Invalid city names" });
      }

      const travelClasses = Array.isArray(travelClass)
        ? travelClass
        : [travelClass];
      const stopFilter = Array.isArray(stops) ? stops : [stops];

      const stopValues = new Set();

      const latestStop = stopFilter[stopFilter.length - 1]?.toLowerCase();
      if (latestStop === "nonstop") stopValues.add(0);
      else if (latestStop === "1stop") stopValues.add(1);
      else if (latestStop === "2+stop") stopValues.add(2);

      const allResults = [];
      const airlineCodesSet = new Set();

      for (const cls of travelClasses) {
        const travelClsEnum = travelClassEnumMap[cls.toLowerCase()];
        if (!travelClsEnum) continue;

        const response = await amadeus.shopping.flightOffersSearch.get({
          originLocationCode: originCode,
          destinationLocationCode: destinationCode,
          departureDate: flightDepatureDate,
          returnDate: flightReturnDate,
          travelClass: travelClsEnum,
          currencyCode: "ZAR",
          adults: 2,
        });

        response.data.forEach((offer) => {
          const itinerary = offer.itineraries[0];
          const numStops = itinerary.segments.length - 1;
          if (numStops >= 2 || stopValues.has(numStops)) {
            const segment = itinerary.segments[0];
            const lastSegment =
              itinerary.segments[itinerary.segments.length - 1];
            const airlineCode = segment.carrierCode;
            airlineCodesSet.add(airlineCode);

            allResults.push({
              id: offer.id,
              airline: "", // filled later
              logo: `https://content.airhex.com/content/logos/airlines_${airlineCode}_200_200_s.png`,
              flightNumber: `${airlineCode} ${segment.number}`,
              class:
                offer.travelerPricings?.[0]?.fareDetailsBySegment?.[0]?.cabin ||
                "N/A",
              price: offer.price.total,
              originalPrice: offer.price.base,
              currency: offer.price.currency,
              refundable:
                offer.travelerPricings?.[0]?.fareDetailsBySegment?.[0]
                  ?.refundable ?? false,
              outbound: {
                departureTime: segment.departure.at,
                departureCity: segment.departure.iataCode,
                arrivalTime: lastSegment.arrival.at,
                arrivalCity: lastSegment.arrival.iataCode,
                duration: itinerary.duration,
                stops: numStops,
              },
              inbound: offer.itineraries[1]
                ? {
                    departureTime:
                      offer.itineraries[1].segments[0].departure.at,
                    departureCity:
                      offer.itineraries[1].segments[0].departure.iataCode,
                    arrivalTime:
                      offer.itineraries[1].segments.slice(-1)[0].arrival.at,
                    arrivalCity:
                      offer.itineraries[1].segments.slice(-1)[0].arrival
                        .iataCode,
                    duration: offer.itineraries[1].duration,
                    stops: offer.itineraries[1].segments.length - 1,
                  }
                : null,
            });
          }
        });
      }

      const airlineMap = await getAirlineNames(airlineCodesSet);
      allResults.forEach((f) => {
        const code = f.flightNumber.split(" ")[0];
        f.airline = airlineMap[code] || code;
      });

      res.status(200).json(allResults);
    } catch (error) {
      console.error(
        "Amadeus API Error in get flights:",
        error.response?.data || error.message || error
      );
      res.status(500).json({
        error: error.response?.data || error.message || "Unknown error",
      });
    }
  }

  // 2. Travel Class and Airline Filter
  else if (travelClass.length > 0 && airlineFilter.length > 0) {
    try {
      const originCode = await getAirportCode(from);
      const destinationCode = await getAirportCode(to);

      if (!originCode || !destinationCode) {
        return res.status(422).json({ error: "Invalid city names" });
      }

      const travelClasses = Array.isArray(travelClass)
        ? travelClass
        : [travelClass];
      const airlineFilterNormalized = Array.isArray(airlineFilter)
        ? airlineFilter.map((a) => a.toLowerCase())
        : [airlineFilter.toLowerCase()];

      const allResults = [];
      const airlineCodesSet = new Set();

      for (const cls of travelClasses) {
        const travelClsEnum = travelClassEnumMap[cls.toLowerCase()];
        if (!travelClsEnum) continue;

        const response = await amadeus.shopping.flightOffersSearch.get({
          originLocationCode: originCode,
          destinationLocationCode: destinationCode,
          departureDate: flightDepatureDate,
          returnDate: flightReturnDate,
          travelClass: travelClsEnum,
          currencyCode: "ZAR",
          adults: 2,
        });

        response.data.forEach((offer) => {
          const itinerary = offer.itineraries[0];
          const segment = itinerary.segments[0];
          const lastSegment = itinerary.segments[itinerary.segments.length - 1];
          const airlineCode = segment.carrierCode;
          airlineCodesSet.add(airlineCode);

          allResults.push({
            id: offer.id,
            airlineCode,
            airline: "", // filled later
            logo: `https://content.airhex.com/content/logos/airlines_${airlineCode}_200_200_s.png`,
            flightNumber: `${airlineCode} ${segment.number}`,
            class:
              offer.travelerPricings?.[0]?.fareDetailsBySegment?.[0]?.cabin ||
              "N/A",
            price: offer.price.total,
            originalPrice: offer.price.base,
            currency: offer.price.currency,
            refundable:
              offer.travelerPricings?.[0]?.fareDetailsBySegment?.[0]
                ?.refundable ?? false,

            outbound: {
              departureTime: segment.departure.at,
              departureCity: segment.departure.iataCode,
              arrivalTime: lastSegment.arrival.at,
              arrivalCity: lastSegment.arrival.iataCode,
              duration: itinerary.duration,
              stops: itinerary.segments.length - 1,
            },
            inbound: offer.itineraries[1]
              ? {
                  departureTime: offer.itineraries[1].segments[0].departure.at,
                  departureCity:
                    offer.itineraries[1].segments[0].departure.iataCode,
                  arrivalTime:
                    offer.itineraries[1].segments.slice(-1)[0].arrival.at,
                  arrivalCity:
                    offer.itineraries[1].segments.slice(-1)[0].arrival.iataCode,
                  duration: offer.itineraries[1].duration,
                  stops: offer.itineraries[1].segments.length - 1,
                }
              : null,
          });
        });
      }

      const airlineMap = await getAirlineNames(airlineCodesSet);
      const filteredResults = allResults.filter((f) =>
        airlineFilterNormalized.includes(
          (airlineMap[f.airlineCode] || f.airlineCode).toLowerCase()
        )
      );
      filteredResults.forEach((f) => {
        f.airline = airlineMap[f.airlineCode] || f.airlineCode;
      });

      res.status(200).json(filteredResults);
    } catch (error) {
      console.error(
        "Amadeus API Error in get flights:",
        error.response?.data || error.message || error
      );
      res.status(500).json({
        error: error.response?.data || error.message || "Unknown error",
      });
    }
  }

  // 3. Time Slot Filtering
  else if (departureSlot || arrivalSlot) {
    try {
      const originCode = await getAirportCode(from);
      const destinationCode = await getAirportCode(to);
      if (!originCode || !destinationCode) {
        return res.status(422).json({ error: "Invalid city names" });
      }

      const travelClasses = Array.isArray(travelClass)
        ? travelClass
        : [travelClass];
      const allResults = [];
      const airlineCodesSet = new Set();

      for (const cls of travelClasses) {
        const travelClsEnum = travelClassEnumMap[cls.toLowerCase()];
        if (!travelClsEnum) continue;

        const response = await amadeus.shopping.flightOffersSearch.get({
          originLocationCode: originCode,
          destinationLocationCode: destinationCode,
          departureDate: flightDepatureDate,
          returnDate: flightReturnDate,
          travelClass: travelClsEnum,
          currencyCode: "ZAR",
          adults: 2,
        });

        response.data.forEach((offer) => {
          const itinerary = offer.itineraries[0];
          const segment = itinerary.segments[0];
          const lastSegment = itinerary.segments[itinerary.segments.length - 1];
          const airlineCode = segment.carrierCode;
          airlineCodesSet.add(airlineCode);

          allResults.push({
            id: offer.id,
            airlineCode,
            airline: "",
            logo: `https://content.airhex.com/content/logos/airlines_${airlineCode}_200_200_s.png`,
            flightNumber: `${airlineCode} ${segment.number}`,
            class:
              offer.travelerPricings?.[0]?.fareDetailsBySegment?.[0]?.cabin ||
              "N/A",
            price: offer.price.total,
            originalPrice: offer.price.base,
            currency: offer.price.currency,
            refundable:
              offer.travelerPricings?.[0]?.fareDetailsBySegment?.[0]
                ?.refundable ?? false,

            outbound: {
              departureTime: segment.departure.at,
              departureCity: segment.departure.iataCode,
              arrivalTime: lastSegment.arrival.at,
              arrivalCity: lastSegment.arrival.iataCode,
              duration: itinerary.duration,
              stops: itinerary.segments.length - 1,
            },
            inbound: offer.itineraries[1]
              ? {
                  departureTime: offer.itineraries[1].segments[0].departure.at,
                  departureCity:
                    offer.itineraries[1].segments[0].departure.iataCode,
                  arrivalTime:
                    offer.itineraries[1].segments.slice(-1)[0].arrival.at,
                  arrivalCity:
                    offer.itineraries[1].segments.slice(-1)[0].arrival.iataCode,
                  duration: offer.itineraries[1].duration,
                  stops: offer.itineraries[1].segments.length - 1,
                }
              : null,
          });
        });
      }
      if (departureSlot && slotType === "Depature") {
        const [startTime, endTime] = departureSlot.split("-");
        const startMoment = moment(startTime, "HH:mm");
        const endMoment = moment(endTime, "HH:mm");
        const filteredDepartures = allResults.filter((departure) => {
          const departureMoment = moment(
            departure.outbound.departureTime,
            "YYYY-MM-DDTHH:mm"
          );
          const departureTime = departureMoment.format("HH:mm");
          return moment(departureTime, "HH:mm").isBetween(
            startMoment,
            endMoment,
            null,
            "[)"
          );
        });
        // Fetch and apply airline names
        const airlineMap = await getAirlineNames(airlineCodesSet);
        filteredDepartures.forEach((result) => {
          result.airline = airlineMap[result.airlineCode] || result.airlineCode;
        });

        res.status(200).json(filteredDepartures);
      } else if (arrivalSlot && slotType === "Arrival") {
        const [startTime, endTime] = arrivalSlot.split("-");
        const startMoment = moment(startTime, "HH:mm");
        const endMoment = moment(endTime, "HH:mm");
        const filteredArrivals = allResults.filter((arrival) => {
          const arrivalMoment = moment(arrival.outbound.arrivalTime, "YYYY-MM-DDTHH:mm");
          const arrivalTime = arrivalMoment.format("HH:mm");
          return moment(arrivalTime, "HH:mm").isBetween(
            startMoment,
            endMoment,
            null,
            "[)"
          );
        });
 
        const airlineMap = await getAirlineNames(airlineCodesSet);
        filteredArrivals.forEach((result) => {
          result.airline = airlineMap[result.airlineCode] || result.airlineCode;
        });

        res.status(200).json(filteredArrivals);
      }
    } catch (error) {
      console.error(
        "Amadeus API Error in filter flights:",
        error.response?.data || error.message || error
      );
      res.status(500).json({
        error: error.response?.data || error.message || "Server error",
      });
    }
  }

  // 4. Only Travel Class
  else if (travelClass.length > 0) {
    try {
      const originCode = await getAirportCode(from);
      const destinationCode = await getAirportCode(to);

      if (!originCode || !destinationCode) {
        return res.status(422).json({ error: "Invalid city names" });
      }

      const travelClasses = Array.isArray(travelClass)
        ? travelClass
        : [travelClass];
      const allResults = [];
      const airlineCodesSet = new Set();

      for (const cls of travelClasses) {
        const travelClsEnum = travelClassEnumMap[cls.toLowerCase()];
        if (!travelClsEnum) continue;

        const response = await amadeus.shopping.flightOffersSearch.get({
          originLocationCode: originCode,
          destinationLocationCode: destinationCode,
          departureDate: flightDepatureDate,
          returnDate: flightReturnDate,
          travelClass: travelClsEnum,
          currencyCode: "ZAR",
          adults: 2,
        });

        response.data.forEach((offer) => {
          const itinerary = offer.itineraries[0];
          const segment = itinerary.segments[0];
          const lastSegment = itinerary.segments[itinerary.segments.length - 1];
          const airlineCode = segment.carrierCode;
          airlineCodesSet.add(airlineCode);

          allResults.push({
            id: offer.id,
            airlineCode,
            airline: "",
            logo: `https://content.airhex.com/content/logos/airlines_${airlineCode}_200_200_s.png`,
            flightNumber: `${airlineCode} ${segment.number}`,
            class:
              offer.travelerPricings?.[0]?.fareDetailsBySegment?.[0]?.cabin ||
              "N/A",
            price: offer.price.total,
            originalPrice: offer.price.base,
            currency: offer.price.currency,
            refundable:
              offer.travelerPricings?.[0]?.fareDetailsBySegment?.[0]
                ?.refundable ?? false,

            outbound: {
              departureTime: segment.departure.at,
              departureCity: segment.departure.iataCode,
              arrivalTime: lastSegment.arrival.at,
              arrivalCity: lastSegment.arrival.iataCode,
              duration: itinerary.duration,
              stops: itinerary.segments.length - 1,
            },
            inbound: offer.itineraries[1]
              ? {
                  departureTime: offer.itineraries[1].segments[0].departure.at,
                  departureCity:
                    offer.itineraries[1].segments[0].departure.iataCode,
                  arrivalTime:
                    offer.itineraries[1].segments.slice(-1)[0].arrival.at,
                  arrivalCity:
                    offer.itineraries[1].segments.slice(-1)[0].arrival.iataCode,
                  duration: offer.itineraries[1].duration,
                  stops: offer.itineraries[1].segments.length - 1,
                }
              : null,
          });
        });
      }

      const airlineMap = await getAirlineNames(airlineCodesSet);
      allResults.forEach((f) => {
        f.airline = airlineMap[f.airlineCode] || f.airlineCode;
      });

      res.status(200).json(allResults);
    } catch (error) {
      console.error(
        "Amadeus API Error in filter flights:",
        error.response?.data || error.message || error
      );
      res.status(500).json({
        error: error.response?.data || error.message || "Server error",
      });
    }
  }
};
