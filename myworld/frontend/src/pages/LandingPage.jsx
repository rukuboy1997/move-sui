import React from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout.jsx';

export default function LandingPage() {
  return (
    <Layout>
      <div className="flex-1 flex flex-col items-center justify-center px-4 pt-10 pb-20 md:pt-20">
        
        {/* Hero Section */}
        <div className="max-w-4xl mx-auto text-center flex flex-col items-center gap-8 z-10 relative">
          <div className="absolute inset-0 bg-primary/20 blur-[100px] w-full h-full rounded-full -z-10 pointer-events-none"></div>
          
          <div className="w-24 h-24 md:w-32 md:h-32 mb-4 animate-slide-up">
            <img src="/logo.png" alt="myWorld Logo" className="w-full h-full rounded-3xl object-contain drop-shadow-[0_0_30px_rgba(56,189,248,0.5)]" />
          </div>
          
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight animate-slide-up delay-100">
            Own your <span className="text-gradient">truth.</span><br />
            Share your <span className="text-gradient">world.</span>
          </h1>
          
          <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl animate-slide-up delay-200 leading-relaxed">
            The decentralized social platform where creators and fans connect directly. Uncensorable, permanent, and exclusively yours on the Sui blockchain.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center gap-4 mt-4 animate-slide-up delay-300 w-full sm:w-auto">
            <Link to="/feed" className="w-full sm:w-auto px-8 py-4 bg-primary text-primary-foreground rounded-full font-bold text-lg shadow-[0_0_20px_rgba(56,189,248,0.4)] hover:shadow-[0_0_30px_rgba(56,189,248,0.6)] transition-all hover:scale-105 active:scale-95 text-center">
              Enter myWorld
            </Link>
            <Link to="/explore" className="w-full sm:w-auto px-8 py-4 glass-panel rounded-full font-bold text-lg hover:bg-white/10 transition-all text-center">
              Explore Creators
            </Link>
          </div>
        </div>

        {/* Features Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto mt-32 w-full px-4">
          <div className="glass-panel p-8 rounded-3xl flex flex-col gap-4 relative overflow-hidden group">
            <div className="absolute -right-10 -top-10 w-40 h-40 bg-blue-500/20 blur-3xl rounded-full group-hover:bg-blue-500/30 transition-colors"></div>
            <div className="w-14 h-14 bg-blue-500/20 rounded-2xl flex items-center justify-center text-blue-400 mb-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            </div>
            <h3 className="text-2xl font-bold">Unstoppable</h3>
            <p className="text-muted-foreground leading-relaxed">Your content lives on Walrus decentralized storage. No algorithms hiding your posts, no platforms taking you down.</p>
          </div>
          
          <div className="glass-panel p-8 rounded-3xl flex flex-col gap-4 relative overflow-hidden group">
            <div className="absolute -right-10 -top-10 w-40 h-40 bg-teal-500/20 blur-3xl rounded-full group-hover:bg-teal-500/30 transition-colors"></div>
            <div className="w-14 h-14 bg-teal-500/20 rounded-2xl flex items-center justify-center text-teal-400 mb-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
            </div>
            <h3 className="text-2xl font-bold">On-Chain Truth</h3>
            <p className="text-muted-foreground leading-relaxed">Every post, like, and comment is verified on the Sui blockchain. Cryptographic proof of every interaction.</p>
          </div>
          
          <div className="glass-panel p-8 rounded-3xl flex flex-col gap-4 relative overflow-hidden group">
            <div className="absolute -right-10 -top-10 w-40 h-40 bg-purple-500/20 blur-3xl rounded-full group-hover:bg-purple-500/30 transition-colors"></div>
            <div className="w-14 h-14 bg-purple-500/20 rounded-2xl flex items-center justify-center text-purple-400 mb-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </div>
            <h3 className="text-2xl font-bold">Direct Connection</h3>
            <p className="text-muted-foreground leading-relaxed">Break the fourth wall. Chat directly with your favorite creators or your biggest fans without intermediaries.</p>
          </div>
        </div>

      </div>
    </Layout>
  );
}
