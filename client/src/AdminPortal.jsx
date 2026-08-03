import React, { useEffect, useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  Bell,
  CalendarDays,
  Clock,
  ChevronDown,
  Clapperboard,
  CreditCard,
  Download,
  FileText,
  Film,
  LayoutDashboard,
  LogOut,
  Menu,
  MonitorPlay,
  Moon,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Ticket,
  Users,
  WalletCards,
  X,
} from "lucide-react";
import { API, backendAsset } from "./api.js";

const nav = [
  ["Dashboard", LayoutDashboard],
  ["Movies", Film],
  ["Showtimes", CalendarDays],
  ["Screens & Seats", MonitorPlay],
  ["Bookings", Ticket],
  ["Customers", Users],
  ["Offers", WalletCards],
  ["Payments", CreditCard],
  ["Reports", BarChart3],
  ["Staff & Security", ShieldCheck],
  ["Content", FileText],
];
const money = (n) => `LKR ${Number(n || 0).toLocaleString()}`;
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const MAX_UPLOAD_DIMENSION = 1600;
const fileToImage = (file) =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read the image"));
    };
    img.src = url;
  });
const canvasBlob = (canvas, quality) =>
  new Promise((resolve) => canvas.toBlob(resolve, "image/webp", quality));
const compressImage = async (file) => {
  if (file.size <= MAX_UPLOAD_BYTES) return file;
  const img = await fileToImage(file);
  const { naturalWidth: w, naturalHeight: h } = img;
  const max = Math.max(w, h);
  const draw = (dimension, quality) => {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round((w / max) * dimension));
    canvas.height = Math.max(1, Math.round((h / max) * dimension));
    canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvasBlob(canvas, quality);
  };
  let blob = await draw(MAX_UPLOAD_DIMENSION, 0.85);
  if (blob.size > MAX_UPLOAD_BYTES)
    blob = await draw(MAX_UPLOAD_DIMENSION, 0.5);
  if (blob.size > MAX_UPLOAD_BYTES)
    blob = await draw(Math.round(MAX_UPLOAD_DIMENSION / 2), 0.6);
  return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".webp", {
    type: "image/webp",
  });
};
const request = async (path, token, options = {}) => {
  let res;
  try {
    res = await fetch(`${API}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    });
  } catch {
    throw new Error(
      "Network error: the server could not be reached. The image may have been rejected as too large — try a smaller image.",
    );
  }
  const text = await res.text();
  let data = {};
  try {
    data = JSON.parse(text);
  } catch {}
  if (!res.ok) throw new Error(data.message || `Request failed (${res.status})`);
  return data;
};
const uploadImage = async (file, token) => {
  if (!file?.size) return "";
  const form = new FormData();
  form.append("image", await compressImage(file));
  let res;
  try {
    res = await fetch(`${API}/admin/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
  } catch {
    throw new Error(
      "Image upload failed: the server rejected the request. The image may be too large — try a smaller one.",
    );
  }
  const text = await res.text();
  let data = {};
  try {
    data = JSON.parse(text);
  } catch {}
  if (!res.ok) throw new Error(data.message || `Image upload failed (${res.status})`);
  return data.url;
};
const sampleSales = [38, 58, 44, 72, 60, 92, 76];

function Sidebar({ page, setPage, logout, open, setOpen }) {
  return (
    <aside className={open ? "admin-side open" : "admin-side"}>
      <div className="admin-logo">
        <img src="/assets/pca-cinemax-admin.png" alt="PCA CineMAX" />
        <span>ADMIN CONSOLE</span>
      </div>
      <nav>
        {nav.map(([label, Icon]) => (
          <button
            key={label}
            className={page === label ? "active" : ""}
            onClick={() => {
              setPage(label);
              setOpen(false);
            }}
          >
            <Icon />
            <span>{label}</span>
            {page === label && <i />}
          </button>
        ))}
      </nav>
      <div className="admin-side-foot">
        <div className="avatar">PA</div>
        <div>
          <b>PCA Admin</b>
          <small>Super Administrator</small>
          <small className="admin-build">build 2026-08-04b</small>
        </div>
        <button onClick={logout} title="Sign out">
          <LogOut />
        </button>
      </div>
    </aside>
  );
}
function Topbar({ page, onMenu }) {
  return (
    <div className="admin-top">
      <button className="mobile-admin-menu" onClick={onMenu}>
        <Menu />
      </button>
      <div>
        <small>ADMIN / {page.toUpperCase()}</small>
        <h1>{page}</h1>
      </div>
      <div className="admin-tools">
        <label>
          <Search />
          <input placeholder="Search anything..." />
        </label>
        <button>
          <Bell />
          <i />
        </button>
        <button>
          <Moon />
        </button>
      </div>
    </div>
  );
}
function Metric({ icon: Icon, label, value, change, tone }) {
  return (
    <article className={`metric ${tone || ""}`}>
      <div className="metric-icon">
        <Icon />
      </div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{change}</small>
      </div>
    </article>
  );
}
function Bars({ data = sampleSales }) {
  const max = Math.max(...data, 1);
  return (
    <div className="bars">
      {data.map((n, i) => (
        <div key={i}>
          <span style={{ height: `${Math.max((n / max) * 100, 5)}%` }} />
          <small>{["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"][i]}</small>
        </div>
      ))}
    </div>
  );
}
function Dashboard({ token }) {
  const [data, setData] = useState(null),
    [error, setError] = useState("");
  useEffect(() => {
    request("/admin/dashboard", token)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [token]);
  if (error)
    return <div className="admin-error">Could not load dashboard: {error}</div>;
  if (!data) return <Loader />;
  const sales = data.sales?.length
    ? data.sales.map((s) => s.revenue)
    : [0, 0, 0, 0, 0, 0, 0];
  return (
    <>
      <div className="metrics">
        <Metric
          icon={Film}
          label="TOTAL MOVIES"
          value={data.totalMovies}
          change="Live MongoDB count"
        />
        <Metric
          icon={CalendarDays}
          label="TODAY'S SHOWTIMES"
          value={data.todayShows}
          change="Across all screens"
        />
        <Metric
          icon={Ticket}
          label="TOTAL BOOKINGS"
          value={data.totalBookings}
          change="All-time records"
        />
        <Metric
          icon={WalletCards}
          label="MONTH REVENUE"
          value={money(data.todayRevenue)}
          change="Confirmed sales"
          tone="hot"
        />
      </div>
      <div className="dash-grid">
        <section className="panel sales-panel">
          <PanelHead title="Sales overview" sub="LAST 7 DAYS" />
          <div className="big-revenue">
            {money(sales.reduce((a, b) => a + b, 0))}
            <small>GROSS SALES</small>
          </div>
          <Bars data={sales} />
        </section>
        <section className="panel occupancy">
          <PanelHead title="Seat occupancy" sub="TODAY" />
          <div
            className="donut"
            style={{ "--pct": `${data.seats?.occupancy || 0}%` }}
          >
            <div>
              <strong>{data.seats?.occupancy || 0}%</strong>
              <span>OCCUPIED</span>
            </div>
          </div>
          <div className="seat-counts">
            <span>
              <i className="red" />
              {data.seats?.occupied || 0} Occupied
            </span>
            <span>
              <i />
              {data.seats?.available || 0} Available
            </span>
          </div>
        </section>
      </div>
      <div className="dash-grid lower">
        <section className="panel">
          <PanelHead title="Recent bookings" sub="LIVE" />
          <BookingTable rows={data.recent} />
        </section>
        <section className="panel popular">
          <PanelHead title="Popular movies" sub="BY SEATS" />
          {(data.popular?.length
            ? data.popular
            : [
                { _id: "Shadow Protocol", seats: 84 },
                { _id: "The Last Signal", seats: 63 },
                { _id: "Crimson Tide", seats: 47 },
              ]
          ).map((m, i) => (
            <div className="popular-row" key={m._id}>
              <b>0{i + 1}</b>
              <div>
                <strong>{m._id}</strong>
                <span>{m.seats} tickets sold</span>
              </div>
              <em style={{ width: `${Math.min(m.seats, 100)}%` }} />
            </div>
          ))}
        </section>
      </div>
    </>
  );
}
function PanelHead({ title, sub, action }) {
  return (
    <div className="panel-head">
      <div>
        <h3>{title}</h3>
        <span>{sub}</span>
      </div>
      {action}
    </div>
  );
}
function Loader() {
  return <div className="loader">Loading PCA data...</div>;
}
function Status({ value }) {
  return (
    <span
      className={`status ${String(value).toLowerCase().replaceAll(" ", "-")}`}
    >
      {value}
    </span>
  );
}
function BookingTable({ rows = [] }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>REFERENCE</th>
            <th>MOVIE</th>
            <th>SHOW</th>
            <th>SEATS</th>
            <th>TOTAL</th>
            <th>STATUS</th>
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((b) => (
              <tr key={b._id || b.reference}>
                <td>
                  <b>{b.reference}</b>
                </td>
                <td>{b.movieTitle}</td>
                <td>
                  {b.showDate}
                  <small>{b.showtime}</small>
                </td>
                <td>{b.seats?.join(", ")}</td>
                <td>{money(b.total)}</td>
                <td>
                  <Status value={b.status} />
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="6" className="empty">
                No booking records yet
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
function MoviesPage({ token }) {
  const [items, setItems] = useState([]),
    [edit, setEdit] = useState(null),
    [message, setMessage] = useState(""),
    [imdbOpen, setImdbOpen] = useState(false),
    [imdbReady, setImdbReady] = useState(false),
    [imdbResults, setImdbResults] = useState([]),
    [imdbLoading, setImdbLoading] = useState(false);
  const load = () => request("/admin/movies", token).then(setItems);
  useEffect(() => {
    load();
    request("/admin/imdb/status", token)
      .then((data) => setImdbReady(data.configured))
      .catch(() => {});
  }, []);
  const searchIMDb = async (e) => {
    e.preventDefault();
    const query = new FormData(e.currentTarget).get("query");
    setImdbLoading(true);
    setMessage("");
    try {
      setImdbResults(
        await request(
          `/admin/imdb/search?q=${encodeURIComponent(query)}`,
          token,
        ),
      );
    } catch (err) {
      setMessage(err.message);
    } finally {
      setImdbLoading(false);
    }
  };
  const importIMDb = async (id) => {
    setImdbLoading(true);
    try {
      const movie = await request(`/admin/imdb/title/${id}`, token);
      setEdit({
        ...movie,
        active: true,
        state: "Coming Soon",
        language: "English",
        times: [],
      });
      setImdbOpen(false);
      setImdbResults([]);
    } catch (err) {
      setMessage(err.message);
    } finally {
      setImdbLoading(false);
    }
  };
  const save = async (e) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const posterFile = form.get("posterFile");
    const heroFile = form.get("heroFile");
    const seatIconFile = form.get("seatIconFile");
    form.delete("posterFile");
    form.delete("heroFile");
    form.delete("seatIconFile");
    const body = Object.fromEntries(form);
    body.times = String(body.times || "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
    body.active = body.status !== "draft";
    body.featured = body.featured === "on";
    delete body.status;
    try {
      body.poster = (await uploadImage(posterFile, token)) || edit.poster || "";
      body.hero = (await uploadImage(heroFile, token)) || edit.hero || "";
      body.seatIcon =
        (await uploadImage(seatIconFile, token)) || edit.seatIcon || "";
      if (edit?._id)
        await request(`/movies/${edit.id}`, token, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
      else
        await request("/movies", token, {
          method: "POST",
          body: JSON.stringify(body),
        });
      setEdit(null);
      setMessage("Movie saved successfully");
      load();
    } catch (err) {
      setMessage(err.message);
    }
  };
  const archive = async (movie) => {
    if (
      !window.confirm(
        `Permanently delete ${movie.title}? This cannot be undone.`,
      )
    )
      return;
    try {
      await request(`/admin/movies/${movie._id}`, token, { method: "DELETE" });
      load();
    } catch (err) {
      setMessage(err.message);
    }
  };
  return (
    <>
      <PageActions
        title="Movie library"
        subtitle={`${items.length} published titles`}
        onAdd={() => setEdit({})}
        label="Add new movie"
      />
      <div className="imdb-toolbar">
        <div>
          <strong>IMDb metadata</strong>
          <span>
            {imdbReady
              ? "Official API connected"
              : "Credentials required in server/.env"}
          </span>
        </div>
        <button onClick={() => setImdbOpen(true)} disabled={!imdbReady}>
          <Search /> Import from IMDb
        </button>
      </div>
      <div className="admin-movie-grid">
        {items.map((m, i) => (
          <article key={m.id}>
            <div
              className="mini-poster"
              style={{
                "--tone": m.color || "#9c1016",
                backgroundImage: m.poster
                  ? `linear-gradient(0deg,#080808dd,#08080822),url(${backendAsset(m.poster)})`
                  : undefined,
              }}
            >
              <span>0{i + 1}</span>
              <b>{m.title}</b>
            </div>
            <div>
              <Status value={m.tag || "Published"} />
              <h3>{m.title}</h3>
              <p>
                {m.genre} · {m.language || "English"} · {m.runtime}
              </p>
              <div className="movie-row-actions">
                <button onClick={() => setEdit(m)}>Edit details</button>
                <button onClick={() => archive(m)}>Delete</button>
              </div>
            </div>
          </article>
        ))}
      </div>
      {edit && (
        <Editor
          title={edit._id ? "Edit movie" : "Add new movie"}
          onClose={() => setEdit(null)}
        >
          <form onSubmit={save} className="admin-form">
            {edit.imdbId && (
              <div className="imdb-imported wide">
                <b>IMDb</b>
                <span>Imported title ID: {edit.imdbId}</span>
                <input type="hidden" name="imdbId" value={edit.imdbId} />
              </div>
            )}
            <Field label="Movie title" name="title" value={edit.title} />
            <Field label="Unique ID" name="id" value={edit.id} />
            <Field
              label="IMDb ID (example: tt3896198)"
              name="imdbId"
              value={edit.imdbId}
            />
            <label className="wide">
              Description
              <textarea name="synopsis" defaultValue={edit.synopsis} />
            </label>
            <Field label="Genre" name="genre" value={edit.genre} />
            <Field
              label="Language"
              name="language"
              value={edit.language || "English"}
            />
            <Field label="Duration" name="runtime" value={edit.runtime} />
            <Field
              label="Age rating"
              name="certificate"
              value={edit.certificate}
            />
            <Field
              label="Release date"
              name="releaseDate"
              type="date"
              value={edit.releaseDate?.slice?.(0, 10)}
            />
            <Field label="Trailer URL" name="trailer" value={edit.trailer} />
            <Field
              label="Showtimes (comma separated)"
              name="times"
              value={edit.times?.join(", ")}
            />
            <label>
              Status
              <select
                name="status"
                defaultValue={edit.active === false ? "draft" : "published"}
              >
                <option value="published">Published</option>
                <option value="draft">Draft</option>
              </select>
            </label>
            <label>
              Homepage state
              <select name="state" defaultValue={edit.state || "Now Showing"}>
                <option>Now Showing</option>
                <option>Coming Soon</option>
              </select>
            </label>
            <label className="check-label">
              <input
                name="featured"
                type="checkbox"
                defaultChecked={edit.featured}
              />{" "}
              Featured homepage movie
            </label>
            <label>
              Poster upload
              <input name="posterFile" type="file" accept="image/*" />
            </label>
            <label>
              Hero background
              <input name="heroFile" type="file" accept="image/*" />
            </label>
            <label className="wide">
              Seat selection icon (PNG or image)
              <input
                name="seatIconFile"
                type="file"
                accept="image/png,image/svg+xml,image/webp,image/*"
              />
              <small>
                This icon appears inside seats selected by customers. A red PCA
                seat is used when no icon is uploaded.
              </small>
              {edit.seatIcon && (
                <span className="seat-icon-preview">
                  <img
                    src={backendAsset(edit.seatIcon)}
                    alt="Current selected-seat icon"
                  />
                  Current icon
                </span>
              )}
            </label>
            <button className="admin-primary wide">Save movie</button>
          </form>
          {message && <p className="form-message">{message}</p>}
        </Editor>
      )}
      {imdbOpen && (
        <Editor
          title="Search IMDb"
          onClose={() => {
            setImdbOpen(false);
            setImdbResults([]);
          }}
        >
          <form className="imdb-search" onSubmit={searchIMDb}>
            <Search />
            <input
              name="query"
              placeholder="Search movie title..."
              minLength="2"
              required
            />
            <button className="admin-primary">Search IMDb</button>
          </form>
          {message && <div className="admin-error">{message}</div>}
          {imdbLoading ? (
            <Loader />
          ) : (
            <div className="imdb-results">
              {imdbResults.map((movie) => (
                <button key={movie.id} onClick={() => importIMDb(movie.id)}>
                  <div>
                    <strong>{movie.titleText?.text}</strong>
                    <span>{movie.releaseYear?.year || "Year unavailable"}</span>
                  </div>
                  <div>
                    <b>{movie.ratingsSummary?.aggregateRating || "—"}</b>
                    <small>IMDb</small>
                  </div>
                </button>
              ))}
              {!imdbResults.length && (
                <p>
                  Search the official IMDb catalogue, then select a result to
                  pre-fill the PCA movie editor.
                </p>
              )}
            </div>
          )}
        </Editor>
      )}
    </>
  );
}
function Field({ label, name, value, type = "text" }) {
  return (
    <label>
      {label}
      <input
        name={name}
        type={type}
        defaultValue={value || ""}
        required={["title", "id"].includes(name)}
      />
    </label>
  );
}
function Editor({ title, onClose, children }) {
  return (
    <div className="admin-overlay">
      <div className="editor">
        <div className="editor-head">
          <h2>{title}</h2>
          <button onClick={onClose}>
            <X />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
function PageActions({ title, subtitle, onAdd, label = "Create new" }) {
  return (
    <div className="page-actions">
      <div>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
      {onAdd && (
        <button className="admin-primary" onClick={onAdd}>
          <Plus />
          {label}
        </button>
      )}
    </div>
  );
}
function ShowtimesPage({ token }) {
  const [rows, setRows] = useState([]),
    [movies, setMovies] = useState([]),
    [screens, setScreens] = useState([]),
    [open, setOpen] = useState(false),
    [editing, setEditing] = useState(null),
    [error, setError] = useState(""),
    [search, setSearch] = useState(""),
    [selected, setSelected] = useState([]),
    [deleting, setDeleting] = useState(false),
    [showtimeTimes, setShowtimeTimes] = useState([]),
    [timeInput, setTimeInput] = useState("");
  const load = () => request("/admin/showtimes", token).then(setRows);
  useEffect(() => {
    load();
    request("/movies", token).then(setMovies);
    request("/admin/screens", token).then(setScreens);
  }, []);
  const create = async (e) => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.currentTarget));
    body.movieTitle = movies.find((m) => m.id === body.movieId)?.title;
    body.price = Number(body.price);
    const repeat = body.repeat === "on";
    delete body.repeat;
    try {
      if (!showtimeTimes.length) throw new Error("Add at least one showtime");
      if (editing) {
        await request(`/admin/showtimes/${editing._id}`, token, {
          method: "PATCH",
          body: JSON.stringify({
            ...body,
            time: showtimeTimes[0],
          }),
        });
      } else {
        await request("/admin/showtimes/bulk", token, {
          method: "POST",
          body: JSON.stringify({
            ...body,
            times: showtimeTimes,
            repeatDays: repeat ? 7 : 1,
          }),
        });
      }
      setOpen(false);
      setEditing(null);
      setShowtimeTimes([]);
      setTimeInput("");
      load();
    } catch (err) {
      setError(err.message);
    }
  };
  const cancel = async (showtime) => {
    if (!window.confirm("Cancel this screening?")) return;
    try {
      await request(`/admin/showtimes/${showtime._id}`, token, {
        method: "DELETE",
      });
      load();
    } catch (err) {
      setError(err.message);
    }
  };
  const removeShowtime = async (showtime) => {
    if (
      !window.confirm(
        `Permanently delete ${showtime.movieTitle} on ${showtime.date} at ${showtime.time}?`,
      )
    )
      return;
    try {
      await request(`/admin/showtimes/${showtime._id}/permanent`, token, {
        method: "DELETE",
      });
      load();
    } catch (err) {
      setError(err.message);
    }
  };
  const bulkDelete = async () => {
    if (!selected.length) return;
    if (
      !window.confirm(
        `Permanently delete ${selected.length} selected showtime${selected.length === 1 ? "" : "s"}? This cannot be undone.`,
      )
    )
      return;
    setDeleting(true);
    setError("");
    try {
      await request("/admin/showtimes/bulk/permanent", token, {
        method: "DELETE",
        body: JSON.stringify({ ids: selected }),
      });
      setSelected([]);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setDeleting(false);
    }
  };
  const visible = rows.filter((s) =>
    `${s.movieTitle} ${s.screen} ${s.date}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const visibleIds = visible.map((showtime) => showtime._id);
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selected.includes(id));
  const toggleAllVisible = () =>
    setSelected((current) =>
      allVisibleSelected
        ? current.filter((id) => !visibleIds.includes(id))
        : [...new Set([...current, ...visibleIds])],
    );
  return (
    <>
      <PageActions
        title="Showtime schedule"
        subtitle="Plan screenings without conflicts"
        onAdd={() => {
          setEditing(null);
          setShowtimeTimes([]);
          setTimeInput("");
          setError("");
          setOpen(true);
        }}
        label="Create showtime"
      />
      <section className="panel">
        <div className="table-filters">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search movie, screen or date..."
          />
          <button
            onClick={() => setSearch(new Date().toISOString().slice(0, 10))}
          >
            Today
          </button>
          <button onClick={() => setSearch("")}>All dates</button>
          {selected.length > 0 && (
            <button
              className="bulk-delete-button"
              onClick={bulkDelete}
              disabled={deleting}
            >
              {deleting
                ? "Deleting..."
                : `Delete selected (${selected.length})`}
            </button>
          )}
        </div>
        {error && <p className="table-error">{error}</p>}
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th className="select-column">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleAllVisible}
                    aria-label="Select all visible showtimes"
                  />
                </th>
                <th>MOVIE</th>
                <th>DATE & TIME</th>
                <th>SCREEN</th>
                <th>FORMAT</th>
                <th>LANGUAGE</th>
                <th>PRICE</th>
                <th>STATUS</th>
                <th>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((s) => (
                <tr
                  key={s._id}
                  className={selected.includes(s._id) ? "row-selected" : ""}
                >
                  <td className="select-column">
                    <input
                      type="checkbox"
                      checked={selected.includes(s._id)}
                      onChange={() =>
                        setSelected((current) =>
                          current.includes(s._id)
                            ? current.filter((id) => id !== s._id)
                            : [...current, s._id],
                        )
                      }
                      aria-label={`Select ${s.movieTitle} on ${s.date} at ${s.time}`}
                    />
                  </td>
                  <td>
                    <b>{s.movieTitle}</b>
                  </td>
                  <td>
                    {s.date}
                    <small>{s.time}</small>
                  </td>
                  <td>{s.screen}</td>
                  <td>
                    <Status value={s.format} />
                  </td>
                  <td>{s.language}</td>
                  <td>{money(s.price)}</td>
                  <td>
                    <Status value={s.status} />
                  </td>
                  <td>
                    <div className="row-actions">
                      <button
                        className="row-action edit"
                        onClick={() => {
                          setEditing(s);
                          setShowtimeTimes([s.time]);
                          setTimeInput("");
                          setOpen(true);
                          setError("");
                        }}
                      >
                        Edit
                      </button>
                      <button
                        className="row-action"
                        disabled={s.status === "cancelled"}
                        onClick={() => cancel(s)}
                      >
                        Cancel
                      </button>
                      <button
                        className="row-action delete"
                        onClick={() => removeShowtime(s)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {open && (
        <Editor
          title={editing ? "Edit showtime" : "Create showtime"}
          onClose={() => {
            setOpen(false);
            setEditing(null);
          }}
        >
          <form onSubmit={create} className="admin-form">
            <label>
              Movie
              <select name="movieId" defaultValue={editing?.movieId}>
                {movies.map((m) => (
                  <option value={m.id}>{m.title}</option>
                ))}
              </select>
            </label>
            <Field label="Date" name="date" type="date" value={editing?.date} />
            <label className="wide">
              {editing ? "Showtime" : "Showtimes"}
              <span className="multi-time-entry">
                <input
                  type="time"
                  value={timeInput}
                  onChange={(event) => setTimeInput(event.target.value)}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!timeInput) return;
                    setShowtimeTimes((current) =>
                      [...new Set([...current, timeInput])].sort(),
                    );
                    setTimeInput("");
                  }}
                >
                  <Plus /> Add time
                </button>
              </span>
              <span className="selected-times">
                {showtimeTimes.map((time) => (
                  <button
                    type="button"
                    key={time}
                    onClick={() =>
                      setShowtimeTimes((current) =>
                        current.filter((item) => item !== time),
                      )
                    }
                    title="Remove time"
                  >
                    <Clock /> {time} <X />
                  </button>
                ))}
                {!showtimeTimes.length && <small>No times added yet</small>}
              </span>
              {!editing && (
                <small>
                  Add as many screening times as needed for this movie.
                </small>
              )}
            </label>
            <label>
              Cinema screen
              <select name="screen" required defaultValue={editing?.screen}>
                {screens.map((s) => (
                  <option key={s._id} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Format
              <select name="format" defaultValue={editing?.format}>
                <option>2D</option>
                <option>3D</option>
                <option>IMAX</option>
                <option>4DX</option>
              </select>
            </label>
            <Field
              label="Ticket price"
              name="price"
              type="number"
              value={editing?.price || "1800"}
            />
            <Field
              label="Language"
              name="language"
              value={editing?.language || "English"}
            />
            {!editing && (
              <label>
                <input name="repeat" type="checkbox" /> Repeat daily for 7 days
              </label>
            )}
            {error && <p className="form-message">{error}</p>}
            <button className="admin-primary wide">Schedule showtime</button>
          </form>
        </Editor>
      )}
    </>
  );
}
const moduleConfig = {
  "Screens & Seats": {
    icon: MonitorPlay,
    title: "Cinema screens",
    sub: "Configure layouts, seat categories and accessibility",
    actions: ["Add screen", "Design seat layout"],
    stats: [
      ["Screens", "04"],
      ["Total seats", "428"],
      ["Blocked", "07"],
      ["Accessible", "12"],
    ],
    columns: [
      "SCREEN",
      "CAPACITY",
      "REGULAR",
      "PREMIUM / VIP",
      "BLOCKED",
      "OCCUPANCY",
    ],
    rows: [
      ["Screen 01", "120", "84", "28 / 8", "2", "74%"],
      ["Screen 02", "96", "68", "22 / 6", "1", "62%"],
      ["IMAX Hall", "148", "96", "40 / 12", "3", "81%"],
    ],
  },
  Bookings: {
    icon: Ticket,
    title: "Booking management",
    sub: "Search, modify, refund and export reservations",
    actions: ["Counter booking", "Export CSV"],
    stats: [
      ["Today", "124"],
      ["Confirmed", "112"],
      ["Pending", "08"],
      ["Cancelled", "04"],
    ],
    columns: ["REFERENCE", "CUSTOMER", "MOVIE", "SEATS", "PAYMENT", "STATUS"],
    rows: [
      [
        "PCA-92F4A1",
        "Nimal Perera",
        "Shadow Protocol",
        "C4, C5",
        "Card",
        "Confirmed",
      ],
      [
        "PCA-18D7C2",
        "Sara Fernando",
        "The Last Signal",
        "A7",
        "Online",
        "Confirmed",
      ],
      [
        "PCA-56AB90",
        "Counter sale",
        "Crimson Tide",
        "D2, D3",
        "Cash",
        "Pending",
      ],
    ],
  },
  Customers: {
    icon: Users,
    title: "Customer directory",
    sub: "Profiles, loyalty, feedback and booking history",
    actions: ["Send notification", "Export customers"],
    stats: [
      ["Customers", "1,284"],
      ["New this month", "86"],
      ["Frequent", "142"],
      ["Loyalty points", "248K"],
    ],
    columns: [
      "CUSTOMER",
      "EMAIL",
      "BOOKINGS",
      "TOTAL SPENT",
      "POINTS",
      "STATUS",
    ],
    rows: [
      [
        "Nimal Perera",
        "nimal@email.com",
        "18",
        "LKR 62,400",
        "6,240",
        "Active",
      ],
      [
        "Sara Fernando",
        "sara@email.com",
        "12",
        "LKR 41,200",
        "4,120",
        "Active",
      ],
      ["Kasun Silva", "kasun@email.com", "2", "LKR 7,200", "720", "Review"],
    ],
  },
  Offers: {
    icon: WalletCards,
    title: "Offers & promotions",
    sub: "Discount codes, usage limits and performance",
    actions: ["Create promotion"],
    stats: [
      ["Active offers", "06"],
      ["Redemptions", "428"],
      ["Discount value", "LKR 184K"],
      ["Conversion", "18.4%"],
    ],
    columns: ["CODE", "OFFER", "DISCOUNT", "REDEMPTIONS", "EXPIRES", "STATUS"],
    rows: [
      ["FIRST20", "First booking", "20%", "186 / 500", "31 Dec 2026", "Active"],
      [
        "NIGHTOWL",
        "Tuesday late shows",
        "50%",
        "92 / 200",
        "30 Sep 2026",
        "Active",
      ],
      ["PCA15", "Partner cards", "15%", "150 / 1000", "31 Dec 2026", "Active"],
    ],
  },
  Payments: {
    icon: CreditCard,
    title: "Payment management",
    sub: "Transactions, refunds and daily reconciliation",
    actions: ["Reconcile today", "Export payments"],
    stats: [
      ["Successful", "LKR 425K"],
      ["Pending", "LKR 18K"],
      ["Failed", "LKR 7K"],
      ["Refunded", "LKR 12K"],
    ],
    columns: ["TRANSACTION", "BOOKING", "METHOD", "AMOUNT", "TIME", "STATUS"],
    rows: [
      [
        "PAY-87421",
        "PCA-92F4A1",
        "Card",
        "LKR 3,600",
        "10:42 AM",
        "Successful",
      ],
      [
        "PAY-87420",
        "PCA-18D7C2",
        "PayHere",
        "LKR 1,800",
        "10:36 AM",
        "Successful",
      ],
      ["PAY-87419", "PCA-56AB90", "Cash", "LKR 3,600", "10:30 AM", "Pending"],
    ],
  },
  "Staff & Security": {
    icon: ShieldCheck,
    title: "Staff & security",
    sub: "Roles, permissions, login activity and audit trail",
    actions: ["Add staff account", "Security settings"],
    stats: [
      ["Administrators", "03"],
      ["Managers", "05"],
      ["Cashiers", "12"],
      ["Active sessions", "08"],
    ],
    columns: [
      "STAFF MEMBER",
      "ROLE",
      "LAST LOGIN",
      "2FA",
      "STATUS",
      "ACTIVITY",
    ],
    rows: [
      [
        "PCA Administrator",
        "Super Admin",
        "Today, 10:22",
        "Enabled",
        "Active",
        "Updated showtime",
      ],
      [
        "M. Fernando",
        "Manager",
        "Today, 09:14",
        "Enabled",
        "Active",
        "Approved refund",
      ],
      [
        "A. Silva",
        "Cashier",
        "Yesterday, 21:48",
        "Disabled",
        "Active",
        "Counter booking",
      ],
    ],
  },
  Content: {
    icon: FileText,
    title: "Content management",
    sub: "Homepage, announcements, policies and cinema information",
    actions: ["Add content block", "Homepage preview"],
    stats: [
      ["Banners", "04"],
      ["Announcements", "02"],
      ["Policies", "03"],
      ["Locations", "01"],
    ],
    columns: ["CONTENT", "TYPE", "PLACEMENT", "UPDATED", "STATUS", "OWNER"],
    rows: [
      [
        "Shadow Protocol hero",
        "Homepage banner",
        "Hero",
        "Today, 09:45",
        "Published",
        "PCA Admin",
      ],
      [
        "Weekend maintenance",
        "Announcement",
        "Global",
        "31 Jul 2026",
        "Scheduled",
        "Manager",
      ],
      [
        "Refund policy",
        "Policy",
        "Footer",
        "20 Jul 2026",
        "Published",
        "PCA Admin",
      ],
    ],
  },
};
function GenericModule({ name }) {
  const c = moduleConfig[name],
    Icon = c.icon;
  return (
    <>
      <PageActions
        title={c.title}
        subtitle={c.sub}
        onAdd={() => {}}
        label={c.actions[0]}
      />
      <div className="mini-metrics">
        {c.stats.map(([a, b]) => (
          <article>
            <span>{a}</span>
            <strong>{b}</strong>
          </article>
        ))}
      </div>
      <section className="panel">
        <div className="table-filters">
          <label>
            <Search />
            <input placeholder={`Search ${name.toLowerCase()}...`} />
          </label>
          {c.actions.slice(1).map((a) => (
            <button>{a}</button>
          ))}
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {c.columns.map((h) => (
                  <th>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {c.rows.map((row, i) => (
                <tr>
                  {row.map((v, j) => (
                    <td>
                      {j === 0 ? (
                        <b>{v}</b>
                      ) : j === row.length - 2 ? (
                        <Status value={v} />
                      ) : (
                        v
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
const dbSpecs = {
  "Screens & Seats": {
    path: "/admin/screens",
    columns: ["SCREEN", "CAPACITY", "REGULAR", "PREMIUM", "VIP", "BLOCKED"],
    row: (x) => [
      x.name,
      x.capacity,
      x.regularSeats,
      x.premiumSeats,
      x.vipSeats,
      x.blockedSeats?.join(", ") || "None",
    ],
    fields: [
      ["name", "Screen name"],
      ["capacity", "Capacity", "number"],
      ["regularSeats", "Regular seats", "number"],
      ["premiumSeats", "Premium seats", "number"],
      ["vipSeats", "VIP seats", "number"],
      ["wheelchairSeats", "Accessible seats", "number"],
      ["blockedSeats", "Blocked seats (comma separated)"],
    ],
  },
  Bookings: {
    path: "/bookings",
    columns: ["REFERENCE", "MOVIE", "DATE & TIME", "SEATS", "TOTAL", "STATUS"],
    row: (x) => [
      x.reference,
      x.movieTitle,
      `${x.showDate} · ${x.showtime}`,
      x.seats?.join(", "),
      money(x.total),
      x.status,
    ],
    fields: [
      ["showDate", "Show date", "date"],
      ["showtime", "Show time"],
      ["seats", "Seats (comma separated)"],
      ["status", "Booking status"],
    ],
    editOnly: true,
  },
  Customers: {
    path: "/admin/customers",
    columns: [
      "CUSTOMER",
      "EMAIL",
      "BOOKINGS",
      "TOTAL SPENT",
      "LOYALTY",
      "STATUS",
    ],
    row: (x) => [
      x.name,
      x.email,
      x.bookingCount,
      money(x.spent),
      x.loyaltyPoints || 0,
      x.blocked ? "Blocked" : "Active",
    ],
    fields: [
      ["name", "Customer name"],
      ["loyaltyPoints", "Loyalty points", "number"],
      ["blocked", "Account status"],
    ],
    editOnly: true,
  },
  Offers: {
    path: "/offers",
    create: "/admin/offers",
    columns: ["CODE", "OFFER", "DISCOUNT", "USES", "EXPIRES", "STATUS"],
    row: (x) => [
      x.code,
      x.title,
      x.fixedDiscount ? money(x.fixedDiscount) : `${x.discountPercent}%`,
      `${x.uses || 0}${x.maxUses ? ` / ${x.maxUses}` : ""}`,
      x.expiresAt ? new Date(x.expiresAt).toLocaleDateString() : "No expiry",
      x.active ? "Active" : "Disabled",
    ],
    fields: [
      ["code", "Promotion code"],
      ["title", "Offer title"],
      ["description", "Description"],
      ["discountPercent", "Percentage discount", "number"],
      ["fixedDiscount", "Fixed discount", "number"],
      ["maxUses", "Usage limit", "number"],
      ["expiresAt", "Expiry date", "date"],
      ["offerType", "Offer type"],
    ],
  },
  Payments: {
    path: "/admin/payments",
    columns: [
      "TRANSACTION",
      "BOOKING",
      "METHOD",
      "AMOUNT",
      "REFUNDED",
      "STATUS",
    ],
    row: (x) => [
      x.reference,
      x.bookingReference,
      x.method,
      money(x.amount),
      money(x.refundedAmount),
      x.status,
    ],
    fields: [
      ["method", "Payment method"],
      ["amount", "Amount", "number"],
      ["status", "Payment status"],
    ],
    editOnly: true,
  },
  "Staff & Security": {
    path: "/admin/staff",
    create: "/admin/staff",
    columns: ["STAFF MEMBER", "EMAIL", "ROLE", "CREATED", "ACCOUNT", "ID"],
    row: (x) => [
      x.name,
      x.email,
      x.role,
      new Date(x.createdAt).toLocaleDateString(),
      x.blocked ? "Blocked" : "Active",
      x._id,
    ],
    fields: [
      ["name", "Staff name"],
      ["email", "Email", "email"],
      ["password", "Temporary password", "password"],
      ["role", "Role"],
    ],
  },
  Content: {
    path: "/admin/content",
    create: "/admin/content",
    columns: ["CONTENT", "TYPE", "KEY", "UPDATED", "STATUS", "ID"],
    row: (x) => [
      x.title,
      x.type,
      x.key,
      new Date(x.updatedAt).toLocaleDateString(),
      x.active ? "Published" : "Hidden",
      x._id,
    ],
    fields: [
      ["key", "Unique content key"],
      ["title", "Title"],
      ["type", "Content type"],
      ["body", "Content text"],
      ["image", "Image URL"],
    ],
  },
};
function DatabaseModule({ name, token }) {
  const c = moduleConfig[name],
    spec = dbSpecs[name];
  const [rows, setRows] = useState([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [search, setSearch] = useState(""),
    [open, setOpen] = useState(false),
    [editing, setEditing] = useState(null);
  const load = () => {
    setLoading(true);
    request(spec.path, token)
      .then(setRows)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, [name, token]);
  const filtered = useMemo(
    () =>
      rows.filter((x) =>
        JSON.stringify(x).toLowerCase().includes(search.toLowerCase()),
      ),
    [rows, search],
  );
  const save = async (e) => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.currentTarget));
    for (const [k, , type] of spec.fields || [])
      if (type === "number") body[k] = Number(body[k] || 0);
    if (name === "Screens & Seats")
      body.blockedSeats = String(body.blockedSeats || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    if (name === "Bookings")
      body.seats = String(body.seats || "")
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean);
    if (name === "Customers") body.blocked = String(body.blocked) === "true";
    if (name === "Staff & Security" && !body.password) delete body.password;
    try {
      const editPaths = {
        "Screens & Seats": `/admin/screens/${editing?._id}`,
        Bookings: `/admin/bookings/${editing?.reference}`,
        Customers: `/admin/customers/${editing?._id}`,
        Offers: `/admin/offers/${editing?._id}`,
        Payments: `/admin/payments/${editing?._id}`,
        "Staff & Security": `/admin/staff/${editing?._id}`,
        Content: "/admin/content",
      };
      await request(
        editing ? editPaths[name] : spec.create || spec.path,
        token,
        {
          method: editing && name !== "Content" ? "PATCH" : "POST",
          body: JSON.stringify(body),
        },
      );
      setOpen(false);
      setEditing(null);
      setError("");
      load();
    } catch (err) {
      setError(err.message);
    }
  };
  const action = async (item) => {
    try {
      if (name === "Bookings")
        await request(`/bookings/${item.reference}/cancel`, token, {
          method: "PATCH",
          body: "{}",
        });
      if (name === "Customers")
        await request(`/admin/customers/${item._id}`, token, {
          method: "PATCH",
          body: JSON.stringify({ blocked: !item.blocked }),
        });
      if (name === "Payments")
        await request(`/admin/payments/${item._id}/refund`, token, {
          method: "POST",
          body: JSON.stringify({ amount: item.amount }),
        });
      load();
    } catch (err) {
      setError(err.message);
    }
  };
  const remove = async (item) => {
    const label =
      item.title ||
      item.name ||
      item.reference ||
      item.code ||
      item.email ||
      "this record";
    if (!window.confirm(`Permanently delete ${label}? This cannot be undone.`))
      return;
    const paths = {
      "Screens & Seats": `/admin/screens/${item._id}`,
      Bookings: `/admin/bookings/${item.reference}`,
      Customers: `/admin/customers/${item._id}`,
      Offers: `/admin/offers/${item._id}`,
      Payments: `/admin/payments/${item._id}`,
      "Staff & Security": `/admin/staff/${item._id}`,
      Content: `/admin/content/${item._id}`,
    };
    try {
      await request(paths[name], token, { method: "DELETE" });
      setError("");
      load();
    } catch (err) {
      setError(err.message);
    }
  };
  const exportCsv = () => {
    if (name === "Bookings") {
      const a = document.createElement("a");
      a.href = `${API}/admin/export/bookings.csv`;
      a.download = "pca-bookings.csv";
      fetch(a.href, { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.blob())
        .then((blob) => {
          a.href = URL.createObjectURL(blob);
          a.click();
          URL.revokeObjectURL(a.href);
        });
    }
  };
  const values = filtered.map(spec.row);
  return (
    <>
      <PageActions
        title={c.title}
        subtitle={`${rows.length} database records`}
        onAdd={
          spec.fields && !spec.editOnly
            ? () => {
                setEditing(null);
                setOpen(true);
              }
            : name === "Bookings"
              ? exportCsv
              : undefined
        }
        label={spec.fields && !spec.editOnly ? c.actions[0] : "Export CSV"}
      />
      <div className="mini-metrics">
        <article>
          <span>Total records</span>
          <strong>{rows.length}</strong>
        </article>
        <article>
          <span>Active</span>
          <strong>
            {
              rows.filter(
                (x) =>
                  x.active !== false && x.status !== "cancelled" && !x.blocked,
              ).length
            }
          </strong>
        </article>
        <article>
          <span>Updated today</span>
          <strong>
            {
              rows.filter((x) =>
                String(x.updatedAt || x.createdAt).startsWith(
                  new Date().toISOString().slice(0, 10),
                ),
              ).length
            }
          </strong>
        </article>
        <article>
          <span>Source</span>
          <strong className="db-source">MongoDB</strong>
        </article>
      </div>
      <section className="panel">
        <div className="table-filters">
          <label>
            <Search />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${name.toLowerCase()}...`}
            />
          </label>
          <button onClick={load}>Refresh data</button>
        </div>
        {error && <div className="admin-error">{error}</div>}
        {loading ? (
          <Loader />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {spec.columns.map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                  <th>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {values.length ? (
                  values.map((row, i) => (
                    <tr key={filtered[i]._id || i}>
                      {row.map((v, j) => (
                        <td key={j}>
                          {j === 0 ? (
                            <b>{v || "—"}</b>
                          ) : spec.columns[j]?.includes("STATUS") ||
                            spec.columns[j] === "ACCOUNT" ? (
                            <Status value={v || "Unknown"} />
                          ) : (
                            (v ?? "—")
                          )}
                        </td>
                      ))}
                      <td>
                        <div className="row-actions">
                          <button
                            className="row-action edit"
                            onClick={() => {
                              setEditing(filtered[i]);
                              setOpen(true);
                              setError("");
                            }}
                          >
                            Edit
                          </button>
                          {["Bookings", "Customers", "Payments"].includes(
                            name,
                          ) && (
                            <button
                              className="row-action"
                              onClick={() => action(filtered[i])}
                            >
                              {name === "Bookings"
                                ? "Cancel"
                                : name === "Customers"
                                  ? filtered[i].blocked
                                    ? "Unblock"
                                    : "Block"
                                  : "Refund"}
                            </button>
                          )}
                          <button
                            className="row-action delete"
                            onClick={() => remove(filtered[i])}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="empty" colSpan={spec.columns.length + 1}>
                      No database records found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {open && (
        <Editor
          title={
            editing
              ? `Edit ${editing.title || editing.name || editing.reference || editing.code || "record"}`
              : c.actions[0]
          }
          onClose={() => {
            setOpen(false);
            setEditing(null);
          }}
        >
          <form className="admin-form" onSubmit={save}>
            {spec.fields.map(([key, label, type = "text"]) =>
              key === "body" ? (
                <label className="wide" key={key}>
                  {label}
                  <textarea name={key} defaultValue={editing?.[key] || ""} />
                </label>
              ) : key === "role" ? (
                <label key={key}>
                  {label}
                  <select name={key} defaultValue={editing?.[key] || "cashier"}>
                    <option>cashier</option>
                    <option>manager</option>
                    <option>admin</option>
                  </select>
                </label>
              ) : key === "blocked" ? (
                <label key={key}>
                  {label}
                  <select
                    name={key}
                    defaultValue={String(editing?.blocked || false)}
                  >
                    <option value="false">Active</option>
                    <option value="true">Blocked</option>
                  </select>
                </label>
              ) : (
                <Field
                  key={key}
                  label={label}
                  name={key}
                  type={type}
                  value={
                    key === "seats"
                      ? editing?.seats?.join(", ")
                      : key === "expiresAt"
                        ? editing?.expiresAt?.slice?.(0, 10)
                        : editing?.[key]
                  }
                />
              ),
            )}
            {error && <p className="form-message wide">{error}</p>}
            <button className="admin-primary wide">Save to database</button>
          </form>
        </Editor>
      )}
    </>
  );
}
function Reports({ token }) {
  const [data, setData] = useState(null),
    [error, setError] = useState("");
  useEffect(() => {
    request("/admin/reports", token)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [token]);
  if (error) return <div className="admin-error">{error}</div>;
  if (!data) return <Loader />;
  const totalRevenue = data.revenue.reduce((sum, x) => sum + x.revenue, 0),
    totalTickets = data.revenue.reduce((sum, x) => sum + x.tickets, 0),
    topMovie = data.movies[0];
  const cards = [
    [
      "Revenue performance",
      money(totalRevenue),
      data.revenue.map((x) => x.revenue),
    ],
    [
      "Ticket sales by movie",
      `${totalTickets} tickets`,
      data.movies.map((x) => x.tickets),
    ],
    [
      "Most popular movie",
      topMovie ? topMovie._id : "No sales",
      data.movies.map((x) => x.tickets),
    ],
    [
      "Peak booking hour",
      data.hours[0] ? `${data.hours[0]._id}:00` : "No data",
      data.hours.map((x) => x.bookings),
    ],
    [
      "Customer growth",
      `${data.growth.reduce((s, x) => s + x.customers, 0)} new`,
      data.growth.map((x) => x.customers),
    ],
    [
      "Promotion performance",
      `${data.promotions.reduce((s, x) => s + x.uses, 0)} uses`,
      data.promotions.map((x) => x.uses),
    ],
    [
      "Promotion savings",
      money(data.promotions.reduce((s, x) => s + x.discount, 0)),
      data.promotions.map((x) => x.discount),
    ],
    [
      "Payment records",
      `${data.paymentStatuses.reduce((s, x) => s + x.count, 0)} payments`,
      data.paymentStatuses.map((x) => x.count),
    ],
  ];
  return (
    <>
      <PageActions
        title="Reports & analytics"
        subtitle="Live MongoDB analytics for the last 30 days"
      />
      <div className="report-grid">
        {cards.map(([title, value, series]) => (
          <article key={title}>
            <div>
              <Activity />
              <span>LIVE DATA</span>
            </div>
            <h3>{title}</h3>
            <strong>{value}</strong>
            <div className="spark">
              {(series.length ? series : [0, 0, 0, 0, 0, 0, 0])
                .slice(-7)
                .map((n, j) => {
                  const max = Math.max(...series, 1);
                  return (
                    <i
                      key={j}
                      style={{ height: `${Math.max((n / max) * 48, 3)}px` }}
                    />
                  );
                })}
            </div>
            <button onClick={() => window.print()}>
              <Download /> PRINT / SAVE PDF
            </button>
          </article>
        ))}
      </div>
    </>
  );
}
export default function AdminPortal({ token, onLogout }) {
  const [page, setPage] = useState("Dashboard"),
    [open, setOpen] = useState(false);
  useEffect(() => {
    let timer;
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(onLogout, 30 * 60 * 1000);
    };
    const events = ["click", "keydown", "mousemove", "touchstart"];
    events.forEach((e) => window.addEventListener(e, reset));
    reset();
    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [onLogout]);
  let body =
    page === "Dashboard" ? (
      <Dashboard token={token} />
    ) : page === "Movies" ? (
      <MoviesPage token={token} />
    ) : page === "Showtimes" ? (
      <ShowtimesPage token={token} />
    ) : page === "Reports" ? (
      <Reports token={token} />
    ) : (
      <DatabaseModule name={page} token={token} />
    );
  return (
    <div className="admin-shell">
      <Sidebar
        page={page}
        setPage={setPage}
        logout={onLogout}
        open={open}
        setOpen={setOpen}
      />
      <main className="admin-main">
        <Topbar page={page} onMenu={() => setOpen(true)} />
        <div className="admin-content">{body}</div>
      </main>
    </div>
  );
}
