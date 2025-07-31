// controllers/commissionController.js

const commissionDetails = require("../models/Commission");
const { Payment } = require("../models/SISSPPaymentdb");
exports.addCommissionAndTax = async (req, res) => {
  try {
    const { commission, tax, type } = req.body;

    if (commission == null || tax == null || type == "") {
      return res
        .status(400)
        .json({ message: "Commission and tax are required" });
    }

    const newEntry = new commissionDetails({
      Commission: commission,
      Tax: tax,
      CommissionType: type,
    });

    await newEntry.save();

    res.json({ message: "Commission and Tax added successfully", status: 200 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Something went wrong" });
  }
};

exports.getDetails = async (req, res) => {
  const commissionDetail = await commissionDetails.find();
  res.status(200).json({ commissionDetail });
};

exports.getCommisionDetails = async (req, res) => {
  const commissionDetail = await commissionDetails.findOne().sort({ _id: -1 });
  res.status(200).json({ commissionDetail });
};

exports.getTicketDetail = async (req, res) => {
  const ticketId = req.params.ticketId;
  try {
    const doc = await Payment.findOne({
      "TravelfusionBookingDetails.BookingCheckResponse.additionalInfo.SupplierReference":
        ticketId,
    });
    console.log(doc);

    if (doc) {
      return res.status(200).json({
        details:doc
      });
    } else {
      return res.status(404).json({ message: "Ticket not found" });
    }
  } catch (error) {
    console.error(error);
  }
};
