import bcrypt from "bcryptjs";
import { Movie, Offer, User, Screen } from "./models.js";

export const seedMovies = [
  {
    id: "shadow-protocol",
    title: "Shadow Protocol",
    synopsis: "One city. One final transmission. Every secret leaves a shadow.",
    tag: "Premiere",
    genre: "Thriller",
    rating: "8.7",
    runtime: "2h 18m",
    certificate: "PG-13",
    color: "#b20710",
    times: ["12:00 PM", "03:30 PM", "06:45 PM", "09:30 PM"],
  },
  {
    id: "last-signal",
    title: "The Last Signal",
    tag: "Now showing",
    genre: "Sci-fi",
    rating: "8.2",
    runtime: "1h 56m",
    certificate: "PG-13",
    color: "#5b1719",
    times: ["10:15 AM", "01:20 PM", "04:45 PM", "08:10 PM"],
  },
  {
    id: "crimson-tide",
    title: "Crimson Tide",
    tag: "Now showing",
    genre: "Action",
    rating: "7.9",
    runtime: "2h 05m",
    certificate: "R",
    color: "#8d0b12",
    times: ["11:30 AM", "02:40 PM", "06:00 PM", "10:00 PM"],
  },
  {
    id: "silent-city",
    title: "Silent City",
    tag: "Advance booking",
    genre: "Mystery",
    rating: "8.4",
    runtime: "2h 11m",
    certificate: "PG",
    color: "#321114",
    times: ["01:00 PM", "04:10 PM", "07:20 PM", "10:30 PM"],
  },
];
const offers = [
  {
    code: "FIRST20",
    title: "20% OFF",
    description: "First booking with PCA",
    discountPercent: 20,
  },
  {
    code: "NIGHTOWL",
    title: "2 FOR 1",
    description: "Tuesday late shows",
    discountPercent: 50,
  },
  {
    code: "PCA15",
    title: "SAVE 15%",
    description: "Selected partner cards",
    discountPercent: 15,
  },
];
export async function seedDatabase() {
  // Movies are managed exclusively from the administrator portal.
  const userIndexes = await User.collection.indexes();
  if (userIndexes.some((index) => index.name === "appId_1"))
    await User.collection.dropIndex("appId_1");
  await Offer.bulkWrite(
    offers.map((offer) => ({
      updateOne: {
        filter: { code: offer.code },
        update: { $setOnInsert: offer },
        upsert: true,
      },
    })),
  );
  if (!(await Screen.countDocuments()))
    await Screen.insertMany([
      {
        name: "Screen 01",
        capacity: 120,
        regularSeats: 84,
        premiumSeats: 28,
        vipSeats: 8,
        wheelchairSeats: 4,
        blockedSeats: ["A3", "D4"],
      },
      {
        name: "Screen 02",
        capacity: 96,
        regularSeats: 68,
        premiumSeats: 22,
        vipSeats: 6,
        wheelchairSeats: 4,
        blockedSeats: ["B5"],
      },
      {
        name: "IMAX Hall",
        capacity: 148,
        regularSeats: 96,
        premiumSeats: 40,
        vipSeats: 12,
        wheelchairSeats: 4,
        blockedSeats: ["C2", "C7", "E6"],
      },
    ]);
  const email = (process.env.ADMIN_EMAIL || "admin@gmail.com").toLowerCase();
  const passwordHash = await bcrypt.hash(
    process.env.ADMIN_PASSWORD || "123456",
    12,
  );
  await User.findOneAndUpdate(
    { email },
    { $set: { name: "PCA Administrator", passwordHash, role: "admin" } },
    { upsert: true, new: true },
  );
}
