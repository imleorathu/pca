import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Facebook,
  Film,
  Instagram,
  Menu,
  Play,
  Search,
  Star,
  Ticket,
  User,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { offers } from "./data";
import AdminPortal from "./AdminPortal";
import BookingPage from "./BookingPage";
import "./admin.css";
import { API, backendAsset } from "./api.js";

const money = (n) => `LKR ${n.toLocaleString()}`;
function Brand({ onNavigate }) {
  return (
    <a
      href="/"
      className="brand"
      aria-label="PCA CineMAX home"
      onClick={(event) => {
        event.preventDefault();
        onNavigate("/");
      }}
    >
      <img
        src="/assets/pca-cinemax-logo.png"
        alt="PCA CineMAX — Experience the true cinema"
      />
    </a>
  );
}
function Header({ onLogin, onNavigate, route = "/" }) {
  const [open, setOpen] = useState(false);
  return (
    <header>
      <Brand onNavigate={onNavigate} />
      <nav className={open ? "open" : ""}>
        <a
          href="/"
          className={route === "/" ? "active" : ""}
          onClick={(event) => {
            event.preventDefault();
            onNavigate("/");
            setOpen(false);
          }}
        >
          Home
        </a>
        <a
          href="/movies"
          className={route === "/movies" ? "active" : ""}
          onClick={(event) => {
            event.preventDefault();
            onNavigate("/movies");
            setOpen(false);
          }}
        >
          Movies
        </a>
        <a
          href="/experiences"
          className={route.startsWith("/experiences") ? "active" : ""}
          onClick={(event) => {
            event.preventDefault();
            onNavigate("/experiences");
            setOpen(false);
          }}
        >
          Experiences
        </a>
      </nav>
      <div className="head-actions">
        <button className="icon" aria-label="Search">
          <Search />
        </button>
        <button className="signin" onClick={onLogin}>
          <User /> Sign in
        </button>
        <button
          className="icon menu"
          onClick={() => setOpen(!open)}
          aria-label="Menu"
        >
          {open ? <X /> : <Menu />}
        </button>
      </div>
    </header>
  );
}
function Hero({ movie, onBook, onTrailer, index, total, onSelect, onHover }) {
  const words = movie.title.trim().split(/\s+/);
  const firstLine = words.shift();
  const secondLine = words.join(" ");
  const artwork =
    backendAsset(movie.hero || movie.poster) || "/assets/pca-noir-hero.png";
  return (
    <section
      className="hero"
      id="top"
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
    >
      <div
        className="hero-bg"
        style={{
          backgroundImage: `linear-gradient(90deg,#050505 0%,rgba(5,5,5,.32) 53%,rgba(5,5,5,.08)),url("${artwork}")`,
        }}
      />
      <div className="hero-copy">
        <div className="eyebrow">
          <span />{" "}
          {movie.featured
            ? "FEATURED PRESENTATION"
            : movie.state || "NOW SHOWING"}
        </div>
        <h1>
          {firstLine}
          {secondLine && (
            <>
              <br />
              <em>{secondLine}</em>
            </>
          )}
        </h1>
        <div className="meta">
          <span>
            <Star fill="currentColor" /> {movie.rating || "NEW"}
          </span>
          <i />
          <span>{movie.genre}</span>
          <i />
          <span>{movie.runtime}</span>
          <i />
          <span>{movie.certificate}</span>
        </div>
        <p>
          {movie.synopsis ||
            movie.description ||
            "Book your seats now at PCA CineMAX."}
        </p>
        <div className="hero-actions">
          <button className="primary" onClick={() => onBook(movie)}>
            Book tickets <ArrowRight />
          </button>
          {movie.trailer && (
            <button className="secondary" onClick={() => onTrailer(movie)}>
              <Play fill="currentColor" /> Watch trailer
            </button>
          )}
        </div>
      </div>
      <div className="scroll-cue">
        SCROLL TO EXPLORE <span />
      </div>
      {total > 1 && (
        <div className="hero-pagination" aria-label="Now showing movies">
          {Array.from({ length: total }, (_, i) => (
            <button
              key={i}
              className={i === index ? "active" : ""}
              onClick={() => onSelect(i)}
              aria-label={`Show movie ${i + 1}`}
            >
              <span />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
function ShowtimeBar({ movie, onBook }) {
  return (
    <section className="timebar" id="showtimes">
      <div className="time-title">
        <span>Next</span>
        <b>Showtimes</b>
        <ArrowRight />
      </div>
      {(movie.times || []).slice(0, 4).map((time, i) => (
        <button key={time} onClick={() => onBook(movie, time)}>
          <small>{i === 3 ? "TONIGHT" : "TODAY"}</small>
          <strong>{time.split(" ")[0]}</strong>
          <span>{time.split(" ")[1]}</span>
        </button>
      ))}
      <a href="#movies">
        All showtimes <ArrowRight />
      </a>
    </section>
  );
}
function MovieCard({ movie, index, onBook }) {
  const [liveRating, setLiveRating] = useState(null);
  useEffect(() => {
    let active = true;
    if (!movie.imdbId) return setLiveRating(null);
    fetch(`${API}/ratings/imdb/${movie.imdbId}`)
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data) => active && setLiveRating(data.rating))
      .catch(() => active && setLiveRating(null));
    return () => {
      active = false;
    };
  }, [movie.imdbId]);
  const displayedRating = liveRating ?? movie.rating;
  return (
    <article className={`movie-card poster-${index}`}>
      <div
        className="poster-art"
        style={
          movie.poster
            ? {
                backgroundImage: `linear-gradient(0deg,#070707ed,#07070711 65%),url("${backendAsset(movie.poster)}")`,
              }
            : undefined
        }
      >
        <span className="poster-no">0{index + 1}</span>
        <div className="poster-mark">
          PCA
          <br />
          PICTURES
        </div>
        <h3>{movie.title}</h3>
      </div>
      <div className="card-info">
        <small>
          {movie.featured
            ? "Featured"
            : movie.state || movie.tag || "Now Showing"}
        </small>
        <h3>{movie.title}</h3>
        <div>
          <span>
            <Star fill="currentColor" /> IMDb {displayedRating || "N/A"}
          </span>
          <span>{movie.genre}</span>
          <span>{movie.runtime}</span>
        </div>
        <button onClick={() => onBook(movie)}>
          Get tickets <ArrowRight />
        </button>
      </div>
    </article>
  );
}
function Movies({ movies, onBook }) {
  const [start, setStart] = useState(0);
  useEffect(() => setStart(0), [movies.length]);
  const shown =
    movies.length > 4 ? [...movies, ...movies].slice(start, start + 4) : movies;
  return (
    <section className="section movies" id="movies">
      <div className="section-head">
        <div>
          <span>CURATED FOR YOU</span>
          <h2>Now showing</h2>
        </div>
        <div>
          <button
            className="round"
            disabled={movies.length < 5}
            onClick={() =>
              setStart((start - 1 + movies.length) % movies.length)
            }
          >
            <ChevronLeft />
          </button>
          <button
            className="round"
            disabled={movies.length < 5}
            onClick={() => setStart((start + 1) % movies.length)}
          >
            <ChevronRight />
          </button>
        </div>
      </div>
      <div className="movie-grid">
        {shown.map((m, i) => (
          <MovieCard
            key={`${m.id}-${i}`}
            movie={m}
            index={(start + i) % 4}
            onBook={onBook}
          />
        ))}
        {!movies.length && (
          <div className="catalogue-empty">
            <Film />
            <h3>No movies published yet</h3>
            <p>
              Published movies from the PCA admin portal will appear here
              automatically.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
function MoviesPage({ movies, loaded, onBook }) {
  const nowPlaying = movies.filter((movie) =>
    String(movie.state || movie.tag || "")
      .toLowerCase()
      .replaceAll(" ", "")
      .includes("nowshowing"),
  );
  const comingSoon = movies.filter((movie) =>
    String(movie.state || movie.tag || "")
      .toLowerCase()
      .replaceAll(" ", "")
      .includes("comingsoon"),
  );
  const category = (title, kicker, items) => (
    <section className="movie-library-section">
      <div className="section-head">
        <div>
          <span>{kicker}</span>
          <h2>{title}</h2>
        </div>
        <b>{String(items.length).padStart(2, "0")} TITLES</b>
      </div>
      <div className="movie-grid movie-library-grid">
        {items.map((movie, index) => (
          <MovieCard
            key={movie.id}
            movie={movie}
            index={index % 4}
            onBook={onBook}
          />
        ))}
        {!items.length && (
          <div className="catalogue-empty">
            <Film />
            <h3>{loaded ? `No ${title} movies` : "Loading movies"}</h3>
            <p>Movies published from the admin portal will appear here.</p>
          </div>
        )}
      </div>
    </section>
  );
  return (
    <main className="movies-page">
      <section className="movies-page-hero">
        <span>PCA CINEMAX COLLECTION</span>
        <h1>Movies</h1>
        <p>Discover what is playing now and what is arriving next.</p>
      </section>
      {category("Now Playing", "BOOK YOUR EXPERIENCE", nowPlaying)}
      {category("Coming Soon", "NEXT AT PCA CINEMAX", comingSoon)}
    </main>
  );
}
const cinemaExperiences = [
  {
    slug: "imax-with-laser",
    title: "IMAX with Laser",
    image: "/assets/experience-imax.jpg",
    video: "/assets/imax-experience-hero.mp4?v=20260801",
    label: "Ultimate scale",
    copy: "Crystal-clear laser projection, exceptional contrast and a screen built to make every frame feel monumental.",
    description:
      "IMAX with Laser combines precision 4K laser projection with a huge auditorium screen and carefully tuned sound. Images remain bright, detailed and rich in contrast from the opening frame to the final credits.",
    features: [
      "4K laser projection",
      "Expanded screen presentation",
      "High dynamic contrast",
      "Immersive precision audio",
    ],
  },
  {
    slug: "dolby-atmos",
    title: "Dolby Atmos",
    image: "/assets/experience-dolby-atmos.jpg",
    video: "/assets/dolby-atmos-experience-hero.mp4?v=20260801",
    label: "Sound without limits",
    copy: "Precision surround sound moves above and around you, placing every whisper, score and impact inside the auditorium.",
    description:
      "Dolby Atmos treats sound as objects that can move freely through the auditorium. Overhead and surround speakers produce a detailed sound field that makes dialogue clearer, music wider and action more powerful.",
    features: [
      "Overhead audio channels",
      "Three-dimensional sound",
      "Clear dialogue reproduction",
      "Auditorium-specific tuning",
    ],
  },
  {
    slug: "vip-lounge",
    title: "VIP Lounge",
    image: "/assets/experience-vip-lounge.jpg",
    heroImage: "/assets/vip-lounge-detail-hero.png",
    label: "Private comfort",
    copy: "Generous reclining seats, extra personal space and premium service create a refined cinema experience.",
    description:
      "The PCA VIP Lounge is designed for guests who want privacy, space and comfort. Settle into a generously proportioned recliner and enjoy attentive service in an intimate premium auditorium.",
    features: [
      "Fully reclining seats",
      "Extra personal space",
      "Premium guest service",
      "Intimate auditorium setting",
    ],
  },
  {
    slug: "largest-screen",
    title: "Sri Lanka's Largest Screen",
    image: "/assets/experience-largest-screen.jpg",
    heroImage: "/assets/largest-screen-detail-hero.png",
    label: "Made for spectacle",
    copy: "An enormous wall-to-wall presentation designed for blockbusters, breathtaking landscapes and unforgettable scale.",
    description:
      "PCA's largest screen is built for films that demand scale. Its wall-filling picture, carefully aligned projection and powerful sound system make blockbuster moments feel truly larger than life.",
    features: [
      "Wall-to-wall cinema screen",
      "High-output projection",
      "62' X 33.5' [1:1.85 RATIO]",
      "Powerful theatre sound",
    ],
  },
  {
    slug: "digital-3d",
    title: "Digital 3D",
    image: "/assets/experience-digital-3d.jpg",
    video: "/assets/digital-3d-experience-hero.mp4?v=20260801",
    label: "Step inside the story",
    copy: "Bright digital projection and immersive depth bring action, animation and adventure closer than ever.",
    description:
      "Digital 3D adds convincing depth while retaining a bright, stable image. PCA's calibrated projection helps reduce distraction so audiences can comfortably experience worlds extending beyond the screen.",
    features: [
      "Bright digital 3D image",
      "Calibrated depth presentation",
      "Lightweight 3D glasses",
      "Ideal for action and animation",
    ],
  },
];
function ExperiencesPage({ onNavigate }) {
  return (
    <main className="experiences-page">
      <section className="experiences-page-hero">
        <div>
          <span>PCA CINEMAX EXPERIENCES</span>
          <h1>
            More than
            <br />a movie.
          </h1>
          <p>
            Discover presentation, sound and comfort engineered to transform
            every visit.
          </p>
        </div>
      </section>
      <section className="experience-library">
        <div className="experience-library-head">
          <span>CHOOSE YOUR EXPERIENCE</span>
          <h2>Every story deserves the right stage.</h2>
        </div>
        <div className="experience-card-grid">
          {cinemaExperiences.map((experience, index) => (
            <article className="experience-card" key={experience.title}>
              <img src={experience.image} alt={experience.title} />
              <div className="experience-card-shade" />
              <span>
                0{index + 1} / {experience.label}
              </span>
              <div>
                <h3>{experience.title}</h3>
                <p>{experience.copy}</p>
                <button
                  onClick={() => onNavigate(`/experiences/${experience.slug}`)}
                >
                  Explore more <ArrowRight />
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
function ExperienceDetailPage({ experience, onNavigate }) {
  const [muted, setMuted] = useState(true);
  const [videoFailed, setVideoFailed] = useState(false);
  const hasVideo = Boolean(experience.video) && !videoFailed;
  const heroImage = experience.heroImage || experience.image;
  return (
    <main className="experience-detail-page">
      <section
        className={`experience-detail-hero ${hasVideo ? "has-video" : ""}`}
        style={
          hasVideo ? undefined : { "--experience-image": `url("${heroImage}")` }
        }
      >
        {hasVideo && (
          <>
            <video
              className="experience-detail-video"
              src={experience.video}
              poster={heroImage}
              autoPlay
              muted={muted}
              loop
              playsInline
              preload="metadata"
              onError={() => setVideoFailed(true)}
              aria-label={`${experience.title} experience video`}
            />
            <div className="experience-detail-video-shade" />
            <button
              className="experience-sound-toggle"
              type="button"
              onClick={() => setMuted((current) => !current)}
              aria-label={
                muted
                  ? `Unmute ${experience.title} video`
                  : `Mute ${experience.title} video`
              }
            >
              {muted ? <VolumeX /> : <Volume2 />}
              {muted ? "Unmute" : "Mute"}
            </button>
          </>
        )}
        <button onClick={() => onNavigate("/experiences")}>
          <ArrowLeft /> All experiences
        </button>
        <div>
          <span>{experience.label}</span>
          <h1>{experience.title}</h1>
          <p>{experience.copy}</p>
        </div>
      </section>
      <section className="experience-detail-content">
        <div>
          <span>THE PCA EXPERIENCE</span>
          <h2>Designed to pull you into every frame.</h2>
        </div>
        <div className="experience-detail-copy">
          <p>{experience.description}</p>
          <div className="experience-feature-list">
            {experience.features.map((feature, index) => (
              <article key={feature}>
                <b>0{index + 1}</b>
                <span>{feature}</span>
              </article>
            ))}
          </div>
          <button className="primary" onClick={() => onNavigate("/movies")}>
            Find a movie <ArrowRight />
          </button>
        </div>
      </section>
    </main>
  );
}
function Experiences() {
  return (
    <section className="experience section" id="experiences">
      <div className="experience-copy">
        <span>BEYOND THE SCREEN</span>
        <h2>
          Cinema,
          <br />
          <em>reimagined.</em>
        </h2>
        <p>
          Precision projection. Room-shaking audio. Seats designed around you.
          PCA turns every frame into an experience you can feel.
        </p>
        <button className="secondary">
          Discover experiences <ArrowRight />
        </button>
      </div>
      <div className="experience-grid">
        <article className="exp-main">
          <span>01</span>
          <div className="screen">
            PCA <b>ULTRA</b>
          </div>
          <h3>4K laser projection</h3>
          <p>Deeper blacks. Brighter worlds.</p>
        </article>
        <article>
          <Volume2 />
          <h3>Dolby Atmos</h3>
          <p>Sound from every direction.</p>
        </article>
        <article>
          <Ticket />
          <h3>Signature seats</h3>
          <p>Recline into every story.</p>
        </article>
      </div>
    </section>
  );
}
function Offers() {
  const [copied, setCopied] = useState("");
  return (
    <section className="section offers" id="offers">
      <div className="section-head">
        <div>
          <span>MORE CINEMA, LESS SPEND</span>
          <h2>Offers & rewards</h2>
        </div>
      </div>
      <div className="offer-grid">
        {offers.map((o, i) => (
          <article key={o.code}>
            <small>
              0{i + 1} / {o.kicker}
            </small>
            <h3>{o.title}</h3>
            <p>{o.copy}</p>
            <button
              onClick={() => {
                navigator.clipboard?.writeText(o.code);
                setCopied(o.code);
              }}
            >
              {copied === o.code ? "Code copied!" : `Use ${o.code}`}{" "}
              <ArrowRight />
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
function Booking({ movie, initialTime, onClose }) {
  const [time, setTime] = useState(initialTime || movie.times[0]);
  const [selected, setSelected] = useState([]);
  const [done, setDone] = useState(false);
  const seats = Array.from(
    { length: 40 },
    (_, i) => `${String.fromCharCode(65 + Math.floor(i / 8))}${(i % 8) + 1}`,
  );
  const occupied = ["A3", "B5", "C2", "C7", "D4", "E6"];
  const toggle = (s) =>
    setSelected((v) => (v.includes(s) ? v.filter((x) => x !== s) : [...v, s]));
  const confirm = async () => {
    if (!selected.length) return;
    try {
      await fetch(`${API}/bookings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          movieId: movie.id,
          movieTitle: movie.title,
          showtime: time,
          seats: selected,
          total: selected.length * 1800,
        }),
      });
    } catch {}
    setDone(true);
  };
  return (
    <div className="modal-wrap" role="dialog" aria-modal="true">
      <div className="booking modal">
        <button className="close" onClick={onClose}>
          <X />
        </button>
        {done ? (
          <div className="success">
            <div>✓</div>
            <span>BOOKING CONFIRMED</span>
            <h2>See you at PCA.</h2>
            <p>
              {movie.title} · {time}
              <br />
              {selected.join(", ")} · {money(selected.length * 1800)}
            </p>
            <button className="primary" onClick={onClose}>
              Done
            </button>
          </div>
        ) : (
          <>
            <div className="modal-head">
              <span>RESERVE YOUR SEATS</span>
              <h2>{movie.title}</h2>
            </div>
            <div className="date-row">
              <button className="active">
                <b>AUG</b>
                <strong>01</strong>
                <small>SAT</small>
              </button>
              <button>
                <b>AUG</b>
                <strong>02</strong>
                <small>SUN</small>
              </button>
              <button>
                <b>AUG</b>
                <strong>03</strong>
                <small>MON</small>
              </button>
            </div>
            <div className="times">
              {movie.times.map((t) => (
                <button
                  className={time === t ? "active" : ""}
                  onClick={() => setTime(t)}
                  key={t}
                >
                  {t}
                </button>
              ))}
            </div>
            <div className="screen-label">
              <span>SCREEN</span>
            </div>
            <div className="seats">
              {seats.map((s) => (
                <button
                  aria-label={`Seat ${s}`}
                  disabled={occupied.includes(s)}
                  className={selected.includes(s) ? "chosen" : ""}
                  onClick={() => toggle(s)}
                  key={s}
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="seat-key">
              <span>
                <i />
                Available
              </span>
              <span>
                <i className="sel" />
                Selected
              </span>
              <span>
                <i className="occ" />
                Taken
              </span>
            </div>
            <div className="booking-total">
              <div>
                <small>
                  {selected.length} SEAT{selected.length !== 1 ? "S" : ""}
                </small>
                <strong>
                  {selected.length ? selected.join(", ") : "Choose your seats"}
                </strong>
              </div>
              <div>
                <small>TOTAL</small>
                <strong>{money(selected.length * 1800)}</strong>
              </div>
              <button
                className="primary"
                disabled={!selected.length}
                onClick={confirm}
              >
                Confirm booking <ArrowRight />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
function SimpleModal({ type, onClose, onLogin }) {
  const [error, setError] = useState(""),
    [loading, setLoading] = useState(false),
    [authMode, setAuthMode] = useState("login");
  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const values = Object.fromEntries(new FormData(e.currentTarget));
    try {
      if (authMode === "register") {
        if (values.password.length < 8)
          throw new Error("Password must contain at least 8 characters.");
        if (values.password !== values.confirmPassword)
          throw new Error("The passwords do not match.");
      }
      delete values.confirmPassword;
      const res = await fetch(
        `${API}/auth/${authMode === "register" ? "register" : "login"}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
        },
      );
      const text = await res.text();
      let data = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        throw new Error(
          "The account service returned an invalid response. Please restart the development server.",
        );
      }
      if (!res.ok)
        throw new Error(
          data.message ||
            `${authMode === "register" ? "Unable to register" : "Unable to sign in"} (${res.status})`,
        );
      if (!data.token || !data.user)
        throw new Error("The login response is incomplete. Please try again.");
      localStorage.setItem("pca_token", data.token);
      localStorage.setItem("pca_user", JSON.stringify(data.user));
      onLogin(data);
    } catch (err) {
      setError(
        err.message === "Failed to fetch"
          ? "Cannot reach the PCA API. Make sure npm run dev is running."
          : err.message,
      );
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="modal-wrap">
      <div className="simple-modal modal">
        <button className="close" onClick={onClose}>
          <X />
        </button>
        {type === "trailer" ? (
          <>
            <div className="video">
              <Play fill="currentColor" />
            </div>
            <span>PCA ORIGINAL</span>
            <h2>Shadow Protocol</h2>
            <p>Official trailer · 2:18</p>
          </>
        ) : (
          <form onSubmit={submit}>
            <div className="login-icon">
              <User />
            </div>
            <span>SECURE PCA ACCESS</span>
            <h2>{authMode === "register" ? "Create account" : "Sign in"}</h2>
            {authMode === "register" && (
              <label>
                Full name
                <input
                  name="name"
                  type="text"
                  placeholder="Enter your full name"
                  autoComplete="name"
                  required
                />
              </label>
            )}
            <label>
              Email address
              <input
                name="email"
                type="email"
                placeholder="name@example.com"
                autoComplete="email"
                required
              />
            </label>
            <label>
              Password
              <input
                name="password"
                type="password"
                placeholder="••••••••"
                autoComplete={
                  authMode === "register" ? "new-password" : "current-password"
                }
                minLength={authMode === "register" ? 8 : undefined}
                required
              />
            </label>
            {authMode === "register" && (
              <label>
                Confirm password
                <input
                  name="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  autoComplete="new-password"
                  minLength="8"
                  required
                />
              </label>
            )}
            {error && <p className="form-message">{error}</p>}
            <button className="primary" disabled={loading}>
              {loading
                ? authMode === "register"
                  ? "Creating account..."
                  : "Signing in..."
                : authMode === "register"
                  ? "Create account"
                  : "Continue"}{" "}
              <ArrowRight />
            </button>
            <div className="auth-switch">
              <span>
                {authMode === "register"
                  ? "Already have an account?"
                  : "New to PCA CineMAX?"}
              </span>
              <button
                type="button"
                onClick={() => {
                  setAuthMode((mode) =>
                    mode === "login" ? "register" : "login",
                  );
                  setError("");
                }}
              >
                {authMode === "register" ? "Sign in" : "Register now"}
              </button>
            </div>
            {authMode === "login" && (
              <p>
                Administrators are automatically routed to the management
                portal.
              </p>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
function Footer() {
  return (
    <footer>
      <div className="footer-top">
        <Brand />
        <h2>
          The story starts
          <br />
          <em>before the screen.</em>
        </h2>
        <a className="primary" href="#movies">
          Explore movies <ArrowRight />
        </a>
      </div>
      <div className="footer-bottom">
        <span>© 2026 PCA CineMAX. All rights reserved.</span>
        <div>
          <a href="#movies">Movies</a>
          <a href="#experiences">Experiences</a>
          <a href="#offers">Offers</a>
        </div>
        <div>
          <Facebook />
          <Instagram />
        </div>
      </div>
    </footer>
  );
}
export default function App() {
  const [movies, setMovies] = useState([]);
  const [catalogueLoaded, setCatalogueLoaded] = useState(false);
  const [heroIndex, setHeroIndex] = useState(0);
  const [heroPaused, setHeroPaused] = useState(false);
  const [booking, setBooking] = useState(null);
  const [route, setRoute] = useState(window.location.pathname);
  const [modal, setModal] = useState(null);
  const [session, setSession] = useState(() => {
    try {
      const token = localStorage.getItem("pca_token"),
        user = JSON.parse(localStorage.getItem("pca_user"));
      return token && user ? { token, user } : null;
    } catch {
      return null;
    }
  });
  useEffect(() => {
    fetch(`${API}/movies`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setMovies(Array.isArray(d) ? d : []))
      .catch(() => setMovies([]))
      .finally(() => setCatalogueLoaded(true));
  }, []);
  useEffect(() => {
    const change = () => setRoute(window.location.pathname);
    window.addEventListener("popstate", change);
    return () => window.removeEventListener("popstate", change);
  }, []);
  const streamingMovies = useMemo(
    () =>
      movies.filter((movie) =>
        String(movie.state || movie.tag || "")
          .toLowerCase()
          .replaceAll(" ", "")
          .includes("nowshowing"),
      ),
    [movies],
  );
  const heroMovies = streamingMovies.length ? streamingMovies : movies;
  useEffect(() => setHeroIndex(0), [heroMovies.length]);
  useEffect(() => {
    if (heroPaused || heroMovies.length < 2) return;
    const timer = window.setInterval(
      () => setHeroIndex((current) => (current + 1) % heroMovies.length),
      3000,
    );
    return () => window.clearInterval(timer);
  }, [heroPaused, heroMovies.length]);
  const hero = heroMovies[heroIndex] || null;
  const book = (movie, time) => {
    const selection = { movie, time };
    setBooking(selection);
    sessionStorage.setItem("pca_booking_movie", JSON.stringify(selection));
    window.history.pushState({}, "", "/booking");
    setRoute("/booking");
  };
  const navigate = (path) => {
    window.history.pushState({}, "", path);
    setRoute(path);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const logout = () => {
    localStorage.removeItem("pca_token");
    localStorage.removeItem("pca_user");
    setSession(null);
  };
  if (session?.user?.role === "admin")
    return <AdminPortal token={session.token} onLogout={logout} />;
  if (route === "/booking") {
    let saved = booking;
    try {
      saved = saved || JSON.parse(sessionStorage.getItem("pca_booking_movie"));
    } catch {}
    return (
      <BookingPage
        initialMovie={saved?.movie}
        initialTime={saved?.time}
        onBack={() => {
          window.history.pushState({}, "", "/");
          setRoute("/");
        }}
      />
    );
  }
  if (route === "/movies")
    return (
      <>
        <Header
          route={route}
          onNavigate={navigate}
          onLogin={() => setModal("login")}
        />
        <MoviesPage movies={movies} loaded={catalogueLoaded} onBook={book} />
        <Footer />
        {modal && (
          <SimpleModal
            type={modal}
            onClose={() => setModal(null)}
            onLogin={(data) => {
              setSession(data);
              setModal(null);
            }}
          />
        )}
      </>
    );
  if (route === "/experiences")
    return (
      <>
        <Header
          route={route}
          onNavigate={navigate}
          onLogin={() => setModal("login")}
        />
        <ExperiencesPage onNavigate={navigate} />
        <Footer />
        {modal && (
          <SimpleModal
            type={modal}
            onClose={() => setModal(null)}
            onLogin={(data) => {
              setSession(data);
              setModal(null);
            }}
          />
        )}
      </>
    );
  if (route.startsWith("/experiences/")) {
    const experience = cinemaExperiences.find(
      (item) => item.slug === route.split("/")[2],
    );
    if (experience)
      return (
        <>
          <Header
            route={route}
            onNavigate={navigate}
            onLogin={() => setModal("login")}
          />
          <ExperienceDetailPage experience={experience} onNavigate={navigate} />
          <Footer />
        </>
      );
  }
  return (
    <>
      <Header
        route={route}
        onNavigate={navigate}
        onLogin={() => setModal("login")}
      />
      <main>
        {hero ? (
          <>
            <Hero
              key={hero.id}
              movie={hero}
              onBook={book}
              onTrailer={(movie) =>
                window.open(movie.trailer, "_blank", "noopener,noreferrer")
              }
              index={heroIndex}
              total={heroMovies.length}
              onSelect={setHeroIndex}
              onHover={setHeroPaused}
            />
            <ShowtimeBar key={`${hero.id}-times`} movie={hero} onBook={book} />
          </>
        ) : (
          <section className="empty-hero" id="top">
            <div>
              <span>PCA CINEMAX</span>
              <h1>{catalogueLoaded ? "COMING SOON" : "LOADING"}</h1>
              <p>
                {catalogueLoaded
                  ? "Our next selection is being prepared. Check back soon."
                  : "Loading the latest movies from PCA..."}
              </p>
            </div>
          </section>
        )}
        <Movies movies={streamingMovies} onBook={book} />
        <Experiences />
        <Offers />
      </main>
      <Footer />
      {modal && (
        <SimpleModal
          type={modal}
          onClose={() => setModal(null)}
          onLogin={(data) => {
            setSession(data);
            setModal(null);
          }}
        />
      )}
    </>
  );
}
