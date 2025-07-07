const mongoose = require("mongoose");
const { Schema } = mongoose;

const paymentSchema = new Schema({
  transactionid: { type: String, required: true },
  merchantSession:{ type: String, required: true },
  paymentdate: { type: String, required: true },
  paymentamount: { type: String, required: true },
  senderemail: { type: String, required: true },
  billAddrCountry: { type: String, required: true },
  billAddrCity: { type: String, required: true },
  billAddrLine1: { type: String, required: true },
  billAddrLine2: { type: String },
  billAddrPostCode: { type: String, required: true },
  Recievername: { type: String, required: true },
  Paymentresponse: { type: Schema.Types.Mixed, required: true },
  Paymentstatus: { type: String, required: true },
  Refundstatus: { type: String, required: true },
  TravelfusionBookingDetails : { type: Schema.Types.Mixed },
  TravelfusionBookingStatus : { type: String},
});

const Payment = mongoose.model("Payment", paymentSchema);

module.exports = { Payment };
