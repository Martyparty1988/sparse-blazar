
import React, { useState, Suspense } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { BackupProvider } from './contexts/BackupContext';
import { ToastProvider } from './contexts/ToastContext';
import Layout from './components/Layout';
import SplashScreen from './components/SplashScreen';
import Login from './components/Login';
import { firebaseService } from './services/firebaseService';
import { db } from './services/db';

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

  if (!isAuthenticated) {
    // Replaced SplashScreen with direct Login or Splash that redirects to login
    return <Login />;
  }

  // Request Notification Permission & Setup Reminders
  React.useEffect(() => {
    if (!isAuthenticated) return;

    // Request FCM Permission and Token
    const setupFCM = async () => {
      if (user?.workerId) {
        await firebaseService.requestNotificationPermission(user.workerId);
      }
    };

    setupFCM();

    const checkNotifications = async () => {
      if (Notification.permission !== 'granted') return;

      // Local reminders (Client-side)
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const todayStr = now.toDateString();

      // End of day reminder
      const lastCheckoutNotif = localStorage.getItem('notif_checkout_date');
      if (currentHour === 17 && currentMinute < 30 && lastCheckoutNotif !== todayStr) {
        new Notification("MST - Konec směny?", {
          body: "Nezapomeň zapsat svou dnešní práci a udělat check-out!",
          icon: "/icon-192.svg"
        });
        localStorage.setItem('notif_checkout_date', todayStr);
      }
    };

    const interval = setInterval(checkNotifications, 60000 * 15);
    checkNotifications();

    return () => clearInterval(interval);
  }, [isAuthenticated, user?.workerId]);

  // Sync Data on Startup
  React.useEffect(() => {
    const syncData = async () => {
      if (!firebaseService.isReady) return;

      console.log('🔄 Starting initial cloud sync...');

      try {
        // 1. Workers
        const workers = await firebaseService.getData('workers');
        if (workers) await db.workers.bulkPut(Object.values(workers));

        // 2. Projects
        const projects = await firebaseService.getData('projects');
        if (projects) await db.projects.bulkPut(Object.values(projects));

        // 3. Tools
        const tools = await firebaseService.getData('tools');
        if (tools) await db.tools.bulkPut(Object.values(tools));

        // 4. Field Tables
        const fieldTables = await firebaseService.getData('fieldTables');
        if (fieldTables) await db.fieldTables.bulkPut(Object.values(fieldTables));

        // 5. Daily Reports
        const dailyReports = await firebaseService.getData('dailyReports');
        if (dailyReports) await db.dailyReports.bulkPut(Object.values(dailyReports));

        // 6. Time Records (Map 'timeRecords' -> 'records')
        const timeRecords = await firebaseService.getData('timeRecords');
        if (timeRecords) {
          const records = Object.values(timeRecords).map((r: any) => ({
            ...r,
            startTime: new Date(r.startTime),
            endTime: new Date(r.endTime)
          }));
          await db.records.bulkPut(records);
        }

        // 7. Project Tasks
        const tasks = await firebaseService.getData('projectTasks');
        if (tasks) {
          const taskList = Object.values(tasks).map((t: any) => ({
            ...t,
            completionDate: t.completionDate ? new Date(t.completionDate) : undefined,
            startTime: t.startTime ? new Date(t.startTime) : undefined,
            endTime: t.endTime ? new Date(t.endTime) : undefined
          }));
          await db.projectTasks.bulkPut(taskList);
        }

        console.log('✅ Initial cloud sync completed');
      } catch (error) {
        console.error('Initial sync failed:', error);
      }
    };

    // Run sync slightly after mount to let UI settle, or immediately
    syncData();
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
                <Route path="/chat" element={<Chat />} />
                <Route path="/payroll" element={<Payroll />} />
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
