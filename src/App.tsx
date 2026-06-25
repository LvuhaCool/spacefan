import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Header from './components/Header';
import NewsPage from './pages/NewsPage';
import WritePage from './pages/WritePage';
import NotesPage from './pages/NotesPage';
import StarbasePage from './pages/StarbasePage';
import LoginPage from './pages/LoginPage';

function AppShell() {
  const { loading, authenticated } = useAuth();

  if (loading) {
    return (
      <div className="min-h-svh bg-[#f8f7f5] flex items-center justify-center">
        <div className="w-5 h-5 rounded-full border-2 border-stone-300 border-t-stone-600 animate-spin" />
      </div>
    );
  }

  if (!authenticated) return <LoginPage />;

  return (
    <div className="min-h-svh bg-[#f8f7f5]">
      <Header />
      <Routes>
        <Route path="/" element={<NewsPage />} />
        <Route path="/write" element={<WritePage />} />
        <Route path="/notes" element={<NotesPage />} />
        <Route path="/starbase" element={<StarbasePage />} />
      </Routes>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppShell />
      </AuthProvider>
    </BrowserRouter>
  );
}
