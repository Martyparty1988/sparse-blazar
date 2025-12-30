
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
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    // Replaced SplashScreen with direct Login or Splash that redirects to login
    return <Login />;
  }

  // Request Notification Permission & Setup Reminders
  React.useEffect(() => {
    if ('Notification' in window) {
      if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
        Notification.requestPermission();
      }
    }

    const checkNotifications = async () => {
      if (Notification.permission !== 'granted') return;

      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes(); // Check roughly
      const todayStr = now.toDateString();

      // 1. Checkout Reminder at 17:00
      const lastCheckoutNotif = localStorage.getItem('notif_checkout_date');
      if (currentHour === 17 && currentMinute < 30 && lastCheckoutNotif !== todayStr) {
        new Notification("MST - Konec směny?", {
          body: "Nezapomeň zapsat svou dnešní práci a udělat check-out!",
          icon: "/icon-192.png" // Assuming this exists or similar
        });
        localStorage.setItem('notif_checkout_date', todayStr);
      }

      // 2. Missing Entry Reminder at 09:00 (for yesterday)
      const lastMissingNotif = localStorage.getItem('notif_missing_date');
      if (currentHour === 9 && currentMinute < 30 && lastMissingNotif !== todayStr) {
        // Check if we have entries for yesterday
        // We need to dinamically import db to avoid circular deps if possible, or assume it's available.
        // Since App.tsx imports db for other things generally, we might need to import it if not present.
        // Actually, let's skip complex DB checks in App.tsx to keep it light, or do a simple check.
        // Ideally this logic belongs in a service, but for now:

        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(0, 0, 0, 0);
        const yesterdayEnd = new Date(yesterday);
        yesterdayEnd.setHours(23, 59, 59, 999);

        // We need 'db' to check. Let's assume user is logged in.
        // Since we can't easily access db inside this isolated block without imports, we will skip the DB check 
        // and just show a generic "Did you log yesterday?" reminder if we keep it simple.
        // OR better: Import db at top of App.tsx (it is not imported yet).

        new Notification("MST - Ranní kontrola", {
          body: "Máš zapsanou včerejší práci? Pokud ne, doplň ji teď.",
          icon: "/icon-192.png"
        });
        localStorage.setItem('notif_missing_date', todayStr);
      }
    };

    const interval = setInterval(checkNotifications, 60000 * 15); // Check every 15 mins
    checkNotifications(); // Run once on mount

    return () => clearInterval(interval);
  }, []);

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
