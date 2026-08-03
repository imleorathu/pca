import dotenv from "dotenv";
dotenv.config({ path: new URL("../.env", import.meta.url) });
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import path from "path";
import crypto from "crypto";
import fs from "fs";
import multer from "multer";
import { fileURLToPath } from "url";
import {
  Movie,
  User,
  Booking,
  Offer,
  Showtime,
  Screen,
  Payment,
  Content,
  Audit,
} from "./models.js";
import { optionalAuth, requireAuth, requireAdmin, signToken } from "./auth.js";
import { seedDatabase, seedMovies } from "./seed.js";
import { getImdbTitle, imdbConfigured, searchImdb } from "./imdb.js";

const app = express();
app.disable("x-powered-by");
const clientOrigins = [
  "https://pca-chi.vercel.app",
  ...String(process.env.CLIENT_URL || "").split(","),
]
  .map((origin) => origin.trim().replace(/\/$/, ""))
  .filter(Boolean);
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || !clientOrigins.length || clientOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`Origin ${origin} is not allowed by CORS`));
    },
  }),
);
app.use(express.json({ limit: "100kb" }));
app.use(optionalAuth);
const uploadsDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../uploads",
);
fs.mkdirSync(uploadsDir, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({
    destination: uploadsDir,
    filename: (req, file, cb) =>
      cb(
        null,
        `${Date.now()}-${crypto.randomBytes(3).toString("hex")}${path.extname(file.originalname).toLowerCase()}`,
      ),
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, file.mimetype.startsWith("image/")),
});
app.use("/uploads", express.static(uploadsDir));
let databaseReady = false;
let databaseStatus = "connecting";
const memoryBookings = [];
const asyncRoute = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
const ratingCache = new Map();
const cleanUser = (user) => ({
  id: String(user._id),
  name: user.name,
  email: user.email,
  role: user.role,
});
const validEmail = (value) => /^\S+@\S+\.\S+$/.test(value || "");

app.get("/api/health", (req, res) =>
  res.json({
    ok: true,
    database: databaseReady ? "mongodb" : "memory",
    databaseStatus,
    ...(databaseError ? { databaseError } : {}),
    timestamp: new Date().toISOString(),
  }),
);
app.get(
  "/api/db/debug",
  asyncRoute(async (req, res) => {
    const net = await import("net");
    const dns = await import("dns/promises");
    const srvHosts = [];
    let seedHosts = [];
    let scheme = "none";
    if (mongoUri) {
      scheme = mongoUri.startsWith("mongodb+srv://") ? "srv" : "direct";
      if (scheme === "srv") {
        const match = mongoUri.match(/^mongodb\+srv:\/\/[^@]*@([^/?#]+)/);
        if (match) {
          try {
            const records = await dns.resolveSrv(`_mongodb._tcp.${match[1]}`);
            srvHosts.push(...records.map((record) => record.name));
          } catch (error) {
            srvHosts.push(`srv-error:${error.code}`);
          }
        }
        seedHosts = srvHosts;
      } else {
        seedHosts = mongoUri
          .replace(/^mongodb:\/\//, "")
          .split("?")[0]
          .split(",")
          .map((host) => host.replace(/^[^@]+@/, "").split(":")[0])
          .filter(Boolean);
      }
    }
    const results = [];
    for (const host of [...new Set(seedHosts)]) {
      let ips = [];
      try {
        ips = await dns.resolve4(host);
      } catch (error) {
        ips = [`dns-error:${error.code}`];
      }
      const tcp = [];
      for (const ip of ips) {
        if (String(ip).startsWith("dns-error")) {
          tcp.push(ip);
          continue;
        }
        const outcome = await new Promise((resolve) => {
          const socket = new net.Socket();
          let done = false;
          const finish = (label) => {
            if (done) return;
            done = true;
            socket.destroy();
            resolve(label);
          };
          socket.setTimeout(4000);
          socket.once("connect", () => finish("connected"));
          socket.once("timeout", () => finish("timed-out"));
          socket.once("error", (error) => finish(`error:${error.code}`));
          socket.connect(27017, ip);
        });
        tcp.push(`${ip}:27017 ${outcome}`);
        if (outcome === "connected") break;
      }
      const tls = await new Promise((resolve) => {
        import("tls").then(({ default: tlsModule }) => {
          const socket = tlsModule.connect({
            host: ips.find((value) => !String(value).startsWith("dns-error")) || host,
            port: 27017,
            servername: host,
            rejectUnauthorized: true,
            timeout: 5000,
          });
          let done = false;
          const finish = (label) => {
            if (done) return;
            done = true;
            socket.destroy();
            resolve(label);
          };
          socket.once("secureConnect", () => finish("tls-ok"));
          socket.once("timeout", () => finish("tls-timed-out"));
          socket.once("error", (error) => finish(`tls-error:${error.code || error.message}`));
        });
      });
      results.push({ host, ips, tcp, tls });
    }
    const flattenError = (error, depth = 0) => {
      if (!error || depth > 5) return null;
      return {
        name: error.name,
        message: String(error.message || "").replace(/\/\/[^:@\s]+@/, "//***:***@"),
        code: error.code,
        codeName: error.codeName,
        reason: flattenError(error.reason || error.cause, depth + 1),
      };
    };
    let connectTest = null;
    if (mongoUri) {
      try {
        await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 10000 });
        connectTest = { result: "connected" };
        await mongoose.disconnect().catch(() => {});
      } catch (error) {
        connectTest = { result: "failed", error: flattenError(error) };
      }
    }
    res.json({
      uriScheme: scheme,
      databaseStatus,
      sanitizedUri: mongoUri
        ? mongoUri.replace(/\/\/[^@]+@/, "//***:***@")
        : null,
      results,
      connectTest,
    });
  }),
);
app.get(
  "/api/ratings/imdb/:id",
  asyncRoute(async (req, res) => {
    const imdbId = String(req.params.id || "");
    if (!/^tt\d+$/.test(imdbId))
      return res
        .status(400)
        .json({ message: "A valid IMDb title ID is required" });
    const cached = ratingCache.get(imdbId);
    if (cached && cached.expires > Date.now()) return res.json(cached.value);
    if (!process.env.OMDB_API_KEY)
      return res
        .status(503)
        .json({ message: "OMDb ratings API is not configured" });
    const url = new URL("https://www.omdbapi.com/");
    url.searchParams.set("apikey", process.env.OMDB_API_KEY);
    url.searchParams.set("i", imdbId);
    url.searchParams.set("plot", "short");
    const response = await fetch(url);
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.Response === "False")
      return res
        .status(response.ok ? 404 : response.status)
        .json({ message: data.Error || "OMDb rating request failed" });
    const rating =
      data.imdbRating && data.imdbRating !== "N/A"
        ? Number(data.imdbRating)
        : null;
    const votes =
      data.imdbVotes && data.imdbVotes !== "N/A" ? data.imdbVotes : null;
    if (rating == null)
      return res
        .status(502)
        .json({ message: "The IMDb provider returned no rating" });
    const value = {
      imdbId,
      rating,
      votes,
      source: "OMDb",
      title: data.Title,
      year: data.Year,
    };
    ratingCache.set(imdbId, {
      value,
      expires: Date.now() + 6 * 60 * 60 * 1000,
    });
    res.json(value);
  }),
);
app.post(
  "/api/admin/upload",
  requireAdmin,
  upload.single("image"),
  (req, res) =>
    req.file
      ? res.status(201).json({
          url: `/uploads/${req.file.filename}`,
          name: req.file.originalname,
        })
      : res.status(400).json({ message: "A valid image file is required" }),
);
app.get("/api/admin/imdb/status", requireAdmin, (req, res) =>
  res.json({
    configured: imdbConfigured(),
    provider: "IMDb GraphQL API via AWS Data Exchange",
  }),
);
app.get(
  "/api/admin/imdb/search",
  requireAdmin,
  asyncRoute(async (req, res) => {
    const term = String(req.query.q || "").trim();
    if (term.length < 2)
      return res.status(400).json({ message: "Enter at least two characters" });
    res.json(await searchImdb(term));
  }),
);
app.get(
  "/api/admin/imdb/title/:id",
  requireAdmin,
  asyncRoute(async (req, res) => {
    const movie = await getImdbTitle(req.params.id);
    return movie
      ? res.json(movie)
      : res.status(404).json({ message: "IMDb title not found" });
  }),
);

app.post(
  "/api/auth/register",
  asyncRoute(async (req, res) => {
    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "")
      .trim()
      .toLowerCase();
    const password = String(req.body.password || "");
    if (!name || !validEmail(email) || password.length < 8)
      return res.status(400).json({
        message:
          "Name, valid email, and password of at least 8 characters are required",
      });
    if (!databaseReady)
      return res.status(503).json({ message: "Registration requires MongoDB" });
    if (await User.exists({ email }))
      return res.status(409).json({
        message: "An account already exists for this email. Sign in instead.",
      });
    let user;
    try {
      user = await User.create({
        name,
        email,
        passwordHash: await bcrypt.hash(password, 12),
        role: "customer",
      });
    } catch (error) {
      if (error.code === 11000)
        return res.status(409).json({
          message: "An account already exists for this email. Sign in instead.",
        });
      if (error.name === "ValidationError")
        return res.status(400).json({ message: error.message });
      throw error;
    }
    res.status(201).json({ token: signToken(user), user: cleanUser(user) });
  }),
);
app.post(
  "/api/auth/login",
  asyncRoute(async (req, res) => {
    const { email, password } = req.body;
    if (!validEmail(email) || !password)
      return res
        .status(400)
        .json({ message: "Email and password are required" });
    const user = await User.findOne({ email: email.toLowerCase() }).select(
      "+passwordHash",
    );
    if (!user || !(await bcrypt.compare(password, user.passwordHash)))
      return res.status(401).json({ message: "Incorrect email or password" });
    res.json({ token: signToken(user), user: cleanUser(user) });
  }),
);
app.get("/api/auth/me", requireAuth, (req, res) =>
  res.json({ user: cleanUser(req.user) }),
);

app.get(
  "/api/movies",
  asyncRoute(async (req, res) => {
    if (!databaseReady) return res.json([]);
    const filter = { active: { $ne: false } };
    if (req.query.genre) filter.genre = req.query.genre;
    const movies = await Movie.find(filter)
      .sort({ featured: -1, createdAt: -1 })
      .lean();
    res.json(movies);
  }),
);
app.get(
  "/api/movies/:id",
  asyncRoute(async (req, res) => {
    const movie = databaseReady
      ? await Movie.findOne({ id: req.params.id }).lean()
      : seedMovies.find((item) => item.id === req.params.id);
    return movie
      ? res.json(movie)
      : res.status(404).json({ message: "Movie not found" });
  }),
);
app.get(
  "/api/admin/movies",
  requireAdmin,
  asyncRoute(async (req, res) =>
    res.json(await Movie.find().sort({ featured: -1, createdAt: -1 }).lean()),
  ),
);
app.delete(
  "/api/admin/movies/:id",
  requireAdmin,
  asyncRoute(async (req, res) => {
    const movie = await Movie.findByIdAndDelete(req.params.id);
    if (!movie) return res.status(404).json({ message: "Movie not found" });
    await Showtime.deleteMany({ movieId: movie.id });
    await audit(req, "DELETE", "movie", movie.id);
    res.json({ message: "Movie and its showtimes deleted" });
  }),
);
app.post(
  "/api/movies",
  requireAdmin,
  asyncRoute(async (req, res) => {
    if (!req.body.id || !req.body.title)
      return res
        .status(400)
        .json({ message: "Movie id and title are required" });
    const movie = await Movie.create(req.body);
    await audit(req, "CREATE", "movie", movie.id);
    res.status(201).json(movie);
  }),
);
app.patch(
  "/api/movies/:id",
  requireAdmin,
  asyncRoute(async (req, res) => {
    if (req.body.featured === true)
      await Movie.updateMany(
        { id: { $ne: req.params.id } },
        { $set: { featured: false } },
      );
    const movie = await Movie.findOneAndUpdate(
      { id: req.params.id },
      { $set: req.body },
      { new: true, runValidators: true },
    );
    if (movie) await audit(req, "UPDATE", "movie", movie.id);
    return movie
      ? res.json(movie)
      : res.status(404).json({ message: "Movie not found" });
  }),
);
app.delete(
  "/api/movies/:id",
  requireAdmin,
  asyncRoute(async (req, res) => {
    const movie = await Movie.findOneAndUpdate(
      { id: req.params.id },
      { active: false },
      { new: true },
    );
    return movie
      ? res.json({ message: "Movie archived" })
      : res.status(404).json({ message: "Movie not found" });
  }),
);

app.get(
  "/api/showtimes",
  asyncRoute(async (req, res) => {
    const source = databaseReady
      ? await Movie.find({ active: { $ne: false } }).lean()
      : [];
    res.json(
      source.flatMap((movie) =>
        movie.times.map((time) => ({
          movieId: movie.id,
          movieTitle: movie.title,
          time,
        })),
      ),
    );
  }),
);
app.get(
  "/api/screens",
  asyncRoute(async (req, res) =>
    res.json(
      databaseReady ? await Screen.find({ active: { $ne: false } }).lean() : [],
    ),
  ),
);
app.get(
  "/api/showtimes/:movieId/seats",
  asyncRoute(async (req, res) => {
    const { date, time, screen } = req.query;
    if (!date || !time)
      return res
        .status(400)
        .json({ message: "date and time query parameters are required" });
    const rows = databaseReady
      ? await Booking.find({
          movieId: req.params.movieId,
          showDate: date,
          showtime: time,
          ...(screen ? { screen } : {}),
          status: "confirmed",
        })
          .select("seats -_id")
          .lean()
      : memoryBookings.filter(
          (b) =>
            b.movieId === req.params.movieId &&
            b.showDate === date &&
            b.showtime === time &&
            (!screen || b.screen === screen),
        );
    res.json({ occupied: [...new Set(rows.flatMap((b) => b.seats))] });
  }),
);

app.get(
  "/api/offers",
  asyncRoute(async (req, res) => {
    const now = new Date();
    res.json(
      databaseReady
        ? await Offer.find({
            active: true,
            $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
          }).lean()
        : [],
    );
  }),
);
app.post(
  "/api/offers/validate",
  asyncRoute(async (req, res) => {
    const offer = databaseReady
      ? await Offer.findOne({
          code: String(req.body.code || "").toUpperCase(),
          active: true,
        }).lean()
      : null;
    if (!offer || (offer.expiresAt && offer.expiresAt < new Date()))
      return res
        .status(404)
        .json({ valid: false, message: "Offer is invalid or expired" });
    res.json({
      valid: true,
      offer: {
        code: offer.code,
        title: offer.title,
        discountPercent: offer.discountPercent,
      },
    });
  }),
);

app.post(
  "/api/bookings",
  asyncRoute(async (req, res) => {
    const {
      movieId,
      movieTitle,
      showDate = new Date().toISOString().slice(0, 10),
      showtime,
      seats,
      guestEmail,
      guestName,
      guestPhone,
      cinema = "PCA CineMAX",
      screen = "Screen 01",
      paymentMethod = "card",
      offerCode,
    } = req.body;
    if (
      !movieId ||
      !movieTitle ||
      !showtime ||
      !Array.isArray(seats) ||
      !seats.length
    )
      return res.status(400).json({
        message: "Movie, showtime, and at least one seat are required",
      });
    const normalized = [...new Set(seats.map((s) => String(s).toUpperCase()))];
    if (normalized.length !== seats.length)
      return res
        .status(400)
        .json({ message: "Duplicate seats are not allowed" });
    const query = {
      movieId,
      showDate,
      showtime,
      screen,
      status: "confirmed",
      seats: { $in: normalized },
    };
    if (databaseReady && (await Booking.exists(query)))
      return res.status(409).json({
        message: "One or more seats were just booked. Please choose again.",
      });
    const seatPrice = 1800,
      subtotal = seatPrice * normalized.length;
    let discount = 0;
    if (databaseReady && offerCode) {
      const offer = await Offer.findOne({
        code: String(offerCode).toUpperCase(),
        active: true,
      });
      if (offer && (!offer.expiresAt || offer.expiresAt > new Date()))
        discount = Math.round((subtotal * offer.discountPercent) / 100);
    }
    const payload = {
      reference: `PCA-${crypto.randomBytes(4).toString("hex").toUpperCase()}`,
      user: req.user?._id || null,
      guestEmail,
      guestName,
      guestPhone,
      movieId,
      movieTitle,
      showDate,
      showtime,
      cinema,
      screen,
      paymentMethod,
      seats: normalized,
      subtotal,
      discount,
      total: subtotal - discount,
      offerCode: offerCode?.toUpperCase(),
      status: "confirmed",
    };
    const booking = databaseReady
      ? await Booking.create(payload)
      : { _id: payload.reference, ...payload, createdAt: new Date() };
    if (!databaseReady) memoryBookings.push(booking);
    if (databaseReady)
      await Payment.create({
        reference: `PAY-${crypto.randomBytes(4).toString("hex").toUpperCase()}`,
        bookingReference: payload.reference,
        amount: payload.total,
        method: req.body.paymentMethod || "online",
        status: "successful",
      });
    res.status(201).json(booking);
  }),
);
app.get(
  "/api/bookings",
  requireAuth,
  asyncRoute(async (req, res) => {
    const filter = req.user.role === "admin" ? {} : { user: req.user._id };
    res.json(await Booking.find(filter).sort({ createdAt: -1 }).lean());
  }),
);
app.get(
  "/api/bookings/:reference",
  asyncRoute(async (req, res) => {
    const booking = databaseReady
      ? await Booking.findOne({ reference: req.params.reference }).lean()
      : memoryBookings.find((b) => b.reference === req.params.reference);
    return booking
      ? res.json(booking)
      : res.status(404).json({ message: "Booking not found" });
  }),
);
app.patch(
  "/api/bookings/:reference/cancel",
  requireAuth,
  asyncRoute(async (req, res) => {
    const filter = {
      reference: req.params.reference,
      ...(req.user.role === "admin" ? {} : { user: req.user._id }),
    };
    const booking = await Booking.findOneAndUpdate(
      filter,
      { status: "cancelled" },
      { new: true },
    );
    return booking
      ? res.json(booking)
      : res.status(404).json({ message: "Booking not found" });
  }),
);

const audit = async (req, action, resource, details = "") =>
  Audit.create({ user: req.user._id, action, resource, details, ip: req.ip });
app.get(
  "/api/admin/dashboard",
  requireAdmin,
  asyncRoute(async (req, res) => {
    const today = new Date().toISOString().slice(0, 10),
      monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const [
      totalMovies,
      todayShows,
      totalBookings,
      revenueRows,
      recent,
      popular,
      customers,
      payments,
    ] = await Promise.all([
      Movie.countDocuments({ active: { $ne: false } }),
      Showtime.countDocuments({ date: today, status: "scheduled" }),
      Booking.countDocuments(),
      Booking.aggregate([
        { $match: { status: "confirmed", createdAt: { $gte: monthStart } } },
        { $group: { _id: null, total: { $sum: "$total" } } },
      ]),
      Booking.find().sort({ createdAt: -1 }).limit(6).lean(),
      Booking.aggregate([
        { $match: { status: "confirmed" } },
        {
          $group: {
            _id: "$movieTitle",
            bookings: { $sum: 1 },
            seats: { $sum: { $size: "$seats" } },
          },
        },
        { $sort: { seats: -1 } },
        { $limit: 5 },
      ]),
      User.countDocuments({ role: "customer" }),
      Payment.countDocuments(),
    ]);
    const sales = await Booking.aggregate([
      {
        $match: {
          status: "confirmed",
          createdAt: { $gte: new Date(Date.now() - 6 * 86400000) },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          revenue: { $sum: "$total" },
          tickets: { $sum: { $size: "$seats" } },
        },
      },
      { $sort: { _id: 1 } },
    ]);
    const bookedSeats = await Booking.aggregate([
      { $match: { status: "confirmed", showDate: today } },
      { $group: { _id: null, count: { $sum: { $size: "$seats" } } } },
    ]);
    const capacity = Math.max(todayShows * 40, 40),
      occupied = bookedSeats[0]?.count || 0;
    res.json({
      totalMovies,
      todayShows,
      totalBookings,
      todayRevenue: revenueRows[0]?.total || 0,
      customers,
      payments,
      seats: {
        available: Math.max(capacity - occupied, 0),
        occupied,
        occupancy: Math.round((occupied / capacity) * 100),
      },
      recent,
      popular,
      sales,
    });
  }),
);
app.get(
  "/api/admin/showtimes",
  requireAdmin,
  asyncRoute(async (req, res) =>
    res.json(await Showtime.find().sort({ date: -1, time: 1 }).lean()),
  ),
);
app.post(
  "/api/admin/showtimes",
  requireAdmin,
  asyncRoute(async (req, res) => {
    const overlap = await Showtime.exists({
      date: req.body.date,
      time: req.body.time,
      screen: req.body.screen,
      status: "scheduled",
    });
    if (overlap)
      return res
        .status(409)
        .json({ message: "This screen already has a screening at that time" });
    const item = await Showtime.create(req.body);
    await audit(req, "CREATE", "showtime", item._id.toString());
    res.status(201).json(item);
  }),
);
app.post(
  "/api/admin/showtimes/bulk",
  requireAdmin,
  asyncRoute(async (req, res) => {
    const times = [...new Set((req.body.times || []).map(String))].filter(
      (time) => /^([01]\d|2[0-3]):[0-5]\d$/.test(time),
    );
    const repeatDays = Math.min(
      Math.max(Number(req.body.repeatDays) || 1, 1),
      31,
    );
    if (
      !req.body.movieId ||
      !req.body.date ||
      !req.body.screen ||
      !times.length
    )
      return res.status(400).json({
        message: "Movie, date, screen and at least one valid time are required",
      });
    const entries = [];
    for (let day = 0; day < repeatDays; day += 1) {
      const date = new Date(`${req.body.date}T00:00:00`);
      date.setDate(date.getDate() + day);
      for (const time of times)
        entries.push({
          movieId: req.body.movieId,
          movieTitle: req.body.movieTitle,
          date: date.toISOString().slice(0, 10),
          time,
          screen: req.body.screen,
          format: req.body.format,
          language: req.body.language,
          price: req.body.price,
          status: "scheduled",
        });
    }
    const conflicts = await Showtime.find({
      status: "scheduled",
      $or: entries.map(({ date, time, screen }) => ({ date, time, screen })),
    })
      .select("date time screen movieTitle -_id")
      .lean();
    if (conflicts.length)
      return res.status(409).json({
        message: `Cannot create schedule: ${conflicts[0].screen} already has ${conflicts[0].movieTitle || "a movie"} at ${conflicts[0].time} on ${conflicts[0].date}`,
        conflicts,
      });
    const created = await Showtime.insertMany(entries);
    await audit(
      req,
      "BULK_CREATE",
      "showtime",
      created.map((item) => item._id).join(","),
    );
    res.status(201).json({
      message: `${created.length} showtimes created`,
      count: created.length,
      showtimes: created,
    });
  }),
);
app.delete(
  "/api/admin/showtimes/bulk/permanent",
  requireAdmin,
  asyncRoute(async (req, res) => {
    const ids = [...new Set((req.body.ids || []).map(String))];
    if (!ids.length)
      return res.status(400).json({ message: "Select at least one showtime" });
    if (ids.some((id) => !mongoose.isValidObjectId(id)))
      return res.status(400).json({ message: "Invalid showtime selection" });
    const result = await Showtime.deleteMany({ _id: { $in: ids } });
    await audit(req, "BULK_DELETE", "showtime", ids.join(","));
    res.json({
      message: `${result.deletedCount} showtime${result.deletedCount === 1 ? "" : "s"} deleted`,
      deletedCount: result.deletedCount,
    });
  }),
);
app.patch(
  "/api/admin/showtimes/:id",
  requireAdmin,
  asyncRoute(async (req, res) => {
    const item = await Showtime.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    await audit(req, "UPDATE", "showtime", req.params.id);
    res.json(item);
  }),
);
app.delete(
  "/api/admin/showtimes/:id",
  requireAdmin,
  asyncRoute(async (req, res) => {
    await Showtime.findByIdAndUpdate(req.params.id, { status: "cancelled" });
    await audit(req, "CANCEL", "showtime", req.params.id);
    res.json({ message: "Showtime cancelled" });
  }),
);
app.delete(
  "/api/admin/showtimes/:id/permanent",
  requireAdmin,
  asyncRoute(async (req, res) => {
    const item = await Showtime.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ message: "Showtime not found" });
    await audit(req, "DELETE", "showtime", req.params.id);
    res.json({ message: "Showtime deleted" });
  }),
);
app.get(
  "/api/admin/screens",
  requireAdmin,
  asyncRoute(async (req, res) => res.json(await Screen.find().lean())),
);
app.post(
  "/api/admin/screens",
  requireAdmin,
  asyncRoute(async (req, res) => {
    const item = await Screen.create(req.body);
    await audit(req, "CREATE", "screen", item.name);
    res.status(201).json(item);
  }),
);
app.patch(
  "/api/admin/screens/:id",
  requireAdmin,
  asyncRoute(async (req, res) =>
    res.json(
      await Screen.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true,
      }),
    ),
  ),
);
app.delete(
  "/api/admin/screens/:id",
  requireAdmin,
  asyncRoute(async (req, res) => {
    const item = await Screen.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ message: "Screen not found" });
    await Showtime.deleteMany({ screen: item.name });
    await audit(req, "DELETE", "screen", item.name);
    res.json({ message: "Screen deleted" });
  }),
);
app.get(
  "/api/admin/customers",
  requireAdmin,
  asyncRoute(async (req, res) =>
    res.json(
      await User.aggregate([
        { $match: { role: "customer" } },
        {
          $lookup: {
            from: "bookings",
            localField: "_id",
            foreignField: "user",
            as: "bookings",
          },
        },
        {
          $project: {
            name: 1,
            email: 1,
            createdAt: 1,
            role: 1,
            bookingCount: { $size: "$bookings" },
            spent: { $sum: "$bookings.total" },
            loyaltyPoints: 1,
            blocked: 1,
          },
        },
        { $sort: { spent: -1 } },
      ]),
    ),
  ),
);
app.patch(
  "/api/admin/customers/:id",
  requireAdmin,
  asyncRoute(async (req, res) =>
    res.json(
      await User.findByIdAndUpdate(
        req.params.id,
        { $set: req.body },
        { new: true },
      ).select("-passwordHash"),
    ),
  ),
);
app.delete(
  "/api/admin/customers/:id",
  requireAdmin,
  asyncRoute(async (req, res) => {
    const item = await User.findOneAndDelete({
      _id: req.params.id,
      role: "customer",
    });
    if (!item) return res.status(404).json({ message: "Customer not found" });
    await audit(req, "DELETE", "customer", item.email);
    res.json({ message: "Customer deleted" });
  }),
);
app.get(
  "/api/admin/payments",
  requireAdmin,
  asyncRoute(async (req, res) =>
    res.json(await Payment.find().sort({ createdAt: -1 }).lean()),
  ),
);
app.patch(
  "/api/admin/payments/:id",
  requireAdmin,
  asyncRoute(async (req, res) => {
    const allowed = {};
    for (const key of ["method", "status", "amount"])
      if (key in req.body) allowed[key] = req.body[key];
    const payment = await Payment.findByIdAndUpdate(req.params.id, allowed, {
      new: true,
      runValidators: true,
    });
    if (!payment) return res.status(404).json({ message: "Payment not found" });
    await audit(req, "UPDATE", "payment", payment.reference);
    res.json(payment);
  }),
);
app.post(
  "/api/admin/payments/:id/refund",
  requireAdmin,
  asyncRoute(async (req, res) => {
    const payment = await Payment.findById(req.params.id);
    if (!payment) return res.status(404).json({ message: "Payment not found" });
    const amount = Math.min(
      Number(req.body.amount) || payment.amount,
      payment.amount,
    );
    payment.refundedAmount = amount;
    payment.status =
      amount === payment.amount ? "refunded" : "partially-refunded";
    await payment.save();
    await audit(req, "REFUND", "payment", `${payment.reference}: ${amount}`);
    res.json(payment);
  }),
);
app.delete(
  "/api/admin/payments/:id",
  requireAdmin,
  asyncRoute(async (req, res) => {
    const item = await Payment.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ message: "Payment not found" });
    await audit(req, "DELETE", "payment", item.reference);
    res.json({ message: "Payment deleted" });
  }),
);
app.get(
  "/api/admin/staff",
  requireAdmin,
  asyncRoute(async (req, res) =>
    res.json(
      await User.find({ role: { $in: ["admin", "manager", "cashier"] } })
        .select("-passwordHash")
        .lean(),
    ),
  ),
);
app.get(
  "/api/admin/audit",
  requireAdmin,
  asyncRoute(async (req, res) =>
    res.json(
      await Audit.find()
        .populate("user", "name email")
        .sort({ createdAt: -1 })
        .limit(100)
        .lean(),
    ),
  ),
);
app.get(
  "/api/admin/content",
  requireAdmin,
  asyncRoute(async (req, res) =>
    res.json(await Content.find().sort({ createdAt: -1 }).lean()),
  ),
);
app.post(
  "/api/admin/content",
  requireAdmin,
  asyncRoute(async (req, res) => {
    const item = await Content.findOneAndUpdate(
      { key: req.body.key },
      req.body,
      { new: true, upsert: true, runValidators: true },
    );
    await audit(req, "UPSERT", "content", item.key);
    res.json(item);
  }),
);
app.delete(
  "/api/admin/content/:id",
  requireAdmin,
  asyncRoute(async (req, res) => {
    await Content.findByIdAndDelete(req.params.id);
    await audit(req, "DELETE", "content", req.params.id);
    res.json({ message: "Content removed" });
  }),
);
app.post(
  "/api/admin/offers",
  requireAdmin,
  asyncRoute(async (req, res) => {
    const item = await Offer.create({
      ...req.body,
      code: String(req.body.code || "").toUpperCase(),
    });
    await audit(req, "CREATE", "offer", item.code);
    res.status(201).json(item);
  }),
);
app.patch(
  "/api/admin/offers/:id",
  requireAdmin,
  asyncRoute(async (req, res) => {
    const item = await Offer.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    await audit(req, "UPDATE", "offer", item?.code || req.params.id);
    res.json(item);
  }),
);
app.delete(
  "/api/admin/offers/:id",
  requireAdmin,
  asyncRoute(async (req, res) => {
    const item = await Offer.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ message: "Offer not found" });
    await audit(req, "DELETE", "offer", item.code);
    res.json({ message: "Offer deleted" });
  }),
);
app.post(
  "/api/admin/staff",
  requireAdmin,
  asyncRoute(async (req, res) => {
    const { name, email, password, role } = req.body;
    if (!name || !validEmail(email) || !password || password.length < 6)
      return res.status(400).json({
        message: "Name, email and a 6+ character password are required",
      });
    const item = await User.create({
      name,
      email,
      passwordHash: await bcrypt.hash(password, 12),
      role: role || "cashier",
    });
    await audit(req, "CREATE", "staff", item.email);
    res.status(201).json(cleanUser(item));
  }),
);
app.patch(
  "/api/admin/staff/:id",
  requireAdmin,
  asyncRoute(async (req, res) => {
    const allowed = {};
    for (const key of ["name", "role", "blocked"])
      if (key in req.body) allowed[key] = req.body[key];
    const item = await User.findByIdAndUpdate(req.params.id, allowed, {
      new: true,
      runValidators: true,
    }).select("-passwordHash");
    await audit(req, "UPDATE", "staff", item?.email || req.params.id);
    res.json(item);
  }),
);
app.delete(
  "/api/admin/staff/:id",
  requireAdmin,
  asyncRoute(async (req, res) => {
    if (String(req.user._id) === req.params.id)
      return res
        .status(400)
        .json({ message: "You cannot delete your own active account" });
    const item = await User.findOneAndDelete({
      _id: req.params.id,
      role: { $in: ["admin", "manager", "cashier"] },
    });
    if (!item)
      return res.status(404).json({ message: "Staff account not found" });
    await audit(req, "DELETE", "staff", item.email);
    res.json({ message: "Staff account deleted" });
  }),
);
app.patch(
  "/api/admin/bookings/:reference",
  requireAdmin,
  asyncRoute(async (req, res) => {
    const allowed = {};
    for (const key of ["seats", "status", "showDate", "showtime"])
      if (key in req.body) allowed[key] = req.body[key];
    if (allowed.seats) {
      const current = await Booking.findOne({
        reference: req.params.reference,
      });
      const clash = await Booking.exists({
        reference: { $ne: req.params.reference },
        movieId: current.movieId,
        showDate: allowed.showDate || current.showDate,
        showtime: allowed.showtime || current.showtime,
        status: "confirmed",
        seats: { $in: allowed.seats },
      });
      if (clash)
        return res
          .status(409)
          .json({ message: "One or more replacement seats are occupied" });
      allowed.subtotal = allowed.seats.length * 1800;
      allowed.total = allowed.subtotal - (current.discount || 0);
    }
    const item = await Booking.findOneAndUpdate(
      { reference: req.params.reference },
      allowed,
      { new: true, runValidators: true },
    );
    await audit(req, "UPDATE", "booking", req.params.reference);
    res.json(item);
  }),
);
app.delete(
  "/api/admin/bookings/:reference",
  requireAdmin,
  asyncRoute(async (req, res) => {
    const item = await Booking.findOneAndDelete({
      reference: req.params.reference,
    });
    if (!item) return res.status(404).json({ message: "Booking not found" });
    await Payment.deleteMany({ bookingReference: item.reference });
    await audit(req, "DELETE", "booking", item.reference);
    res.json({ message: "Booking and linked payment deleted" });
  }),
);
app.delete(
  "/api/admin/audit/:id",
  requireAdmin,
  asyncRoute(async (req, res) => {
    const item = await Audit.findByIdAndDelete(req.params.id);
    return item
      ? res.json({ message: "Audit record deleted" })
      : res.status(404).json({ message: "Audit record not found" });
  }),
);
app.get(
  "/api/admin/reports",
  requireAdmin,
  asyncRoute(async (req, res) => {
    const from = new Date(req.query.from || Date.now() - 30 * 86400000);
    const match = { createdAt: { $gte: from } };
    const [revenue, movies, hours, promotions, paymentStatuses, growth] =
      await Promise.all([
        Booking.aggregate([
          { $match: { ...match, status: "confirmed" } },
          {
            $group: {
              _id: {
                $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
              },
              revenue: { $sum: "$total" },
              tickets: { $sum: { $size: "$seats" } },
            },
          },
          { $sort: { _id: 1 } },
        ]),
        Booking.aggregate([
          { $match: { ...match, status: "confirmed" } },
          {
            $group: {
              _id: "$movieTitle",
              revenue: { $sum: "$total" },
              tickets: { $sum: { $size: "$seats" } },
            },
          },
          { $sort: { tickets: -1 } },
        ]),
        Booking.aggregate([
          { $match: match },
          { $group: { _id: { $hour: "$createdAt" }, bookings: { $sum: 1 } } },
          { $sort: { bookings: -1 } },
        ]),
        Booking.aggregate([
          { $match: { ...match, offerCode: { $ne: null } } },
          {
            $group: {
              _id: "$offerCode",
              uses: { $sum: 1 },
              discount: { $sum: "$discount" },
            },
          },
        ]),
        Payment.aggregate([
          { $match: match },
          {
            $group: {
              _id: "$status",
              amount: { $sum: "$amount" },
              count: { $sum: 1 },
            },
          },
        ]),
        User.aggregate([
          { $match: { role: "customer", createdAt: { $gte: from } } },
          {
            $group: {
              _id: {
                $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
              },
              customers: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
        ]),
      ]);
    res.json({ revenue, movies, hours, promotions, paymentStatuses, growth });
  }),
);
app.get(
  "/api/admin/export/bookings.csv",
  requireAdmin,
  asyncRoute(async (req, res) => {
    const rows = await Booking.find().sort({ createdAt: -1 }).lean();
    const escape = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const csv = [
      "Reference,Movie,Date,Time,Seats,Total,Status",
      ...rows.map((b) =>
        [
          b.reference,
          b.movieTitle,
          b.showDate,
          b.showtime,
          b.seats.join(" "),
          b.total,
          b.status,
        ]
          .map(escape)
          .join(","),
      ),
    ].join("\n");
    res.type("text/csv").attachment("pca-bookings.csv").send(csv);
  }),
);

const here = path.dirname(fileURLToPath(import.meta.url)),
  dist = path.resolve(here, "../../client/dist");
if (fs.existsSync(path.join(dist, "index.html"))) {
  app.use(express.static(dist));
  app.get("*", (req, res) =>
    req.path.startsWith("/api")
      ? res.status(404).json({ message: "API route not found" })
      : res.sendFile(path.join(dist, "index.html")),
  );
} else {
  app.get("/", (req, res) =>
    res.json({
      ok: true,
      service: "PCA API",
      database: databaseReady ? "mongodb" : "memory",
      databaseStatus,
      ...(databaseError ? { databaseError } : {}),
      health: "/api/health",
    }),
  );
  app.use("/api", (req, res) =>
    res.status(404).json({ message: "API route not found" }),
  );
}
app.use((err, req, res, next) => {
  console.error(err);
  if (err.code === 11000)
    return res.status(409).json({ message: "That record already exists" });
  if (err.name === "ValidationError")
    return res.status(400).json({ message: err.message });
  if (err instanceof SyntaxError && "body" in err)
    return res.status(400).json({ message: "Invalid JSON request" });
  res
    .status(err.status || 500)
    .json({ message: err.message || "Internal server error" });
});

const port = Number(process.env.PORT) || 5000;
const configuredMongoUris = [process.env.MONGODB_URI, process.env.MONGO_URL]
  .map((value) => String(value || "").trim().replace(/^['"]|['"]$/g, ""))
  .filter(Boolean);
const mongoUri =
  configuredMongoUris.find((value) => /^mongodb(?:\+srv)?:\/\//i.test(value)) ||
  (process.env.NODE_ENV === "production"
    ? ""
    : "mongodb://127.0.0.1:27017/PCA");
let reconnectTimer;
let connectingPromise = null;
let databaseError = "";
const safeDatabaseError = (error) => {
  const message = String(error?.message || "");
  const name = String(error?.name || "");
  if (/auth|authentication/i.test(message)) return "authentication-failed";
  if (/ENOTFOUND|getaddrinfo|querySrv/i.test(message)) return "dns-failed";
  if (
    /timed out|server selection|could not connect to any servers|ECONNREFUSED/i.test(
      message,
    ) ||
    name === "MongooseServerSelectionError"
  )
    return "unreachable";
  return error?.name || "connection-failed";
};
const connectDatabase = async () => {
  if (
    mongoose.connection.readyState === 1 ||
    mongoose.connection.readyState === 2
  )
    return;
  if (!mongoUri) {
    databaseReady = false;
    databaseStatus = configuredMongoUris.length
      ? "invalid-mongodb-connection-string"
      : "missing-MONGODB_URI-or-MONGO_URL";
    return;
  }
  if (!connectingPromise) {
    connectingPromise = mongoose
      .connect(mongoUri, { serverSelectionTimeoutMS: 8000 })
      .then(async () => {
        databaseReady = true;
        databaseStatus = "connected";
        clearTimeout(reconnectTimer);
        await seedDatabase();
        console.log("MongoDB connected: PCA");
      })
      .catch((error) => {
        databaseReady = false;
        databaseStatus = safeDatabaseError(error);
        const detail = error?.reason || error?.cause || error;
        databaseError = String(detail?.message || error?.message || "").replace(
          /\/\/[^:@\s]+@/,
          "//***:***@",
        );
        console.warn(
          `MongoDB unavailable (${databaseError}) — retrying in 5 seconds`,
        );
        reconnectTimer = setTimeout(connectDatabase, 5000);
      })
      .finally(() => {
        connectingPromise = null;
      });
  }
  return connectingPromise;
};
mongoose.connection.on("disconnected", () => {
  databaseReady = false;
  clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(connectDatabase, 5000);
});
connectDatabase();
const httpServer = app.listen(port, () =>
  console.log(`PCA API running on http://localhost:${port}`),
);
httpServer.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(
      `PCA API could not start because port ${port} is already used by another process. Stop the previous npm run dev instance and try again.`,
    );
    void mongoose.disconnect().finally(() => process.exit(1));
    return;
  }
  console.error("PCA API server error:", error);
  void mongoose.disconnect().finally(() => process.exit(1));
});
