import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import NewsPage from './pages/NewsPage';
import WritePage from './pages/WritePage';

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-svh bg-[#f8f7f5]">
        <Header />
        <Routes>
          <Route path="/" element={<NewsPage />} />
          <Route path="/write" element={<WritePage />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
