# PCA Cinemas

A full-stack cinema booking experience built with Vite + React, Express, and MongoDB (`PCA`).

## Run locally

1. Copy `server/.env.example` to `server/.env` (optional; the API uses an in-memory demo store when MongoDB is unavailable).
2. Run `npm install` (npm workspaces install the client and server dependencies together)
3. Run `npm run dev`
4. Open `http://localhost:5173`

The API runs on `http://localhost:5000`. Production: build the client with `npm run build`, then run `npm start`.

## Backend API

The backend uses Express and MongoDB database `PCA`. Copy `server/.env.example` to `server/.env` and replace `JWT_SECRET` and the default administrator password before deployment.

### Public endpoints

- `GET /api/health`
- `GET /api/movies` and `GET /api/movies/:id`
- `GET /api/showtimes`
- `GET /api/showtimes/:movieId/seats?date=YYYY-MM-DD&time=...`
- `GET /api/offers` and `POST /api/offers/validate`
- `POST /api/auth/register` and `POST /api/auth/login`
- `POST /api/bookings` and `GET /api/bookings/:reference`

### Authenticated endpoints

Send `Authorization: Bearer <token>`.

- `GET /api/auth/me`
- `GET /api/bookings` (a customer sees their own; an administrator sees all)
- `PATCH /api/bookings/:reference/cancel`
- `POST`, `PATCH`, and `DELETE /api/movies` (administrator only)

Bookings are priced and discounted server-side. The server rejects duplicate seat reservations for the same movie, date, and showtime.

## Vercel + Railway deployment

Set these variables before rebuilding/redeploying each service:

- Vercel: `VITE_API_URL=https://YOUR-BACKEND.up.railway.app`
- Railway backend: `CLIENT_URL=https://YOUR-FRONTEND.vercel.app`
- Railway backend: `MONGODB_URI` to the MongoDB service's private connection URL
- Railway backend: a long random `JWT_SECRET`

Do not include `/api` or a trailing slash in `VITE_API_URL`. If you use Vercel custom and preview domains, put every allowed origin in `CLIENT_URL`, separated by commas. Confirm the connection by opening `https://YOUR-BACKEND.up.railway.app/api/health`; it should return `"database":"mongodb"`.
