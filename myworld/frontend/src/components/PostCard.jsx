import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { likePost, getComments, addComment, truncateAddress } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';

const CONTENT_LIMIT = 200;

export default function PostCard({ post, onLikeUpdate }) {
  const { address: wallet, isAuthenticated, openAuthModal } = useAuth();
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(post.likes || 0);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const requireAuth = async () => {
    if (isAuthenticated) return true;
    openAuthModal('signin');
    return false;
  };

  const handleLike = async () => {
    if (!(await requireAuth())) return;
    try {
      const newStatus = !isLiked;
      setIsLiked(newStatus);
      setLikesCount(prev => newStatus ? prev + 1 : prev - 1);
      const res = await likePost(post.id, wallet);
      setLikesCount(res.likes);
      if (onLikeUpdate) onLikeUpdate(post.id, res.likes);
    } catch (error) {
      console.error('Like failed', error);
      setIsLiked(!isLiked);
      setLikesCount(post.likes);
    }
  };

  const toggleComments = async () => {
    if (!showComments && comments.length === 0 && post.commentCount > 0) {
      setIsLoadingComments(true);
      try {
        const fetchedComments = await getComments(post.id);
        setComments(fetchedComments);
      } catch (error) {
        console.error('Failed to load comments', error);
      } finally {
        setIsLoadingComments(false);
      }
    }
    setShowComments(!showComments);
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    if (!(await requireAuth())) return;
    setIsSubmitting(true);
    try {
      const comment = await addComment(post.id, wallet, newComment.trim());
      setComments(prev => [...prev, comment]);
      setNewComment('');
      if (onLikeUpdate) onLikeUpdate(post.id, undefined, post.commentCount + 1);
    } catch (error) {
      console.error('Failed to add comment', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const timeAgo = post.createdAt ? formatDistanceToNow(new Date(post.createdAt), { addSuffix: true }) : 'just now';
  const avatarUrl = post.profile?.avatarUrl;
  const initial = post.profile?.username
    ? post.profile.username.charAt(0).toUpperCase()
    : truncateAddress(post.owner).charAt(0);

  const content = post.content || '';
  const isTruncatable = content.length > CONTENT_LIMIT;
  const displayContent = isTruncatable && !expanded ? content.slice(0, CONTENT_LIMIT).trimEnd() + '…' : content;

  return (
    <div className="glass-panel rounded-3xl p-4 md:p-6 flex flex-col gap-3 md:gap-4 animate-slide-up overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 md:gap-3">
        <Link to={`/profile/${post.owner}`} className="flex items-center gap-3 group min-w-0">
          {avatarUrl ? (
            <img src={avatarUrl} alt={post.profile?.username || 'avatar'}
              className="w-10 h-10 md:w-12 md:h-12 rounded-full object-cover shadow-lg flex-shrink-0" />
          ) : (
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-gradient-brand flex items-center justify-center text-white font-bold text-base md:text-lg shadow-lg flex-shrink-0">
              {initial}
            </div>
          )}
          <div className="min-w-0">
            <h3 className="font-bold text-sm md:text-base group-hover:text-primary transition-colors truncate">
              {post.profile?.username || truncateAddress(post.owner)}
            </h3>
            <p className="text-xs text-muted-foreground">{timeAgo}</p>
          </div>
        </Link>

        {post.txDigest && (
          <div className="flex flex-wrap gap-1.5 sm:flex-nowrap sm:flex-shrink-0">
            <a href={`https://testnet.suivision.xyz/txblock/${post.txDigest}`} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-secondary text-xs font-medium hover:bg-secondary/80 transition-colors border border-white/5"
              title="View on Sui Explorer">
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
              On-Chain
            </a>
            {post.blobUrl && (
              <a href={post.blobUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-secondary text-xs font-medium hover:bg-secondary/80 transition-colors border border-white/5"
                title="View on Walrus Storage">
                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-teal-400"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                Walrus
              </a>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-col gap-2 min-w-0">
        <h2 className="text-base md:text-xl font-bold text-foreground leading-tight break-words">{post.title}</h2>
        <p className="text-muted-foreground whitespace-pre-wrap text-sm md:text-base leading-relaxed break-words">
          {displayContent}
        </p>
        {isTruncatable && (
          <button onClick={() => setExpanded(e => !e)} className="text-xs text-primary font-semibold hover:underline self-start">
            {expanded ? 'Show less' : 'Read more'}
          </button>
        )}

        {post.mediaUrl && post.mediaType === 'image' && (
          <a href={post.mediaUrl} target="_blank" rel="noopener noreferrer" className="block rounded-2xl overflow-hidden border border-white/5 bg-black/20 mt-1">
            <img src={post.mediaUrl} alt={post.title} className="w-full max-h-[400px] md:max-h-[600px] object-contain" loading="lazy" />
          </a>
        )}
        {post.mediaUrl && post.mediaType === 'video' && (
          <video src={post.mediaUrl} controls className="w-full max-h-[400px] md:max-h-[600px] rounded-2xl border border-white/5 bg-black mt-1" />
        )}
      </div>

      {/* Actions */}
      <div className="pt-3 mt-1 border-t border-white/5 flex items-center gap-5">
        <button onClick={handleLike}
          className={`flex items-center gap-1.5 transition-all hover:scale-105 active:scale-95 ${isLiked ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill={isLiked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
          </svg>
          <span className="font-medium text-sm">{likesCount}</span>
        </button>

        <button onClick={toggleComments}
          className={`flex items-center gap-1.5 transition-all hover:scale-105 active:scale-95 ${showComments ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 21 1.9-5.7a8.5 8.5 0 1 1 3.8 3.8z"/></svg>
          <span className="font-medium text-sm">{post.commentCount || 0}</span>
        </button>
      </div>

      {/* Comments Section */}
      {showComments && (
        <div className="pt-3 border-t border-white/5 flex flex-col gap-3 animate-fade-in">
          {isLoadingComments ? (
            <div className="flex justify-center p-4">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {comments.length > 0 ? comments.map(comment => {
                const cAvatar = comment.profile?.avatarUrl;
                const cInitial = comment.profile?.username
                  ? comment.profile.username.charAt(0).toUpperCase()
                  : truncateAddress(comment.owner).charAt(0);
                return (
                  <div key={comment.id} className="flex gap-3 bg-white/5 p-3 rounded-2xl">
                    {cAvatar ? (
                      <img src={cAvatar} alt="" className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-secondary flex-shrink-0 flex items-center justify-center font-bold text-xs">{cInitial}</div>
                    )}
                    <div className="flex flex-col flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2 flex-wrap">
                        <Link to={`/profile/${comment.owner}`} className="font-bold text-xs hover:text-primary transition-colors truncate">
                          {comment.profile?.username || truncateAddress(comment.owner)}
                        </Link>
                        <span className="text-[10px] text-muted-foreground">
                          {comment.createdAt ? formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true }) : 'just now'}
                        </span>
                      </div>
                      <p className="text-xs md:text-sm mt-0.5 break-words">{comment.content}</p>
                    </div>
                  </div>
                );
              }) : (
                <p className="text-sm text-muted-foreground text-center py-2">No comments yet. Be the first!</p>
              )}
            </div>
          )}

          <form onSubmit={handleAddComment} className="flex gap-2 mt-1">
            <input type="text" value={newComment} onChange={(e) => setNewComment(e.target.value)}
              placeholder="Add a comment..."
              className="flex-1 min-w-0 bg-secondary/50 border border-white/10 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              disabled={isSubmitting} />
            <button type="submit" disabled={!newComment.trim() || isSubmitting}
              className="bg-primary text-primary-foreground px-4 py-2 rounded-full text-sm font-bold disabled:opacity-50 transition-colors flex-shrink-0">
              Post
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
