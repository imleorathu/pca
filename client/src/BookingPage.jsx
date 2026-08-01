import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  ChevronRight,
  Clock,
  CreditCard,
  Download,
  MapPin,
  ShieldCheck,
  Ticket,
  User,
  Users,
} from "lucide-react";
import "./booking.css";

const API = "/api",
  seatPrice = 1800;
const money = (n) => `LKR ${Number(n || 0).toLocaleString()}`;
const dates = Array.from({ length: 7 }, (_, i) => {
  const date = new Date();
  date.setDate(date.getDate() + i);
  return date;
});
const iso = (date) => date.toISOString().slice(0, 10);
const seatRows = [
  { row: "A", left: 10, right: 10 },
  ...["B", "C", "D", "E", "F", "G", "H"].map((row) => ({
    row,
    left: 11,
    right: 11,
  })),
  { row: "I", left: 5, right: 5, compact: true },
];

function Logo() {
  return (
    <div className="booking-logo">
      <img src="/assets/pca-cinemax-admin.png" alt="PCA CineMAX" />
    </div>
  );
}
function Stepper({ step }) {
  return (
    <div className="booking-steps">
      {["Show", "Seats", "Details", "Payment", "Ticket"].map((label, i) => (
        <div className={i + 1 <= step ? "active" : ""} key={label}>
          <span>{i + 1 < step ? <Check /> : i + 1}</span>
          <b>{label}</b>
          {i < 4 && <i />}
        </div>
      ))}
    </div>
  );
}
export default function BookingPage({ initialMovie, initialTime, onBack }) {
  const [movies, setMovies] = useState([]),
    [screens, setScreens] = useState([]),
    [movieId, setMovieId] = useState(initialMovie?.id || ""),
    [date, setDate] = useState(iso(new Date())),
    [time, setTime] = useState(initialTime || ""),
    [screen, setScreen] = useState("Screen 01"),
    [selected, setSelected] = useState([]),
    [occupied, setOccupied] = useState([]),
    [step, setStep] = useState(1),
    [customer, setCustomer] = useState({ name: "", email: "", phone: "" }),
    [offer, setOffer] = useState(null),
    [offerInput, setOfferInput] = useState(""),
    [payment, setPayment] = useState({
      method: "card",
      cardName: "",
      cardNumber: "",
      expiry: "",
      cvv: "",
    }),
    [error, setError] = useState(""),
    [ticket, setTicket] = useState(null),
    [qr, setQr] = useState(""),
    [loading, setLoading] = useState(false);
  useEffect(() => {
    fetch(`${API}/movies`)
      .then((r) => r.json())
      .then((data) => {
        setMovies(data);
        if (!movieId && data[0]) setMovieId(data[0].id);
      });
    fetch(`${API}/screens`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => data.length && setScreens(data))
      .catch(() => {});
  }, []);
  const movie = useMemo(
    () => movies.find((m) => m.id === movieId) || initialMovie,
    [movies, movieId, initialMovie],
  );
  useEffect(() => {
    if (movie && !time) setTime(movie.times?.[0] || "");
  }, [movie]);
  useEffect(() => {
    if (!movieId || !time) return;
    fetch(
      `${API}/showtimes/${movieId}/seats?date=${date}&time=${encodeURIComponent(time)}&screen=${encodeURIComponent(screen)}`,
    )
      .then((r) => r.json())
      .then((data) => setOccupied(data.occupied || []))
      .catch(() => setOccupied([]));
    setSelected([]);
  }, [movieId, date, time, screen]);
  const discount = offer
      ? Math.round(
          (selected.length * seatPrice * (offer.discountPercent || 0)) / 100,
        ) + (offer.fixedDiscount || 0)
      : 0,
    total = Math.max(selected.length * seatPrice - discount, 0);
  const next = () => {
    setError("");
    if (step === 1 && (!movie || !date || !time))
      return setError("Select a movie, date and showtime.");
    if (step === 2 && !selected.length)
      return setError("Select at least one seat.");
    if (
      step === 3 &&
      (!customer.name ||
        !/^\S+@\S+\.\S+$/.test(customer.email) ||
        customer.phone.length < 7)
    )
      return setError("Enter valid customer information.");
    setStep((s) => Math.min(s + 1, 5));
  };
  const applyOffer = async () => {
    setError("");
    try {
      const r = await fetch(`${API}/offers/validate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: offerInput }),
        }),
        data = await r.json();
      if (!r.ok) throw new Error(data.message);
      setOffer(data.offer);
    } catch (e) {
      setOffer(null);
      setError(e.message);
    }
  };
  const confirm = async () => {
    if (
      payment.method === "card" &&
      (!payment.cardName ||
        payment.cardNumber.replace(/\s/g, "").length < 12 ||
        !payment.expiry ||
        payment.cvv.length < 3)
    )
      return setError("Enter valid card information.");
    setLoading(true);
    setError("");
    try {
      const r = await fetch(`${API}/bookings`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            movieId: movie.id,
            movieTitle: movie.title,
            showDate: date,
            showtime: time,
            seats: selected,
            guestName: customer.name,
            guestEmail: customer.email,
            guestPhone: customer.phone,
            offerCode: offer?.code,
            paymentMethod: payment.method,
            cinema: "PCA CineMAX",
            screen,
          }),
        }),
        data = await r.json();
      if (!r.ok) throw new Error(data.message);
      const full = {
        ...data,
        customer,
        movieTitle: movie.title,
        screen,
        date,
        time,
      };
      setTicket(full);
      const { default: QRCode } = await import("qrcode");
      setQr(
        await QRCode.toDataURL(
          JSON.stringify({
            reference: data.reference,
            movie: movie.title,
            date,
            time,
            seats: selected,
          }),
        ),
      );
      setStep(5);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };
  const download = async () => {
    if (!ticket) return;
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF();
    doc.setFillColor(10, 10, 10);
    doc.rect(0, 0, 210, 297, "F");
    doc.setTextColor(237, 18, 27);
    doc.setFontSize(25);
    doc.text("PCA CineMAX", 20, 28);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.text("EXPERIENCE THE TRUE CINEMA", 20, 36);
    doc.setDrawColor(237, 18, 27);
    doc.line(20, 44, 190, 44);
    doc.setFontSize(24);
    doc.text(ticket.movieTitle, 20, 62);
    doc.setFontSize(11);
    doc.text(`Booking reference: ${ticket.reference}`, 20, 76);
    doc.text(`Customer: ${customer.name}`, 20, 86);
    doc.text(`Cinema: PCA CineMAX / ${screen}`, 20, 96);
    doc.text(`Date: ${date}     Showtime: ${time}`, 20, 106);
    doc.text(`Seats: ${selected.join(", ")}`, 20, 116);
    doc.text(`Payment: ${payment.method.toUpperCase()}`, 20, 126);
    doc.text(`Total: ${money(ticket.total)}`, 20, 136);
    if (qr) doc.addImage(qr, "PNG", 20, 152, 55, 55);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text("Present this QR code at the cinema entrance.", 20, 218);
    doc.save(`${ticket.reference}.pdf`);
  };
  return (
    <div className="booking-page">
      <header>
        <button onClick={onBack}>
          <ArrowLeft /> Back to movies
        </button>
        <Logo />
        <span>
          SECURE BOOKING <ShieldCheck />
        </span>
      </header>
      <Stepper step={step} />
      <main>
        {step === 1 && (
          <section>
            <Heading
              icon={CalendarDays}
              kicker="STEP 01"
              title="Choose your show"
            />
            <div className="booking-field">
              <label>Movie</label>
              <select
                value={movieId}
                onChange={(e) => {
                  setMovieId(e.target.value);
                  setTime("");
                }}
              >
                {movies.map((m) => (
                  <option value={m.id}>{m.title}</option>
                ))}
              </select>
            </div>
            <div className="date-picker">
              {dates.map((d) => (
                <button
                  className={date === iso(d) ? "active" : ""}
                  onClick={() => setDate(iso(d))}
                >
                  <small>
                    {d.toLocaleDateString("en", { month: "short" })}
                  </small>
                  <b>{d.getDate()}</b>
                  <span>
                    {d.toLocaleDateString("en", { weekday: "short" })}
                  </span>
                </button>
              ))}
            </div>
            <div className="booking-field">
              <label>Cinema</label>
              <button className="cinema-choice">
                <MapPin />
                <span>
                  <b>PCA CineMAX</b>
                  <small>Main cinema complex</small>
                </span>
                <Check />
              </button>
            </div>
            <div className="booking-field">
              <label>Screen</label>
              <select
                value={screen}
                onChange={(e) => setScreen(e.target.value)}
              >
                {(screens.length ? screens : [{ name: "Screen 01" }]).map(
                  (s) => (
                    <option>{s.name}</option>
                  ),
                )}
              </select>
            </div>
            <div className="showtime-choices">
              {(movie?.times || []).map((t) => (
                <button
                  className={time === t ? "active" : ""}
                  onClick={() => setTime(t)}
                >
                  <Clock />
                  {t}
                </button>
              ))}
            </div>
          </section>
        )}
        {step === 2 && (
          <section>
            <Heading icon={Users} kicker="STEP 02" title="Select your seats" />
            <div className="seat-map-shell">
              <div className="seat-category-title">
                PCA CINEMAX AUDITORIUM <span>{money(seatPrice)}</span>
              </div>
              <div className="booking-seats" aria-label="Cinema seat map">
                {seatRows.map(({ row, left, right, compact }) => {
                  const bank = (start, count) =>
                    Array.from({ length: count }, (_, index) => {
                      const number = start + index;
                      const seat = `${row}${number}`;
                      const isSelected = selected.includes(seat);
                      return (
                        <button
                          key={seat}
                          type="button"
                          aria-label={`Seat ${seat}${isSelected ? ", selected" : ""}`}
                          disabled={occupied.includes(seat)}
                          className={`${isSelected ? "selected" : ""} ${
                            isSelected && movie?.seatIcon
                              ? "selected-with-icon"
                              : ""
                          }`}
                          onClick={() =>
                            setSelected((value) =>
                              value.includes(seat)
                                ? value.filter((item) => item !== seat)
                                : [...value, seat],
                            )
                          }
                        >
                          {isSelected && movie?.seatIcon ? (
                            <img
                              src={movie.seatIcon}
                              alt={`${movie.title} selected-seat icon`}
                            />
                          ) : (
                            <span>{number}</span>
                          )}
                        </button>
                      );
                    });
                  return (
                    <div
                      className={`seat-row ${compact ? "compact" : ""}`}
                      key={row}
                    >
                      <b>{row}</b>
                      <div className="seat-bank left">{bank(1, left)}</div>
                      <div className="seat-bank right">
                        {bank(left + 1, right)}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="booking-screen">
                <i />
                <span>ALL EYES THIS WAY</span>
              </div>
            </div>
            <div className="booking-key">
              <span>
                <i />
                Available
              </span>
              <span>
                <i className="selected" />
                Selected
              </span>
              <span>
                <i className="occupied" />
                Occupied
              </span>
            </div>
          </section>
        )}
        {step === 3 && (
          <section>
            <Heading icon={User} kicker="STEP 03" title="Your details" />
            <div className="customer-form">
              <label>
                Full name
                <input
                  value={customer.name}
                  onChange={(e) =>
                    setCustomer({ ...customer, name: e.target.value })
                  }
                  placeholder="Enter customer name"
                />
              </label>
              <label>
                Email address
                <input
                  type="email"
                  value={customer.email}
                  onChange={(e) =>
                    setCustomer({ ...customer, email: e.target.value })
                  }
                  placeholder="name@example.com"
                />
              </label>
              <label>
                Phone number
                <input
                  value={customer.phone}
                  onChange={(e) =>
                    setCustomer({ ...customer, phone: e.target.value })
                  }
                  placeholder="+94 77 123 4567"
                />
              </label>
            </div>
            <div className="offer-box">
              <Ticket />
              <div>
                <b>Have an offer code?</b>
                <span>Apply it before payment</span>
              </div>
              <input
                value={offerInput}
                onChange={(e) => setOfferInput(e.target.value.toUpperCase())}
                placeholder="OFFER CODE"
              />
              <button onClick={applyOffer}>Apply</button>
            </div>
            {offer && (
              <div className="offer-success">
                <Check /> {offer.code} applied — {offer.discountPercent}%
                discount
              </div>
            )}
          </section>
        )}
        {step === 4 && (
          <section>
            <Heading icon={CreditCard} kicker="STEP 04" title="Payment" />
            <div className="payment-methods">
              {["card", "online", "cash"].map((method) => (
                <button
                  className={payment.method === method ? "active" : ""}
                  onClick={() => setPayment({ ...payment, method })}
                >
                  {method === "card"
                    ? "Credit / debit card"
                    : method === "online"
                      ? "Online payment"
                      : "Pay at counter"}
                </button>
              ))}
            </div>
            {payment.method === "card" && (
              <div className="customer-form payment-form">
                <label className="wide">
                  Name on card
                  <input
                    value={payment.cardName}
                    onChange={(e) =>
                      setPayment({ ...payment, cardName: e.target.value })
                    }
                  />
                </label>
                <label className="wide">
                  Card number
                  <input
                    maxLength="19"
                    value={payment.cardNumber}
                    onChange={(e) =>
                      setPayment({
                        ...payment,
                        cardNumber: e.target.value.replace(/[^\d ]/g, ""),
                      })
                    }
                    placeholder="0000 0000 0000 0000"
                  />
                </label>
                <label>
                  Expiry
                  <input
                    value={payment.expiry}
                    onChange={(e) =>
                      setPayment({ ...payment, expiry: e.target.value })
                    }
                    placeholder="MM/YY"
                  />
                </label>
                <label>
                  CVV
                  <input
                    type="password"
                    maxLength="4"
                    value={payment.cvv}
                    onChange={(e) =>
                      setPayment({
                        ...payment,
                        cvv: e.target.value.replace(/\D/g, ""),
                      })
                    }
                  />
                </label>
              </div>
            )}
            <div className="secure-note">
              <ShieldCheck />
              <span>
                <b>Secure checkout</b>Your payment information is encrypted and
                never stored by PCA.
              </span>
            </div>
          </section>
        )}
        {step === 5 && ticket && (
          <section className="ticket-success">
            <div className="success-check">
              <Check />
            </div>
            <span>BOOKING CONFIRMED</span>
            <h1>Enjoy the show.</h1>
            <div className="digital-ticket">
              <div>
                <small>BOOKING REFERENCE</small>
                <strong>{ticket.reference}</strong>
                <h2>{movie.title}</h2>
                <p>
                  <CalendarDays />
                  {date} <Clock />
                  {time}
                </p>
                <p>
                  <MapPin />
                  PCA CineMAX · {screen}
                </p>
                <div>
                  <span>
                    <small>SEATS</small>
                    <b>{selected.join(", ")}</b>
                  </span>
                  <span>
                    <small>TOTAL</small>
                    <b>{money(ticket.total)}</b>
                  </span>
                </div>
              </div>
              {qr && <img src={qr} alt="Booking QR code" />}
            </div>
            <button className="booking-primary" onClick={download}>
              <Download /> Download PDF ticket
            </button>
          </section>
        )}
        {error && <div className="booking-error">{error}</div>}
        {step < 5 && (
          <div className="booking-nav">
            {step > 1 ? (
              <button onClick={() => setStep((s) => s - 1)}>
                <ArrowLeft />
                Back
              </button>
            ) : (
              <span />
            )}
            <div>
              <small>
                {selected.length} SEAT{selected.length !== 1 ? "S" : ""}
              </small>
              <b>{money(total)}</b>
            </div>
            {step < 4 ? (
              <button className="booking-primary" onClick={next}>
                Continue
                <ArrowRight />
              </button>
            ) : (
              <button
                className="booking-primary"
                disabled={loading}
                onClick={confirm}
              >
                {loading ? "Processing..." : "Pay & confirm"}
                <ArrowRight />
              </button>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
function Heading({ icon: Icon, kicker, title }) {
  return (
    <div className="booking-heading">
      <Icon />
      <div>
        <span>{kicker}</span>
        <h1>{title}</h1>
      </div>
    </div>
  );
}
