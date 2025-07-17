const sha512 = require("js-sha512");
const btoa = require("btoa");
const moment = require("moment");
const dotenv = require("dotenv");
const { Countrycode } = require("../utils/Countrycodeconverter");
const { Payment } = require("../models/SISSPPaymentdb");
const { parseStringPromise } = require("xml2js");
dotenv.config();
// Test credentials and config
const posID = process.env.POSID;
const posAuthCode = process.env.POSAUTHCODE;
const merchantID = process.env.MERCHANTID;
const currency = process.env.CURRENCY; // Currency code
const transactionCode = process.env.TRANSACTION_CODE; // Purchase operation

// 3DS Server URL (Test)
const threeDSServerUrl = process.env.THREEDS_SERVER_URL;

// 3DS Server URL (Test)
const vinti4CvUrl = process.env.VINTI_FOUR_CV_URL;
const paymentresponseurl = process.env.PAYMENT_RESPONSE_URL;

// Helper functions
function toBase64(u8) {
  return btoa(String.fromCharCode.apply(null, u8));
}

function generateSHA512StringToBase64(input) {
  return toBase64(sha512.digest(input));
}

function generateFingerprintForRequest(
  posAuthCode,
  timestamp,
  amount,
  merchantRef,
  merchantSession,
  posID,
  currency,
  transactionCode,
  entityCode,
  referenceNumber
) {
  const encodedAutCode = generateSHA512StringToBase64(posAuthCode);

  let toHash =
    encodedAutCode +
    timestamp +
    Number(parseFloat(amount) * 1000) +
    merchantRef.trim() +
    merchantSession.trim() +
    posID.trim() +
    currency.trim() +
    transactionCode.trim();

  if (entityCode) toHash += Number(entityCode.trim());
  if (referenceNumber) toHash += Number(referenceNumber.trim());

  console.log("Request fingerprint string to hash:", toHash);

  const fingerprint = generateSHA512StringToBase64(toHash);
  console.log("Generated request fingerprint:", fingerprint);
  return fingerprint;
}

function generateFingerprintForResponse(
  posAuthCode,
  messageType,
  clearingPeriod,
  transactionID,
  merchantReference,
  merchantSession,
  amount,
  messageID,
  pan,
  merchantResponse,
  timestamp,
  reference,
  entity,
  clientReceipt,
  additionalErrorMessage,
  reloadCode
) {
  if (reference) reference = Number(reference);

  if (entity) entity = Number(entity);
  let toHash =
    generateSHA512StringToBase64(posAuthCode) +
    messageType +
    clearingPeriod +
    transactionID +
    merchantReference +
    merchantSession +
    Number(parseFloat(amount) * 1000) +
    messageID.trim() +
    pan.trim() +
    merchantResponse.trim() +
    timestamp +
    reference +
    entity +
    clientReceipt.trim() +
    additionalErrorMessage.trim() +
    reloadCode.trim();

  console.log("Response fingerprint string to hash:", toHash);

  const fingerprint = generateSHA512StringToBase64(toHash);
  console.log("Generated response fingerprint:", fingerprint);
  return fingerprint;
}

// Initiate payment route
exports.startPayment = async (req, res) => {
  const {
    amount,
    email,
    billAddrCountry,
    billAddrCity,
    billAddrline1,
    billAddrline2,
    billAddrPostCode,
    Paymentdate,
    time,
    expectedAmount,
    expectedCurrency,
    TFBookingReference,
    fakeBooking,
  } = req.body;
  console.log(req.body);
  // const amount = "1000";
  const merchantRef = "R" + moment().format("YYYYMMDDHHmmss");
  const merchantSession = "S" + moment().format("YYYYMMDDHHmmss");
  const dateTime = moment().utc().format("YYYY-MM-DD HH:mm:ss");
  const Country = Countrycode(billAddrCountry);
  console.log(Country);
  // URL to receive payment response
  const responseUrl = paymentresponseurl;
  const purchaseRequestJson = {
    threeDSRequestorID: merchantID,
    threeDSRequestorName: "Test Merchant",
    threeDSRequestorURL: threeDSServerUrl,
    threeDSRequestorChallengeInd: "04",
    email: email,
    // addrMatch: "N",
    billAddrCity: billAddrCity,
    billAddrCountry: Country,
    billAddrLine1: billAddrline1,
    billAddrLine2: billAddrline2 ? billAddrline2 : "",
    // billAddrLine3: "",
    billAddrPostCode: billAddrPostCode,
    // billAddrState: "18",
  };

  const purchaseRequestEncoded = btoa(JSON.stringify(purchaseRequestJson));
  const formData = {
    transactionCode,
    posID,
    merchantRef,
    merchantSession,
    amount,
    currency,
    is3DSec: "1",
    urlMerchantResponse: responseUrl,
    languageMessages: "en",
    timeStamp: dateTime,
    fingerprintversion: "1",
    entityCode: "",
    referenceNumber: "",
    purchaseRequest: purchaseRequestEncoded,
  };

  // Generate fingerprint for request
  formData.fingerprint = generateFingerprintForRequest(
    posAuthCode,
    formData.timeStamp,
    formData.amount,
    formData.merchantRef,
    formData.merchantSession,
    formData.posID,
    formData.currency,
    formData.transactionCode,
    formData.entityCode,
    formData.referenceNumber
  );

  console.log("Sending formData to 3DS Server:", formData);

  // Payment gateway post URL for test environment
  // var postURL =
  //   `${vinti4CvUrl}/CardPayment?FingerPrint=` +
  //   encodeURIComponent(formData.fingerprint) +
  //   "&TimeStamp=" +
  //   encodeURIComponent(formData.timeStamp) +
  //   "&FingerPrintVersion=" +
  //   encodeURIComponent(formData.fingerprintversion);

  var postURL =
    `${threeDSServerUrl}/CardPayment?FingerPrint=` +
    encodeURIComponent(formData.fingerprint) +
    "&TimeStamp=" +
    encodeURIComponent(formData.timeStamp) +
    "&FingerPrintVersion=" +
    encodeURIComponent(formData.fingerprintversion);

  // Build auto-submit form
  let formHtml =
    "<html><head><title>Payment vinti4 Test</title></head><body onload='autoPost()'>";
  formHtml += `<form action="${postURL}" method="post">`;
  Object.keys(formData).forEach((key) => {
    formHtml += `<input type="hidden" name="${key}" value="${formData[key]}">`;
  });
  formHtml += "</form>";
  formHtml +=
    "<script>function autoPost(){document.forms[0].submit();}</script>";
  formHtml += "</body></html>";
  console.log(typeof formHtml);
  try {
    await Payment.create({
      transactionid: "PATX" + time,
      paymentdate: Paymentdate,
      paymentamount: amount,
      senderemail: email,
      billAddrCountry: Country,
      billAddrCity: billAddrCity,
      billAddrLine1: billAddrline1,
      billAddrLine2: billAddrline2 ? billAddrline2 : "",
      billAddrPostCode: billAddrPostCode,
      merchantSession: merchantSession,
      Recievername: "Weefly",
      Paymentresponse: "Pending",
      Paymentstatus: "Pending", // give default valid value
      Refundstatus: "None", // give default valid value
      TravelfusionBookingDetails: {
        expectedAmount,
        expectedCurrency,
        TFBookingReference,
        fakeBooking,
      },
    });
  } catch (error) {
    console.error(error);
  }

  res.send(formHtml);
};

// Payment response endpoint to validate response fingerprint
exports.Paymentresponse = async (req, res) => {
  let Paymentstatus;
  const successMessageTypes = ["8", "10", "M", "P"];
  const body = req.body;
  console.log("Payment response received:", body);
  const travelFusionApi = process.env.FLIGHT_API;
  if (successMessageTypes.includes(body.messageType)) {
    const calculatedFingerprint = generateFingerprintForResponse(
      posAuthCode,
      body.messageType,
      body.merchantRespCP,
      body.merchantRespTid,
      body.merchantRespMerchantRef,
      body.merchantRespMerchantSession,
      body.merchantRespPurchaseAmount,
      body.merchantRespMessageID,
      body.merchantRespPan,
      body.merchantResp,
      body.merchantRespTimeStamp,
      body.merchantRespReferenceNumber,
      body.merchantRespEntityCode,
      body.merchantRespClientReceipt,
      body.merchantRespAdditionalErrorMessage,
      body.merchantRespReloadCode
    );

    if (body.resultFingerPrint === calculatedFingerprint) {
      Paymentstatus = "success";
      try {
        const updatedPayment = await Payment.findOne().sort({ _id: -1 });
        const bookingDetails = updatedPayment.TravelfusionBookingDetails;
        console.log("Intiating Booking Process!!", bookingDetails);
        const startBookingResult = await fetch(
          `${travelFusionApi}/start-booking`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(bookingDetails),
          }
        );

        const responseText = await startBookingResult.text();
        const contentType = startBookingResult.headers.get("content-type");

        let startBookingData;
        let TFBookingReference;

        try {
          if (contentType?.includes("application/json")) {
            startBookingData = JSON.parse(responseText);
            TFBookingReference = startBookingData.TFBookingReference;
          } else if (
            contentType?.includes("application/xml") ||
            contentType?.includes("text/xml")
          ) {
            const parsedXml = await parseStringPromise(responseText);
            startBookingData = parsedXml;
            console.log(parsedXml);
          } else {
            console.error("Unsupported content-type:", contentType);
            console.error("Raw response from start-booking:", responseText);
            throw new Error("Unsupported content-type: " + contentType);
          }

          if (!TFBookingReference) {
            throw new Error("TFBookingReference not found in parsed response");
          }

          console.log("start-booking TFBookingReference:", TFBookingReference);
        } catch (err) {
          console.error("Failed to parse start-booking response:", err.message);
          return res.status(502).json({
            error: "Invalid start-booking response",
            details: err.message,
          });
        }

        await Payment.findOneAndUpdate(
          { merchantSession: body.merchantRespMerchantSession },
          {
            Paymentresponse: body,
            Paymentstatus: Paymentstatus,
          }
        );
        await new Promise((resolve) => setTimeout(resolve, 10000));

        console.log("Checking Booking status");
        const checkBookingResponse = await fetch(
          `${travelFusionApi}/check-booking`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ TFBookingReference }),
          }
        );

        const checkBookingResult = await checkBookingResponse.json();
        console.log("check-booking response", checkBookingResult);
        const bookingStatus = checkBookingResult.additionalInfo.Status[0];
        console.log(
          `Booking status: ${checkBookingResult.additionalInfo.Status[0]}`
        );
        await Payment.findOneAndUpdate(
          { merchantSession: body.merchantRespMerchantSession },
          {
            $set: {
              "TravelfusionBookingDetails.BookingStatus":
                checkBookingResult.additionalInfo.Status[0],
            },
          }
        );
        if (bookingStatus.toLowerCase() === "succeeded") {
          res.status(201).redirect(process.env.SUCCESS_URL);
        } else if (bookingStatus.toLowerCase() === "failed") {
          res.status(500).redirect(process.env.UNSUCCESS_URL);
        }
      } catch (error) {
        console.error(error);
      }
    } else {
      Paymentstatus = "failure";
      console.log("works");
      try {
        await Payment.findOneAndUpdate(
          { merchantSession: body.merchantRespMerchantSession },
          {
            Paymentresponse: body,
            Paymentstatus: Paymentstatus,
          }
        );
        res.status(422).redirect(process.env.UNSUCCESS_URL);
      } catch (error) {
        console.error(error + "f");
      }
    }
  } else if (body.UserCancelled === "true") {
    Paymentstatus = "UserCancelled Payment";
    try {
      await Payment.findOneAndUpdate(
        { merchantSession: body.merchantSession },
        {
          Paymentresponse: body,
          Paymentstatus: Paymentstatus,
        }
      );
      res.status(500).json({
        status: "ServerError",
        message: "Internal Server Error",
      });
    } catch (error) {
      console.error(error);
    }
  } else {
    Paymentstatus = "SISP Failed Payment";
    try {
      const paymentDetail = await Payment.findOne().sort({ _id: -1 });
      paymentDetail.Paymentstatus = Paymentstatus;
      paymentDetail.Paymentresponse = body;
      await paymentDetail.save();
      res.status(500).json({
        status: "ServerError",
        message: "External Server Error",
      });
    } catch (error) {
      console.error(error);
    }
  }
};
