# MST - Martyho Solar Tracker

## Overview
MST (Martyho Solar Tracker) is a professional PWA (Progressive Web App) for managing solar installations, attendance, projects, and teams. The app works offline and is designed for Czech-speaking users.

## Tech Stack
- **Frontend**: React 19 with TypeScript
- **Build Tool**: Vite 7
- **Styling**: Tailwind CSS (via CDN)
- **Database**: Dexie (IndexedDB wrapper) for offline storage
- **Backend Services**: Firebase (Firestore for data persistence)
- **PWA**: vite-plugin-pwa with Workbox for offline functionality

## Project Structure
```
├── components/         # React components
│   ├── icons/          # SVG icon components
│   └── *.tsx           # Feature components (Dashboard, Projects, Workers, etc.)
├── contexts/           # React context providers (Auth, Theme, I18n, Toast)
├── hooks/              # Custom React hooks
├── i18n/               # Internationalization (locales)
├── public/             # Static assets (icons, manifest, service workers)
├── services/           # Backend services (Firebase, Google Sheets, backup)
├── utils/              # Utility functions
├── App.tsx             # Main application component
├── index.tsx           # Entry point
├── types.ts            # TypeScript type definitions
└── vite.config.ts      # Vite configuration
```

## Running the Application
- **Development**: `npm run dev` (runs on port 5000)
- **Build**: `npm run build`
- **Preview**: `npm run preview`

## Key Features
- Project management for solar installations
- Team/worker management
- Attendance tracking
- Field plans
- Statistics and reporting
- Offline support with background sync
- Multi-language support (Czech primary)

## Configuration
- Firebase configuration is in `firebaseConfig.json`
- The app uses Dexie for local IndexedDB storage
- PWA manifest and service worker configuration in `vite.config.ts`
