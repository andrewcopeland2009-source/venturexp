import { useEffect } from 'react';
import { createHashRouter, Navigate, Outlet, RouterProvider, useLocation } from 'react-router';
import { MotionConfig } from 'motion/react';
import { usePrefs, useProfile } from '@/hooks/data';
import { Shell } from '@/components/Shell';
import { ToastProvider } from '@/components/toast';
import { Spinner } from '@/components/ui';
import { UpdatePrompt } from '@/components/UpdatePrompt';
import Home from '@/screens/Home';
import Onboarding from '@/screens/Onboarding';
import Catalog from '@/screens/Catalog';
import CategoryOverview from '@/screens/CategoryOverview';
import CourseDetails from '@/screens/CourseDetails';
import LearningPath from '@/screens/LearningPath';
import LessonPlayer from '@/screens/LessonPlayer';
import LessonResults from '@/screens/LessonResults';
import PracticeHub from '@/screens/PracticeHub';
import Flashcards from '@/screens/Flashcards';
import PracticeSession from '@/screens/PracticeSession';
import Glossary from '@/screens/Glossary';
import GlossaryTerm from '@/screens/GlossaryTerm';
import Search from '@/screens/Search';
import Simulator from '@/screens/Simulator';
import Achievements from '@/screens/Achievements';
import Profile from '@/screens/Profile';
import Settings from '@/screens/Settings';
import Backup from '@/screens/Backup';
import NotFound from '@/screens/NotFound';
import { wasJustOnboarded } from '@/onboardingFlag';

/** Applies theme + motion preferences and routes first-time users to onboarding. */
function Root() {
  const profile = useProfile();
  const prefs = usePrefs();
  const location = useLocation();

  useEffect(() => {
    if (!prefs) return;
    const root = document.documentElement;
    root.dataset.theme = prefs.theme;
    root.dataset.motion = prefs.reducedMotion === 'on' ? 'reduced' : prefs.reducedMotion === 'off' ? 'full' : 'system';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', prefs.theme === 'light' ? '#F5F6FB' : '#0B0F19');
  }, [prefs]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  if (!profile || !prefs) return <Spinner />;
  if (!profile.onboarded && !wasJustOnboarded() && location.pathname !== '/welcome') return <Navigate to="/welcome" replace />;

  return (
    <MotionConfig reducedMotion={prefs.reducedMotion === 'on' ? 'always' : prefs.reducedMotion === 'off' ? 'never' : 'user'}>
      <Outlet />
      <UpdatePrompt />
    </MotionConfig>
  );
}

const router = createHashRouter([
  {
    path: '/',
    element: <Root />,
    children: [
      {
        element: <Shell />,
        children: [
          { index: true, element: <Home /> },
          { path: 'learn', element: <Catalog /> },
          { path: 'learn/:categoryId', element: <CategoryOverview /> },
          { path: 'course/:courseId', element: <CourseDetails /> },
          { path: 'course/:courseId/path', element: <LearningPath /> },
          { path: 'practice', element: <PracticeHub /> },
          { path: 'practice/flashcards', element: <Flashcards /> },
          { path: 'practice/:mode', element: <PracticeSession /> },
          { path: 'glossary', element: <Glossary /> },
          { path: 'glossary/:termId', element: <GlossaryTerm /> },
          { path: 'search', element: <Search /> },
          { path: 'simulate', element: <Simulator /> },
          { path: 'achievements', element: <Achievements /> },
          { path: 'profile', element: <Profile /> },
          { path: 'settings', element: <Settings /> },
          { path: 'settings/backup', element: <Backup /> },
          { path: '*', element: <NotFound /> },
        ],
      },
      { path: 'welcome', element: <Onboarding /> },
      { path: 'lesson/:lessonId', element: <LessonPlayer /> },
      { path: 'lesson/:lessonId/results', element: <LessonResults /> },
    ],
  },
]);

export default function App() {
  return (
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>
  );
}
