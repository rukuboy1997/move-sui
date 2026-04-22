import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout.jsx';
import { getAllProfiles, truncateAddress } from '../lib/api.js';

export default function ExplorePage() {
  const [profiles, setProfiles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchProfiles = async () => {
      setIsLoading(true);
      try {
        const data = await getAllProfiles();
        setProfiles(data || []);
      } catch (err) {
        console.error('Failed to load profiles', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchProfiles();
  }, []);

  const filteredProfiles = profiles.filter(p => 
    (p.username || '').toLowerCase().includes(search.toLowerCase()) || 
    p.address.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Layout>
      <div className="max-w-6xl mx-auto w-full px-4 py-10 flex flex-col gap-8">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold tracking-tight mb-2">Explore</h1>
            <p className="text-muted-foreground text-lg">Discover creators and fans across the network.</p>
          </div>
          
          <div className="relative max-w-sm w-full">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            <input 
              type="text" 
              placeholder="Search by name or address..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-secondary/30 border border-white/10 rounded-full pl-12 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary transition-all"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="glass-panel rounded-3xl p-6 h-64 animate-pulse bg-white/5"></div>
            ))}
          </div>
        ) : filteredProfiles.length === 0 ? (
          <div className="glass-panel rounded-3xl p-16 text-center flex flex-col items-center gap-4">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground mb-2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
            <h3 className="text-2xl font-bold">No profiles found</h3>
            <p className="text-muted-foreground">Try adjusting your search criteria.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredProfiles.map((profile, i) => (
              <Link 
                key={profile.address} 
                to={`/profile/${profile.address}`}
                className="glass-panel rounded-3xl p-6 flex flex-col items-center text-center gap-4 hover:border-primary/50 transition-all hover:-translate-y-1 group"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <div className="w-20 h-20 rounded-full bg-gradient-brand flex items-center justify-center text-white font-bold text-2xl shadow-lg group-hover:scale-110 transition-transform">
                  {profile.username ? profile.username.charAt(0).toUpperCase() : truncateAddress(profile.address).charAt(0)}
                </div>
                
                <div className="w-full">
                  <h3 className="font-bold text-xl truncate px-2 group-hover:text-primary transition-colors">
                    {profile.username || 'Anonymous'}
                  </h3>
                  <p className="text-sm text-muted-foreground font-mono mt-1">
                    {truncateAddress(profile.address)}
                  </p>
                </div>
                
                <p className="text-sm text-muted-foreground line-clamp-2 min-h-[40px] px-2">
                  {profile.bio || 'No bio provided'}
                </p>
                
                <div className="flex w-full justify-around pt-4 mt-2 border-t border-white/5">
                  <div className="flex flex-col">
                    <span className="font-bold text-lg">{profile.postCount || 0}</span>
                    <span className="text-xs text-muted-foreground uppercase tracking-wider">Posts</span>
                  </div>
                  <div className="w-px bg-white/10"></div>
                  <div className="flex flex-col">
                    <span className="font-bold text-lg">{profile.totalLikes || 0}</span>
                    <span className="text-xs text-muted-foreground uppercase tracking-wider">Likes</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
