// Amadeus Configiration
const amadeus = require("../config/Amadeus");

/* Function to get Airline Names */
const getAirlineNames = async (airlineCodesSet) => {
  if (!airlineCodesSet || airlineCodesSet.size === 0) return {};

  const airlineCodesStr = Array.from(airlineCodesSet).join(",");

  try {
    const response = await amadeus.referenceData.airlines.get({
      airlineCodes: airlineCodesStr,
    });

    const airlineMap = {};
    response.data.forEach((airline) => {
      airlineMap[airline.iataCode] = airline.commonName || airline.businessName;
    });

    return airlineMap;
  } catch (err) {
    console.error(
      "Error fetching airline names:",
      err.response?.data || err.message || err
    );
    return {};
  }
};

module.exports = { getAirlineNames };
