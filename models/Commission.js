const mongoose = require("mongoose");
const { Schema } = mongoose;

const commissionSchema = new Schema({
  Tax: {
    type: Number,
  },
  Commission: {
    type: Number,
  },
  CommissionType: { type: String },
  Createdat: { type: String },
});

function formatDateToLocalMinute(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

commissionSchema.pre("save", function (next) {
  const now = formatDateToLocalMinute(new Date());
  if (!this.Createdat) this.Createdat = now;
  next();
});
const commissionDetails = mongoose.model("commission", commissionSchema);

module.exports = commissionDetails;
