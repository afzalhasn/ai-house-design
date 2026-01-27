import React from 'react';
import ThemeToggle from './ThemeToggle';

interface HeaderProps {
    onGalleryClick?: () => void;
}

const Header: React.FC<HeaderProps> = ({ onGalleryClick }) => {
    return (
        <header className="py-6 px-8 border-b border-[var(--card-border)] flex items-center justify-between sticky top-0 z-50 bg-[var(--background)]/80 backdrop-blur-md transition-colors duration-300">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[var(--foreground)] rounded-lg flex items-center justify-center transition-colors">
                    <svg className="w-6 h-6 text-[var(--background)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    </svg>
                </div>
                <div>
                    <h1 className="text-xl font-bold tracking-tight text-[var(--foreground)]">LuxVision <span className="text-zinc-500 font-normal">AI Architect</span></h1>
                    <p className="text-xs text-zinc-500 uppercase tracking-widest font-medium">Powered by Gemini 2.5</p>
                </div>
            </div>

            <div className="flex items-center gap-4 md:gap-6">
                <div className="hidden md:flex items-center gap-6 mr-2">
                    <a href="#" className="text-sm font-medium text-zinc-400 hover:text-[var(--foreground)] transition-colors">Documentation</a>
                    <a href="#" className="text-sm font-medium text-zinc-400 hover:text-[var(--foreground)] transition-colors">Pricing</a>
                    <div className="w-px h-4 bg-[var(--card-border)]"></div>
                </div>

                <ThemeToggle />

                <button
                    onClick={onGalleryClick}
                    className="hidden md:block text-sm font-medium px-4 py-2 border border-[var(--card-border)] rounded-full hover:bg-[var(--foreground)] hover:text-[var(--background)] transition-all"
                >
                    My Gallery
                </button>
            </div>
        </header>
    );
};

export default Header;
