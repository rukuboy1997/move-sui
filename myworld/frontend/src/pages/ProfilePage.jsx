import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import Layout from '../components/Layout.jsx';
import PostCard from '../components/PostCard.jsx';
import { getProfile, createProfile, followUser, unfollowUser, getFollowStatus, truncateAddress } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';

const PROFESSIONS = [
  'Actor / Actress', 'Athlete / Sports Competitor', 'Author / Publisher',
  'Business Man / Tycoon', 'Celebrity Chef', 'Coach / Manager', 'Comedian',
  'Content Creator', 'Cybersecurity Expert', 'Dancer / Choreographer',
  'Fashion Designer', 'Film Director', 'Footballer', 'Grappler', 'Influencer',
  'Journalist / Broadcaster', 'Makeup Artist', 'Model', 'Musician / Singer',
  'Photographer', 'Podcaster', 'Race Car Driver', 'Screenwriter', 'Streamer',
  'Student', 'Tech Entrepreneur', 'Voice Actor', 'YouTuber',
];

const EMPTY_FORM = {
  username: '', bio: '', displayName: '', website: '', location: '', twitter: '', profession: '',
};

export default function ProfilePage() {
  const { address } = useParams();
  const { address: currentWallet, isAuthenticated } = useAuth();
  const isOwnProfile = !!currentWallet && address === currentWallet;

  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [bannerFile, setBannerFile] = useState(null);
  const [bannerPreview, setBannerPreview] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  // Follow state
  const [isFollowing, setIsFollowing] = useState(false);
  const [isFollowLoading, setIsFollowLoading] = useState(false);

  const avatarRef = useRef(null);
  const bannerRef = useRef(null);

  const fetchProfile = async () => {
    setIsLoading(true);
    try {
      const data = await getProfile(address);
      setProfile(data);
      if (data) {
        setEditForm({
          username: data.username || '',
          bio: data.bio || '',
          displayName: data.displayName || '',
          website: data.website || '',
          location: data.location || '',
          twitter: data.twitter || '',
          profession: data.profession || '',
        });
      }
    } catch (err) {
      console.error('Failed to load profile', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchFollowStatus = async () => {
    if (!isAuthenticated || isOwnProfile) return;
    try {
      const { following } = await getFollowStatus(address);
      setIsFollowing(following);
    } catch {}
  };

  useEffect(() => { fetchProfile(); }, [address]);
  useEffect(() => { fetchFollowStatus(); }, [address, isAuthenticated]);

  const handleFollowToggle = async () => {
    if (!isAuthenticated) return;
    setIsFollowLoading(true);
    try {
      if (isFollowing) {
        await unfollowUser(address);
        setIsFollowing(false);
        setProfile(p => p ? { ...p, followerCount: Math.max(0, (p.followerCount || 1) - 1) } : p);
      } else {
        await followUser(address);
        setIsFollowing(true);
        setProfile(p => p ? { ...p, followerCount: (p.followerCount || 0) + 1 } : p);
      }
    } catch (err) {
      console.error('Follow toggle failed', err);
    } finally {
      setIsFollowLoading(false);
    }
  };

  const handleFile = (kind) => (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('Please pick an image'); return; }
    if (file.size > 10 * 1024 * 1024) { setError('Image must be under 10 MB'); return; }
    setError(null);
    const url = URL.createObjectURL(file);
    if (kind === 'avatar') { setAvatarFile(file); setAvatarPreview(url); }
    else { setBannerFile(file); setBannerPreview(url); }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    try {
      const updated = await createProfile({
        address: currentWallet,
        username: editForm.username.trim(),
        bio: editForm.bio.trim(),
        displayName: editForm.displayName.trim(),
        website: editForm.website.trim(),
        location: editForm.location.trim(),
        twitter: editForm.twitter.trim(),
        profession: editForm.profession,
        ...(avatarFile ? { avatar: avatarFile } : {}),
        ...(bannerFile ? { banner: bannerFile } : {}),
      });
      setProfile(prev => ({ ...prev, ...updated }));
      setIsEditing(false);
      setAvatarFile(null); setAvatarPreview(null);
      setBannerFile(null); setBannerPreview(null);
    } catch (err) {
      setError(err.message || 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLikeUpdate = (postId, newLikes, newCommentCount) => {
    if (!profile) return;
    setProfile(current => ({
      ...current,
      posts: current.posts.map(post => post.id === postId
        ? { ...post,
            likes: newLikes !== undefined ? newLikes : post.likes,
            commentCount: newCommentCount !== undefined ? newCommentCount : post.commentCount }
        : post
      )
    }));
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto w-full px-4 py-10">
          <div className="glass-panel rounded-3xl p-8 h-64 animate-pulse mb-8"></div>
          <div className="flex flex-col gap-6">
            <div className="glass-panel rounded-3xl p-6 h-48 animate-pulse"></div>
            <div className="glass-panel rounded-3xl p-6 h-48 animate-pulse"></div>
          </div>
        </div>
      </Layout>
    );
  }

  const avatarSrc = avatarPreview || profile?.avatarUrl;
  const bannerSrc = bannerPreview || profile?.bannerUrl;
  const initial = profile?.username
    ? profile.username.charAt(0).toUpperCase()
    : truncateAddress(address).charAt(0);

  return (
    <Layout>
      <div className="max-w-4xl mx-auto w-full px-4 py-6 md:py-10 animate-fade-in">
        <div className="glass-panel rounded-3xl mb-8 overflow-hidden">
          <div className="px-4 md:px-8 pt-6 pb-6">

            {/* Header row */}
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="flex items-center gap-3 md:gap-6 min-w-0">
                {avatarSrc ? (
                  <img src={avatarSrc} alt={profile?.username}
                    className="w-16 h-16 md:w-28 md:h-28 rounded-full object-cover border-2 border-white/10 shadow-xl flex-shrink-0" />
                ) : (
                  <div className="w-16 h-16 md:w-28 md:h-28 rounded-full bg-gradient-brand flex items-center justify-center text-white font-bold text-2xl md:text-4xl shadow-xl border-2 border-white/10 flex-shrink-0">
                    {initial}
                  </div>
                )}
                <div className="min-w-0">
                  <h1 className="text-lg md:text-3xl font-bold tracking-tight truncate">
                    {profile?.displayName || profile?.username || 'Anonymous'}
                  </h1>
                  {profile?.username && profile?.displayName && (
                    <p className="text-muted-foreground text-sm">@{profile.username}</p>
                  )}
                  {profile?.profession && (
                    <span className="inline-block mt-1 text-xs font-medium bg-primary/15 text-primary px-2.5 py-1 rounded-full border border-primary/20">
                      {profile.profession}
                    </span>
                  )}
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <span className="text-muted-foreground bg-secondary/50 px-3 py-1 rounded-full text-xs font-mono border border-white/5">
                      {truncateAddress(address)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 self-start flex-shrink-0">
                {!isOwnProfile && isAuthenticated && (
                  <button
                    onClick={handleFollowToggle}
                    disabled={isFollowLoading}
                    className={`px-5 py-2 rounded-full font-medium text-sm transition-colors border disabled:opacity-60 ${
                      isFollowing
                        ? 'bg-secondary border-white/10 hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-400'
                        : 'bg-primary text-primary-foreground border-transparent hover:bg-primary/90'
                    }`}
                  >
                    {isFollowLoading ? '…' : isFollowing ? 'Following' : 'Follow'}
                  </button>
                )}
                {isOwnProfile && !isEditing && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="bg-secondary text-secondary-foreground px-5 py-2 rounded-full font-medium hover:bg-secondary/80 transition-colors border border-white/10 text-sm"
                  >
                    Edit Profile
                  </button>
                )}
              </div>
            </div>

            {/* Follower / following / likes stats */}
            {!isEditing && (
              <div className="flex flex-wrap gap-4 mt-4">
                <div className="text-center">
                  <span className="font-bold text-sm">{profile?.followerCount ?? 0}</span>
                  <span className="text-xs text-muted-foreground ml-1">Followers</span>
                </div>
                <div className="text-center">
                  <span className="font-bold text-sm">{profile?.followingCount ?? 0}</span>
                  <span className="text-xs text-muted-foreground ml-1">Following</span>
                </div>
                {profile?.totalLikes > 0 && (
                  <div className="text-center flex items-center gap-1 text-teal-400 text-xs font-medium">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
                    {profile.totalLikes} likes
                  </div>
                )}
              </div>
            )}

            {/* Bio + meta */}
            {!isEditing && (
              <div className="mt-4 flex flex-col gap-2">
                {profile?.bio ? (
                  <p className="text-sm md:text-base leading-relaxed max-w-2xl text-foreground/90">{profile.bio}</p>
                ) : isOwnProfile ? (
                  <p className="text-muted-foreground italic text-sm">No bio yet. <button onClick={() => setIsEditing(true)} className="text-primary hover:underline">Add one</button></p>
                ) : (
                  <p className="text-muted-foreground italic text-sm">No bio yet.</p>
                )}
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {profile?.location && (
                    <span className="flex items-center gap-1">
                      <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                      {profile.location}
                    </span>
                  )}
                  {profile?.website && (
                    <a href={profile.website.startsWith('http') ? profile.website : `https://${profile.website}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-primary">
                      <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                      {profile.website.replace(/^https?:\/\//, '')}
                    </a>
                  )}
                  {profile?.twitter && (
                    <a href={`https://x.com/${profile.twitter.replace('@','')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-primary">
                      <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                      @{profile.twitter.replace('@','')}
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Banner */}
            {!isEditing && (
              <div className="mt-5 relative h-28 md:h-40 rounded-2xl overflow-hidden bg-gradient-brand border border-white/10">
                {bannerSrc && <img src={bannerSrc} alt="banner" className="w-full h-full object-cover" />}
              </div>
            )}

            {/* Edit Form */}
            {isEditing && (
              <form onSubmit={handleSaveProfile} className="flex flex-col gap-4 animate-fade-in p-4 md:p-5 bg-background/50 rounded-2xl border border-white/10 mt-5">
                <h3 className="font-bold text-sm md:text-base">Edit your profile</h3>
                {error && <p className="text-sm text-red-400">{error}</p>}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-muted-foreground uppercase mb-2 block">Profile Picture</label>
                    <div className="flex items-center gap-3">
                      {avatarSrc ? (
                        <img src={avatarSrc} alt="" className="w-14 h-14 rounded-full object-cover border-2 border-white/10" />
                      ) : (
                        <div className="w-14 h-14 rounded-full bg-gradient-brand flex items-center justify-center text-white font-bold text-xl">{initial}</div>
                      )}
                      <button type="button" onClick={() => avatarRef.current?.click()} className="bg-secondary px-3 py-1.5 rounded-full text-xs hover:bg-secondary/80 border border-white/10">Change</button>
                      <input ref={avatarRef} type="file" accept="image/*" onChange={handleFile('avatar')} className="hidden" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-muted-foreground uppercase mb-2 block">Banner</label>
                    <div className="flex items-center gap-3">
                      <div className="w-20 h-10 rounded-lg bg-gradient-brand overflow-hidden border-2 border-white/10 flex-shrink-0">
                        {bannerSrc && <img src={bannerSrc} alt="" className="w-full h-full object-cover" />}
                      </div>
                      <button type="button" onClick={() => bannerRef.current?.click()} className="bg-secondary px-3 py-1.5 rounded-full text-xs hover:bg-secondary/80 border border-white/10">Change</button>
                      <input ref={bannerRef} type="file" accept="image/*" onChange={handleFile('banner')} className="hidden" />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-muted-foreground uppercase mb-1 block">Username *</label>
                    <input type="text" required value={editForm.username}
                      onChange={e => setEditForm(p => ({ ...p, username: e.target.value }))}
                      className="w-full bg-secondary/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-muted-foreground uppercase mb-1 block">Display Name</label>
                    <input type="text" value={editForm.displayName}
                      onChange={e => setEditForm(p => ({ ...p, displayName: e.target.value }))}
                      className="w-full bg-secondary/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase mb-1 block">Profession</label>
                  <select value={editForm.profession}
                    onChange={e => setEditForm(p => ({ ...p, profession: e.target.value }))}
                    className="w-full bg-secondary/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                    <option value="">Select your profession…</option>
                    {PROFESSIONS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase mb-1 block">Bio</label>
                  <textarea rows={3} value={editForm.bio}
                    onChange={e => setEditForm(p => ({ ...p, bio: e.target.value }))}
                    placeholder="Tell the world about you..."
                    className="w-full bg-secondary/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-bold text-muted-foreground uppercase mb-1 block">Location</label>
                    <input type="text" value={editForm.location}
                      onChange={e => setEditForm(p => ({ ...p, location: e.target.value }))}
                      placeholder="Earth"
                      className="w-full bg-secondary/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-muted-foreground uppercase mb-1 block">Website</label>
                    <input type="text" value={editForm.website}
                      onChange={e => setEditForm(p => ({ ...p, website: e.target.value }))}
                      placeholder="myworld.app"
                      className="w-full bg-secondary/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-muted-foreground uppercase mb-1 block">X / Twitter</label>
                    <input type="text" value={editForm.twitter}
                      onChange={e => setEditForm(p => ({ ...p, twitter: e.target.value }))}
                      placeholder="@handle"
                      className="w-full bg-secondary/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                </div>

                <div className="flex justify-end gap-3 mt-1">
                  <button type="button" onClick={() => { setIsEditing(false); setAvatarFile(null); setAvatarPreview(null); setBannerFile(null); setBannerPreview(null); }}
                    className="px-5 py-2 rounded-full font-medium text-sm hover:bg-white/10">Cancel</button>
                  <button type="submit" disabled={isSaving}
                    className="bg-primary text-primary-foreground px-5 py-2 rounded-full font-medium text-sm disabled:opacity-50">
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Posts */}
        <h2 className="text-lg md:text-2xl font-bold mb-5 tracking-tight flex items-center gap-3">
          Posts
          <span className="text-sm bg-secondary px-3 py-1 rounded-full text-muted-foreground font-medium">
            {profile?.posts?.length || 0}
          </span>
        </h2>

        <div className="flex flex-col gap-5">
          {!profile?.posts || profile.posts.length === 0 ? (
            <div className="glass-panel rounded-3xl p-12 text-center text-muted-foreground text-sm">
              This creator hasn't posted anything yet.
            </div>
          ) : (
            profile.posts.map(post => (
              <PostCard key={post.id} post={{ ...post, profile }} onLikeUpdate={handleLikeUpdate} />
            ))
          )}
        </div>
      </div>
    </Layout>
  );
}
