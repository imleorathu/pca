import mongoose from "mongoose";

const movieSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, trim: true },
    imdbId: { type: String, trim: true, sparse: true },
    title: { type: String, required: true, trim: true },
    synopsis: { type: String, default: "" },
    tag: String,
    genre: String,
    rating: String,
    runtime: String,
    certificate: String,
    color: String,
    language: { type: String, default: "English" },
    poster: String,
    hero: String,
    seatIcon: String,
    releaseDate: Date,
    trailer: String,
    featured: { type: Boolean, default: false },
    state: {
      type: String,
      enum: ["Now Showing", "Coming Soon"],
      default: "Now Showing",
    },
    times: { type: [String], default: [] },
    active: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false },
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: { type: String, required: true, select: false },
    role: {
      type: String,
      enum: ["customer", "admin", "manager", "cashier"],
      default: "customer",
    },
    loyaltyPoints: { type: Number, default: 0 },
    blocked: { type: Boolean, default: false },
  },
  { timestamps: true, versionKey: false },
);

const bookingSchema = new mongoose.Schema(
  {
    reference: { type: String, required: true, unique: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    guestEmail: { type: String, lowercase: true, trim: true },
    guestName: { type: String, trim: true },
    guestPhone: { type: String, trim: true },
    movieId: { type: String, required: true },
    movieTitle: { type: String, required: true },
    showDate: { type: String, required: true },
    showtime: { type: String, required: true },
    cinema: { type: String, default: "PCA CineMAX" },
    screen: { type: String, default: "Screen 01" },
    paymentMethod: {
      type: String,
      enum: ["card", "cash", "online"],
      default: "card",
    },
    seats: { type: [String], required: true },
    subtotal: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    total: { type: Number, required: true },
    offerCode: String,
    status: {
      type: String,
      enum: ["confirmed", "cancelled"],
      default: "confirmed",
    },
  },
  { timestamps: true, versionKey: false },
);
bookingSchema.index({ movieId: 1, showDate: 1, showtime: 1 });

const offerSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    title: String,
    description: String,
    discountPercent: { type: Number, min: 0, max: 100, default: 0 },
    fixedDiscount: { type: Number, min: 0, default: 0 },
    maxUses: { type: Number, default: 0 },
    uses: { type: Number, default: 0 },
    movieIds: { type: [String], default: [] },
    offerType: { type: String, default: "general" },
    active: { type: Boolean, default: true },
    expiresAt: Date,
  },
  { timestamps: true, versionKey: false },
);

export const Movie = mongoose.model("Movie", movieSchema);
export const User = mongoose.model("User", userSchema);
export const Booking = mongoose.model("Booking", bookingSchema);
export const Offer = mongoose.model("Offer", offerSchema);

const showtimeSchema = new mongoose.Schema(
  {
    movieId: { type: String, required: true },
    movieTitle: String,
    date: { type: String, required: true },
    time: { type: String, required: true },
    screen: { type: String, required: true },
    format: { type: String, enum: ["2D", "3D", "IMAX", "4DX"], default: "2D" },
    language: { type: String, default: "English" },
    price: { type: Number, default: 1800 },
    status: {
      type: String,
      enum: ["scheduled", "cancelled"],
      default: "scheduled",
    },
  },
  { timestamps: true, versionKey: false },
);
showtimeSchema.index(
  { date: 1, time: 1, screen: 1 },
  { unique: true, partialFilterExpression: { status: "scheduled" } },
);
const screenSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    capacity: { type: Number, required: true },
    regularSeats: { type: Number, default: 0 },
    premiumSeats: { type: Number, default: 0 },
    vipSeats: { type: Number, default: 0 },
    wheelchairSeats: { type: Number, default: 0 },
    blockedSeats: { type: [String], default: [] },
    active: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false },
);
const paymentSchema = new mongoose.Schema(
  {
    reference: { type: String, unique: true },
    bookingReference: String,
    amount: Number,
    method: { type: String, enum: ["card", "cash", "online"], default: "card" },
    status: {
      type: String,
      enum: [
        "successful",
        "pending",
        "failed",
        "refunded",
        "partially-refunded",
      ],
      default: "successful",
    },
    refundedAmount: { type: Number, default: 0 },
  },
  { timestamps: true, versionKey: false },
);
const contentSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    type: { type: String, default: "announcement" },
    title: String,
    body: String,
    image: String,
    active: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false },
);
const auditSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    action: String,
    resource: String,
    details: String,
    ip: String,
  },
  { timestamps: true, versionKey: false },
);
export const Showtime = mongoose.model("Showtime", showtimeSchema);
export const Screen = mongoose.model("Screen", screenSchema);
export const Payment = mongoose.model("Payment", paymentSchema);
export const Content = mongoose.model("Content", contentSchema);
export const Audit = mongoose.model("Audit", auditSchema);
