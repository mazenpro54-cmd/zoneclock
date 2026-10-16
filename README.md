# ZoneClock ⏱️

> A HubStaff-style workplace time-tracking app — check in and out when you're in the zone.

---

## Features

| Feature | Details |
|---|---|
| ✅ Check In / Out | One-tap with live timer |
| ☕ Break Tracking | Start/end breaks; net hours auto-calculated |
| 📍 GPS Location | Coordinates captured on check-in |
| 🏷️ Project Tags | Assign sessions to projects |
| 📝 Notes | Add a note on each check-in |
| 📊 Admin Dashboard | KPIs, employee table, weekly hours |
| 📅 Timesheets | Filter by today / yesterday / this week / 30 days |
| 👥 Team Management | Promote/demote admin roles |
| 📤 CSV Export | Download all sessions as CSV |
| 🖨️ PDF Export | Print-ready timesheet |
| 🔐 Auth | Email/password **and** Google OAuth |
| 📱 Mobile-First | PWA-ready, works on phone + desktop |

---

## Quick Start

### 1. Firebase Setup

1. Go to [Firebase Console](https://console.firebase.google.com) → **Create Project**
2. Enable **Authentication** → Sign-in methods → **Email/Password** + **Google**
3. Enable **Firestore Database** (start in production mode)
4. Copy your project config from **Project Settings → General → SDK setup**

### 2. Configure Environment

```bash
cp .env.example .env
# Fill in your Firebase values in .env
```

### 3. Deploy Firestore Rules

```bash
npm install -g firebase-tools
firebase login
firebase use --add   # select your project
firebase deploy --only firestore:rules
```

### 4. Run Locally

```bash
npm install
npm run dev
```

Then open [http://localhost:5173](http://localhost:5173).

---

## Making Someone an Admin

After a user signs up, go to Firebase Console → **Firestore** → `users` collection → find their document → set `role` to `"admin"`.

---

## Project Structure

```
src/
├── contexts/AuthContext.jsx   # Auth state + helpers
├── hooks/
│   ├── useActiveSession.js    # Live session + elapsed timer
│   └── useGeolocation.js      # GPS capture
├── services/
│   ├── sessions.js            # Firestore CRUD
│   └── export.js              # CSV + PDF export
├── pages/
│   ├── LoginPage.jsx
│   ├── ClockPage.jsx          # Main check-in/out UI
│   ├── TimesheetPage.jsx
│   ├── AdminPage.jsx
│   └── ProfilePage.jsx
├── components/
│   └── Navbar.jsx
└── styles/main.css
```

---

## Tech Stack

- **React 18** + **Vite**
- **Firebase** (Auth + Firestore)
- **React Router v6**
- **date-fns** (date formatting)
- **lucide-react** (icons)
