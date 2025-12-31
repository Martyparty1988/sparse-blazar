
import React, { useState, Suspense, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { BackupProvider } from './contexts/BackupContext';
import { ToastProvider } from './contexts/ToastContext';
import Layout from './components/Layout';
import SplashScreen from './components/SplashScreen';
import Login from './components/Login';
import { firebaseService } from './services/firebaseService';
import { db } from './services/db';
import ErrorBoundary from './components/ErrorBoundary';

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
const Chat = React.lazy(() => import('./components/Chat'));
const Payroll = React.lazy(() => import('./components/Payroll'));

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
  const { isAuthenticated, user } = useAuth();
  const [isSyncing, setIsSyncing] = useState(true);

  // Initial Sync from Cloud - "Fetch First" Strategy
  useEffect(() => {
    const performInitialSync = async () => {
      if (!isAuthenticated || !firebaseService.isReady) {
        setIsSyncing(false);
        return;
      }

      console.log('🔄 Starting mandatory cloud sync (Fetch First)...');
      
      try {
        // 1. Clear local tables to ensure fresh state
        await Promise.all([
          db.workers.clear(),
          db.projects.clear(),
          db.tools.clear(),
          db.fieldTables.clear(),
          db.dailyReports.clear(),
          db.records.clear(),
          db.projectTasks.clear()
        ]);

        // 2. Fetch all data from Firebase
        const [
          workers, 
          projects, 
          tools, 
          fieldTables, 
          dailyReports, 
          timeRecords, 
          projectTasks
        ] = await Promise.all([
          firebaseService.getData('workers'),
          firebaseService.getData('projects'),
          firebaseService.getData('tools'),
          firebaseService.getData('fieldTables'),
          firebaseService.getData('dailyReports'),
          firebaseService.getData('timeRecords'),
          firebaseService.getData('projectTasks')
        ]);

        // 3. Populate local DB
        if (workers) await db.workers.bulkPut(Object.values(workers));
        if (projects) await db.projects.bulkPut(Object.values(projects));
        if (tools) await db.tools.bulkPut(Object.values(tools));
        if (fieldTables) await db.fieldTables.bulkPut(Object.values(fieldTables));
        if (dailyReports) await db.dailyReports.bulkPut(Object.values(dailyReports));
        
        if (timeRecords) {
          const records = Object.values(timeRecords).map((r: any) => ({
            ...r,
            startTime: new Date(r.startTime),
            endTime: new Date(r.endTime)
          }));
          await db.records.bulkPut(records);
        }

        if (projectTasks) {
          const taskList = Object.values(projectTasks).map((t: any) => ({
            ...t,
            completionDate: t.completionDate ? new Date(t.completionDate) : undefined,
            startTime: t.startTime ? new Date(t.startTime) : undefined,
            endTime: t.endTime ? new Date(t.endTime) : undefined
          }));
          await db.projectTasks.bulkPut(taskList);
        }

        console.log('✅ Mandatory cloud sync completed');
      } catch (error) {
        console.error('❌ Mandatory sync failed:', error);
      } finally {
        setIsSyncing(false);
      }
    };

    performInitialSync();
  }, [isAuthenticated]);

  // Request Notification Permission & Setup FCM
  useEffect(() => {
    if (!isAuthenticated || isSyncing) return;

    const setupFCM = async () => {
      if (user?.workerId) {
        await firebaseService.requestNotificationPermission(user.workerId);
      }
    };

    setupFCM();
  }, [isAuthenticated, isSyncing, user?.workerId]);

  if (!isAuthenticated) {
    return <Login />;
  }

  if (isSyncing) {
    return <SplashScreen />;
  }

  return (
    <ToastProvider>
      <BackupProvider>
        <HashRouter>
          <Layout>
            <ErrorBoundary>
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
                  <Route path="/chat" element={<Chat />} />
                  <Route path="/payroll" element={<Payroll />} />
                  <Route path="/import" element={<DataImporter />} />
                  <Route path="*" element={<Navigate to="/" />} />
                </Routes>
              </Suspense>
            </ErrorBoundary>
          </Layout>
        </HashRouter>
      </BackupProvider>
    </ToastProvider>
  );
};

export default App;
