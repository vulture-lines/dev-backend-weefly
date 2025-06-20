/* Function to generate Amadeus Access Token */
const getAccessToken = async () => {
  try {
    const tokenResponse = await fetch(
      "https://test.api.amadeus.com/v1/security/oauth2/token",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          client_id: process.env.AMADEUS_API_KEY,
          client_secret: process.env.AMADEUS_API_SECRET,
        }),
      }
    );

    const tokenData = await tokenResponse.json();
    return tokenData.access_token;
  } catch (error) {
    console.error("Error getting access token:", error);
  }
};

module.exports = { getAccessToken };
