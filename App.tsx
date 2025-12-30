
import React, { useState, Suspense } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { BackupProvider } from './contexts/BackupContext';
import { ToastProvider } from './contexts/ToastContext';
import Layout from './components/Layout';
import SplashScreen from './components/SplashScreen';
import Login from './components/Login';

// Lazy loading components for performance optimization (Code Splitting)
const Dashboard = React.lazy(() => import('./components/Dashboard'));
const Workers = React.lazy(() => import('./components/Workers'));
const Projects = React.lazy(() => import('./components/Projects'));
const Settings = React.lazy(() => import('./components/Settings'));
const Statistics = React.lazy(() => import('./components/Statistics'));
const StatsPage = React.lazy(() => import('./components/StatsPage'));
const TimeRecords = React.lazy(() => import('./components/TimeRecords'));
const Reports = React.lazy(() => import('./components/Reports'));
const Attendance = React.lazy(() => import('./components/Attendance'));
const DataImporter = React.lazy(() => import('./components/DataImporter'));
const FieldPlans = React.lazy(() => import('./components/FieldPlans'));
const ToolManager = React.lazy(() => import('./components/ToolManager'));
const DailyReports = React.lazy(() => import('./components/DailyReports'));

// Loading Fallback Component
const PageLoader = () => (
  <div className="flex flex-col items-center justify-center h-full min-h-[50vh] animate-fade-in">
    <div className="relative w-16 h-16 mb-4">
      <div className="absolute inset-0 border-4 border-[var(--color-primary)]/30 rounded-full"></div>
      <div className="absolute inset-0 border-4 border-[var(--color-accent)] rounded-full border-t-transparent animate-spin"></div>
    </div>
    <p className="text-white/60 text-sm font-black uppercase tracking-widest animate-pulse">Načítám...</p>
  </div>
);

const App: React.FC = () => {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    // Replaced SplashScreen with direct Login or Splash that redirects to login
    return <Login />;
  }

  // Request Notification Permission
  React.useEffect(() => {
    if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
      Notification.requestPermission();
    }
  }, []);

  return (
    <ToastProvider>
      <BackupProvider>
        <HashRouter>
          <Layout>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/workers" element={<Workers />} />
                <Route path="/projects" element={<Projects />} />
                <Route path="/field-plans" element={<FieldPlans />} />
                <Route path="/statistics" element={<Statistics />} />
                <Route path="/stats" element={<StatsPage />} />
                <Route path="/records" element={<TimeRecords />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/attendance" element={<Attendance />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/tools" element={<ToolManager />} />
                <Route path="/daily-reports" element={<DailyReports />} />
                <Route path="/import" element={<DataImporter />} />
                <Route path="*" element={<Navigate to="/" />} />
              </Routes>
            </Suspense>
          </Layout>
        </HashRouter>
      </BackupProvider>
    </ToastProvider>
  );
};

export default App;
