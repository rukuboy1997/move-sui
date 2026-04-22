import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage.jsx';
import FeedPage from './pages/FeedPage.jsx';
import CreatePostPage from './pages/CreatePostPage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';
import MessagesPage from './pages/MessagesPage.jsx';
import ExplorePage from './pages/ExplorePage.jsx';
import NotificationsPage from './pages/NotificationsPage.jsx';
import VerifyEmailPage from './pages/VerifyEmailPage.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/feed" element={<FeedPage />} />
        <Route path="/create" element={<CreatePostPage />} />
        <Route path="/profile/:address" element={<ProfilePage />} />
        <Route path="/messages" element={<MessagesPage />} />
        <Route path="/explore" element={<ExplorePage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
      </Routes>
    </BrowserRouter>
  );
}
