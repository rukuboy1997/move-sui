import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import Layout from '../components/Layout.jsx';
import { getNotifications, markNotificationsRead, truncateAddress } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';

function NotificationIcon({ type }) {
  if (type === 'like') return (
    <div className="w-9 h-9 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-red-400"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
    </div>
  );
  if (type === 'comment') return (
    <div className="w-9 h-9 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400"><path d="m3 21 1.9-5.7a8.5 8.5 0 1 1 3.8 3.8z"/></svg>
    </div>
  );
  if (type === 'follow') return (
    <div className="w-9 h-9 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-400"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
    </div>
  );
  return null;
}

function notificationText(n) {
  const actor = n.actorProfile?.username || truncateAddress(n.actorAddress);
  if (n.type === 'like') return <><strong>@{actor}</strong> liked your post</>;
  if (n.type === 'comment') return <><strong>@{actor}</strong> commented: <span className="text-muted-foreground">"{n.excerpt}"</span></>;
  if (n.type === 'follow') return <><strong>@{actor}</strong> started following you</>;
  return <><strong>@{actor}</strong> {n.excerpt}</>;
}

export default function NotificationsPage() {
  const { isAuthenticated, openAuthModal } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) return;
    const load = async () => {
      try {
        const data = await getNotifications();
        setNotifications(data);
        await markNotificationsRead();
      } catch (err) {
        console.error('Failed to load notifications', err);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <Layout>
        <div className="max-w-md mx-auto w-full px-4 py-20 text-center flex flex-col items-center gap-4">
          <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
          </div>
          <h2 className="text-xl font-bold">Sign in to see notifications</h2>
          <button onClick={() => openAuthModal('signin')} className="bg-primary text-primary-foreground px-6 py-3 rounded-full font-bold hover:bg-primary/90 text-sm">Sign in</button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto w-full px-4 py-6 md:py-8">
        <h1 className="text-xl md:text-2xl font-bold tracking-tight mb-6">Notifications</h1>

        {isLoading ? (
          <div className="flex flex-col gap-3">
            {[1,2,3].map(i => <div key={i} className="glass-panel rounded-2xl h-16 animate-pulse" />)}
          </div>
        ) : notifications.length === 0 ? (
          <div className="glass-panel rounded-3xl p-12 text-center flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
            </div>
            <div>
              <p className="font-semibold">No notifications yet</p>
              <p className="text-sm text-muted-foreground mt-1">When someone likes or comments on your post, you'll see it here.</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {notifications.map(n => {
              const isUnread = !n.readAt;
              const actorAvatar = n.actorProfile?.avatarUrl;
              const actorInitial = (n.actorProfile?.username || '?').charAt(0).toUpperCase();
              const linkTo = n.postId ? `/feed` : `/profile/${n.actorAddress}`;
              return (
                <Link key={n.id} to={linkTo}
                  className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-colors hover:bg-white/5 ${isUnread ? 'bg-primary/5 border border-primary/10' : 'border border-transparent'}`}>
                  <NotificationIcon type={n.type} />
                  <div className="flex-shrink-0">
                    {actorAvatar ? (
                      <img src={actorAvatar} alt="" className="w-9 h-9 rounded-full object-cover" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-gradient-brand flex items-center justify-center text-white font-bold text-sm">{actorInitial}</div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm leading-snug">{notificationText(n)}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {n.createdAt ? formatDistanceToNow(new Date(n.createdAt), { addSuffix: true }) : 'just now'}
                    </p>
                  </div>
                  {isUnread && <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
