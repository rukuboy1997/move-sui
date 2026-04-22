import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout.jsx';
import PostCard from '../components/PostCard.jsx';
import { getFeed } from '../lib/api.js';

export default function FeedPage() {
  const [posts, setPosts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchFeed = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getFeed();
      setPosts(data || []);
    } catch (err) {
      setError(err.message || 'Failed to load feed');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFeed();
  }, []);

  const handleLikeUpdate = (postId, newLikes, newCommentCount) => {
    setPosts(current => current.map(post => {
      if (post.id === postId) {
        return { 
          ...post, 
          likes: newLikes !== undefined ? newLikes : post.likes,
          commentCount: newCommentCount !== undefined ? newCommentCount : post.commentCount
        };
      }
      return post;
    }));
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto w-full px-4 py-8 flex flex-col gap-6">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-xl md:text-3xl font-bold tracking-tight">Feed</h1>
          <button onClick={fetchFeed} className="p-2 rounded-full hover:bg-white/10 transition-colors text-muted-foreground hover:text-foreground">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={isLoading ? "animate-spin" : ""}><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
          </button>
        </div>

        {isLoading && posts.length === 0 ? (
          <div className="flex flex-col gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="glass-panel rounded-3xl p-6 h-64 animate-pulse bg-white/5"></div>
            ))}
          </div>
        ) : error ? (
          <div className="glass-panel rounded-3xl p-10 text-center flex flex-col items-center gap-4 border-destructive/30">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-destructive"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <div>
              <h3 className="text-xl font-bold mb-2">Failed to load feed</h3>
              <p className="text-muted-foreground">{error}</p>
            </div>
            <button onClick={fetchFeed} className="mt-4 px-6 py-2 bg-secondary text-secondary-foreground rounded-full font-medium hover:bg-secondary/80 transition-colors">
              Try Again
            </button>
          </div>
        ) : posts.length === 0 ? (
          <div className="glass-panel rounded-3xl p-12 text-center flex flex-col items-center gap-4">
            <div className="w-20 h-20 bg-secondary rounded-full flex items-center justify-center mb-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            </div>
            <h3 className="text-2xl font-bold">It's quiet here</h3>
            <p className="text-muted-foreground max-w-sm">There are no posts on the network yet. Be the first to share your world!</p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {posts.map((post, i) => (
              <div key={post.id} style={{ animationDelay: `${i * 100}ms` }}>
                <PostCard post={post} onLikeUpdate={handleLikeUpdate} />
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
