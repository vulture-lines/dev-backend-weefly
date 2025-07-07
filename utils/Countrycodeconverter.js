const countries = require("i18n-iso-countries");

countries.registerLocale(require("i18n-iso-countries/langs/en.json")); 

const Countrycode = (billAddrCountry) => {
  const countryName = billAddrCountry.toLowerCase();
  const alpha2Code = countries.getAlpha2Code(countryName, "en"); 
  const numericCode = countries.alpha2ToNumeric(alpha2Code); 
  return numericCode;
};

module.exports = { Countrycode };
