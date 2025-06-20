const nlp = require("compromise");

function Extractcityname(text) {
  try {
    const cleaned = text.replace(/[,]/g, " "); // remove commas
    const doc = nlp(cleaned);
    const places = doc.match("#Place").out("array");

    // console.log(places);
    return places;
    // const doc = nlp(text);
    // const places = doc.places().json();
    // const cities = places.map(place => place.text);
    // console.log(cities);
  } catch (error) {
    console.log(error);
  }
}

module.exports = { Extractcityname };
