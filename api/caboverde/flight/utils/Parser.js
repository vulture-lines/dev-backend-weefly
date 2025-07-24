function classifyTravelOptions(jsonData) {
  const options =
    jsonData["S:Envelope"]?.["S:Body"]?.["ns2:GetAvailabilityResponse"]?.[
      "Availability"
    ]?.["availabilityResultList"]?.["availabilityRouteList"]?.[
      "availabilityByDateList"
    ]?.["originDestinationOptionList"];

  if (!options) return [];

  const normalizedList = Array.isArray(options) ? options : [options];

  return normalizedList.map((option, idx) => {
    const fareGroups = option.fareComponentGroupList;
    const fareGroupList = Array.isArray(fareGroups) ? fareGroups : [fareGroups];

    const segmentCounts = fareGroupList.map((group) => {
      const bound = group.boundList;
      const segments = bound.availFlightSegmentList;
      return Array.isArray(segments) ? segments.length : 1;
    });

    const totalFareGroups = fareGroupList.length;
    const totalSegments = segmentCounts.reduce((sum, n) => sum + n, 0);

    let type = "Unknown";
    if (totalFareGroups === 1 && totalSegments === 1) {
      type = "Direct flight with one fare";
    } else if (totalFareGroups === 1 && totalSegments > 1) {
      type = "Connecting flight with beyond fare";
    } else if (totalFareGroups > 1) {
      type = "Connecting flight without beyond fare";
    }

    return {
      optionIndex: idx,
      totalFareGroups,
      totalSegments,
      type,
    };
  });
}

function transformAvailabilityToFlightList(parsedData) {
  const raw =
    parsedData["S:Envelope"]?.["S:Body"]?.["ns2:GetAvailabilityResponse"]
      ?.Availability?.availabilityResultList?.availabilityRouteList
      ?.availabilityByDateList;

  if (!raw) return [];

  const flightOptions = [];

  const originOptionList = Array.isArray(raw.originDestinationOptionList)
    ? raw.originDestinationOptionList
    : [raw.originDestinationOptionList];

  originOptionList.forEach((option) => {
    const fareGroups = Array.isArray(option.fareComponentGroupList)
      ? option.fareComponentGroupList
      : [option.fareComponentGroupList];

    fareGroups.forEach((group) => {
      const segmentList = Array.isArray(group.boundList.availFlightSegmentList)
        ? group.boundList.availFlightSegmentList
        : [group.boundList.availFlightSegmentList];

      const fares = Array.isArray(group.fareComponentList)
        ? group.fareComponentList
        : [group.fareComponentList];

      segmentList.forEach((segment) => {
        const seg = segment.flightSegment;

        const flightDetails = {
          flightNumber: seg.flightNumber,
          airline: `${seg.airline.companyFullName} (${seg.airline.code})`,
          departure: {
            airportCode: seg.departureAirport.locationCode,
            airportName: seg.departureAirport.locationName,
            city: seg.departureAirport.cityInfo.city.locationName,
            country: seg.departureAirport.cityInfo.country.locationName,
            time: seg.departureDateTime,
          },
          arrival: {
            airportCode: seg.arrivalAirport.locationCode,
            airportName: seg.arrivalAirport.locationName,
            city: seg.arrivalAirport.cityInfo.city.locationName,
            country: seg.arrivalAirport.cityInfo.country.locationName,
            time: seg.arrivalDateTime,
          },
          duration: seg.journeyDuration,
          fares: [],
        };

        fares.forEach((fareSet) => {
          const passengers = fareSet.passengerFareInfoList;
          const paxList = Array.isArray(passengers) ? passengers : [passengers];

          paxList.forEach((pax) => {
            const fare = pax.fareInfoList;
            const pricing = pax.pricingInfo;

            flightDetails.fares.push({
              fareGroupName: fare.fareGroupName,
              cabin: fare.cabin,
              passengerType: pax.passengerTypeQuantity.passengerType.code,
              quantity: pax.passengerTypeQuantity.quantity,
              baseFare: pricing.baseFare.amount.value,
              tax: pricing.taxes.totalAmount.value,
              total: pricing.totalFare.amount.value,
              currency: pricing.totalFare.amount.currency.code,
            });
          });

          // Attach total fare for all passengers (from pricingOverview)
          if (fareSet.pricingOverview?.totalAmount?.value) {
            flightDetails.totalFareAllPassengers =
              fareSet.pricingOverview.totalAmount.value;
          }
        });

        flightOptions.push(flightDetails);
      });
    });
  });

  return flightOptions;
}
function buildBookFlightSegmentList(
  parsedData,
  routeIndex = 0,
  odOptionIndex = 0,
  fareComponentIndex = 0
) {
  const availability =
    parsedData?.["S:Envelope"]?.["S:Body"]?.["ns2:GetAvailabilityResponse"]
      ?.Availability;

  const availabilityRouteListRaw =
    availability?.availabilityResultList?.availabilityRouteList;
  if (!availabilityRouteListRaw) return [];

  const routeList = Array.isArray(availabilityRouteListRaw)
    ? availabilityRouteListRaw
    : [availabilityRouteListRaw];

  const selectedRoute = routeList[routeIndex];
  if (!selectedRoute) return [];

  const dateListRaw = selectedRoute.availabilityByDateList;
  const dateList = Array.isArray(dateListRaw) ? dateListRaw : [dateListRaw];

  const selectedDate = dateList[0];
  if (!selectedDate) return [];

  const odOptionsRaw = selectedDate.originDestinationOptionList;
  const odOptions = Array.isArray(odOptionsRaw) ? odOptionsRaw : [odOptionsRaw];
  const selectedOption = odOptions[odOptionIndex];
  if (!selectedOption) return [];

  const fareGroupRaw = selectedOption.fareComponentGroupList;
  const fareGroups = Array.isArray(fareGroupRaw)
    ? fareGroupRaw
    : [fareGroupRaw];

  const bookFlightSegmentList = [];

  fareGroups.forEach((fareGroup) => {
    const segmentListRaw = fareGroup.boundList?.availFlightSegmentList;
    const segments = Array.isArray(segmentListRaw)
      ? segmentListRaw
      : [segmentListRaw];

    const fareComponentListRaw = fareGroup.fareComponentList;
    const fareComponentList = Array.isArray(fareComponentListRaw)
      ? fareComponentListRaw
      : [fareComponentListRaw];

    const fareComponent = fareComponentList[fareComponentIndex];
    if (!fareComponent) return;

    const paxListRaw = fareComponent.passengerFareInfoList;
    const paxList = Array.isArray(paxListRaw) ? paxListRaw : [paxListRaw];

    const adultPax = paxList.find(
      (p) => p?.passengerTypeQuantity?.passengerType?.code === "ADLT"
    );
    if (!adultPax || !adultPax.fareInfoList) return;

    const fareInfosRaw = adultPax.fareInfoList;
    const fareInfos = Array.isArray(fareInfosRaw)
      ? fareInfosRaw
      : [fareInfosRaw];

    segments.forEach((segmentWrapper, idx) => {
      const flightSegment = segmentWrapper?.flightSegment;
      const sequence = String(idx + 1); // flightSegmentSequence = "1", "2", ...

      const matchingFareInfo = fareInfos.find(
        (f) => String(f.flightSegmentSequence) === sequence
      );

      if (!flightSegment || !matchingFareInfo) return;

      const resBookDesigRaw = matchingFareInfo.resBookDesigQuantity;
      const resBookDesigQuantity = Array.isArray(resBookDesigRaw)
        ? resBookDesigRaw
        : [resBookDesigRaw];

      bookFlightSegmentList.push({
        flightSegment,
        fareInfo: matchingFareInfo,
        bookingClass: {
          resBookDesigQuantity,
        },
      });
    });
  });

  return bookFlightSegmentList;
}


function flattenSegments(parsed, routeIndex = 0, optionIndex = 0, fareIndex = 0) {
  try {
    const envelope = parsed["Envelope"] || parsed["soapenv:Envelope"];
    if (!envelope) throw new Error("Missing Envelope");

    const body = envelope["Body"] || envelope["soapenv:Body"];
    if (!body) throw new Error("Missing Body");

    const availabilityResponse =
      body["GetAvailabilityResponse"] || body["impl:GetAvailabilityResponse"];
    if (!availabilityResponse) throw new Error("Missing GetAvailabilityResponse");

    const airAvailabilityReply =
      availabilityResponse["AirAvailabilityReply"] || availabilityResponse["impl:AirAvailabilityReply"];
    if (!airAvailabilityReply) throw new Error("Missing AirAvailabilityReply");

    const routes = airAvailabilityReply.availabilityRouteList;
    if (!routes) throw new Error("Missing availabilityRouteList");

    const routeList = Array.isArray(routes) ? routes : [routes];
    const route = routeList[routeIndex];

    const options = route.availabilityByDateList.originDestinationOptionList;
    const optionList = Array.isArray(options) ? options : [options];
    const option = optionList[optionIndex];

    const fareGroup = option.fareComponentGroupList;
    const fareComponent = fareGroup.fareComponentList[fareIndex];

    const flightSegments = Array.isArray(fareGroup.boundList.availFlightSegmentList)
      ? fareGroup.boundList.availFlightSegmentList
      : [fareGroup.boundList.availFlightSegmentList];

    const fareInfos = Array.isArray(fareComponent.passengerFareInfoList.fareInfoList)
      ? fareComponent.passengerFareInfoList.fareInfoList
      : [fareComponent.passengerFareInfoList.fareInfoList];

    return flightSegments.map((segment, i) => ({
      flightSegment: {
        flightSegmentID: segment.flightSegmentID,
        flightNumber: segment.flightNumber,
        airline: { code: segment.airline.code },
        departureAirport: { locationCode: segment.departureAirport.locationCode },
        arrivalAirport: { locationCode: segment.arrivalAirport.locationCode },
        departureDateTime: segment.departureDateTime,
        arrivalDateTime: segment.arrivalDateTime,
      },
      fareInfo: {
        cabin: fareInfos[i]?.cabin,
        fareReferenceCode: fareInfos[i]?.fareReferenceCode,
        fareReferenceID: fareInfos[i]?.fareReferenceID,
        fareReferenceName: fareInfos[i]?.fareReferenceName,
        resBookDesigCode: fareInfos[i]?.resBookDesigCode,
        flightSegmentSequence: fareInfos[i]?.flightSegmentSequence,
      },
      bookingClass: [
        {
          resBookDesigCode: fareInfos[i]?.resBookDesigCode,
          resBookDesigQuantity: fareInfos[i]?.resBookDesigQuantity,
        },
      ],
    }));
  } catch (err) {
    console.error("Error in flattenSegments:", err);
    return [];
  }
}
const extractBookFlightSegmentList = (availabilityResponse, selectionIndex = 0) => {
  try {
    const routeList = availabilityResponse?.['soapenv:Envelope']
      ?.['soapenv:Body']?.GetAvailabilityResponse?.AirAvailabilityReply?.availabilityRouteList;

    if (!routeList || !Array.isArray(routeList)) throw new Error("Invalid availabilityRouteList");

    const bookFlightSegmentList = [];

    for (let routeIndex = 0; routeIndex < routeList.length; routeIndex++) {
      const availabilityByDateList = routeList[routeIndex]?.availabilityByDateList;

      const originOption = availabilityByDateList?.originDestinationOptionList?.[selectionIndex];
      const fareComponentGroups = originOption?.fareComponentGroupList;

      fareComponentGroups.forEach((group, groupIndex) => {
        const bounds = group?.boundList || [];
        const fareComponent = group?.fareComponentList?.[selectionIndex];

        const adultFareInfo = fareComponent?.passengerFareInfoList?.find(
          (pf) => pf?.passengerTypeQuantity?.passengerType?.code === "ADLT"
        );

        if (!adultFareInfo) throw new Error("No adult fareInfo found");

        const fareInfoList = Array.isArray(adultFareInfo.fareInfoList)
          ? adultFareInfo.fareInfoList
          : [adultFareInfo.fareInfoList];

        bounds.forEach((bound) => {
          const segments = bound?.availFlightSegmentList || [];

          segments.forEach((seg, idx) => {
            const fs = seg?.flightSegment;
            const sequence = idx + 1;

            const matchingFareInfo = fareInfoList.find(
              (f) => parseInt(f.flightSegmentSequence) === sequence
            );

            if (!matchingFareInfo) {
              throw new Error(`No fareInfo for sequence ${sequence}`);
            }

            bookFlightSegmentList.push({
              flightSegment: {
                flightSegmentID: fs.flightSegmentID,
                flightNumber: fs.flightNumber,
                airline: fs.airline,
                departureAirport: fs.departureAirport,
                arrivalAirport: fs.arrivalAirport,
                departureDateTime: fs.departureDateTime,
                arrivalDateTime: fs.arrivalDateTime,
              },
              fareInfo: {
                cabin: matchingFareInfo.cabin,
                fareReferenceCode: matchingFareInfo.fareReferenceCode,
                fareReferenceID: matchingFareInfo.fareReferenceID,
                fareReferenceName: matchingFareInfo.fareReferenceName,
                resBookDesigCode: matchingFareInfo.resBookDesigCode,
                flightSegmentSequence: matchingFareInfo.flightSegmentSequence,
              },
              bookingClass: [
                {
                  resBookDesigCode: matchingFareInfo.resBookDesigCode,
                  resBookDesigQuantity:
                    matchingFareInfo?.resBookDesigQuantity?.[0] || "1",
                },
              ],
            });
          });
        });
      });
    }

    return bookFlightSegmentList;
  } catch (error) {
    console.error("Error in extractBookFlightSegmentList:", error.message);
    return [];
  }
};

module.exports={buildBookFlightSegmentList,transformAvailabilityToFlightList,classifyTravelOptions,  flattenSegments,extractBookFlightSegmentList}