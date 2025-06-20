// Amadeus Configiration
const { getAccessToken } = require("./Accesstoken");

/* Function to get Airport Codes */
const getAirportCode = async (city) => {
  try {
    if (!city) throw new Error("City name is required");
    const accessToken = await getAccessToken();
    if (!accessToken) throw new Error("Failed to get API token");
    const params = new URLSearchParams({
      subType: "CITY",
      keyword: city,
      "page[limit]": 1,
    });

    const response = await fetch(
      `https://test.api.amadeus.com/v1/reference-data/locations?${params}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.errors?.[0]?.detail || "API request failed");
    }

    const data = await response.json();
    if (data.data?.length > 0) {
      return data.data[0].iataCode;
    }

    throw new Error(`No city found matching: ${city}`);
  } catch (error) {
    console.error(`Error in getAirportCode: ${error.message}`);
    throw new Error(`Failed to get city IATA code: ${error.message}`);
  }
};

module.exports = { getAirportCode };
