import React, { useState, Suspense, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from './contexts/AuthContext';
import { BackupProvider } from './contexts/BackupContext';
import { ToastProvider } from './contexts/ToastContext';
import Layout from './components/Layout';
import SplashScreen from './components/SplashScreen';
import Login from './components/Login';
import { firebaseService } from './services/firebaseService';
import ErrorBoundary from './components/ErrorBoundary';

// Lazy loading components remain the same
const Dashboard = React.lazy(() => import('./components/Dashboard'));
const MyTasks = React.lazy(() => import('./components/MyTasks'));
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
const Chat = React.lazy(() => import('./components/Chat'));
const Payroll = React.lazy(() => import('./components/Payroll'));
const WorkerDetail = React.lazy(() => import('./components/WorkerDetail'));

const PageLoader = () => (
  <div className="flex flex-col items-center justify-center h-full min-h-[50vh] animate-fade-in">
    <div className="relative w-16 h-16 mb-4">
      <div className="absolute inset-0 border-4 border-[var(--color-primary)]/30 rounded-full"></div>
      <div className="absolute inset-0 border-4 border-[var(--color-accent)] rounded-full border-t-transparent animate-spin"></div>
    </div>
    <p className="text-white/60 text-sm font-black uppercase tracking-widest animate-pulse">Synchronizuji...</p>
  </div>
);

// Animated Routes Component to handle transitions
const AnimatedRoutes = () => {
  const location = useLocation();
  const { user } = useAuth();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="h-full"
      >
        <Suspense fallback={<PageLoader />}>
          <Routes location={location}>
            <Route path="/" element={user?.role === 'admin' ? <Dashboard /> : <Navigate to="/my-tasks" />} />
            <Route path="/my-tasks" element={<MyTasks />} />
            <Route path="/workers" element={<Workers />} />
            <Route path="/workers/:id" element={<WorkerDetail />} />
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
            <Route path="/chat" element={<Chat />} />
            <Route path="/payroll" element={<Payroll />} />
            <Route path="/import" element={<DataImporter />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </Suspense>
      </motion.div>
    </AnimatePresence>
  );
};

const App: React.FC = () => {
  const { isAuthenticated, user, isLoading: authLoading } = useAuth();

  useEffect(() => {
    const performInitialSync = async () => {
      // Run sync in background without blocking UI
      if (firebaseService.isReady) {
        firebaseService.synchronize().catch(console.error);
      }
    };

    if (isAuthenticated) {
      performInitialSync();
    }

    // Sync on window focus (Real-time-ish feeling)
    const handleFocus = () => {
      if (isAuthenticated && firebaseService.isReady && document.visibilityState === 'visible') {
        console.log("📱 App focused, checking for updates...");
        firebaseService.synchronize(false).catch(console.error); // Incremental sync
        firebaseService.updateBadge(0);
      }
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('visibilitychange', handleFocus);

    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('visibilitychange', handleFocus);
    };

  }, [isAuthenticated]);

  if (authLoading) return (
    <div className="fixed inset-0 bg-[#020617] flex items-center justify-center z-50">
      <PageLoader />
    </div>
  );
  if (!isAuthenticated) return <Login />;

  return (
    <ToastProvider>
      <BackupProvider>
        <HashRouter>
          <Layout>
            <ErrorBoundary>
              <AnimatedRoutes />
            </ErrorBoundary>
          </Layout>
        </HashRouter>
      </BackupProvider>
    </ToastProvider>
  );
};

export default App;
