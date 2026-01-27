import React from 'react';

interface HeaderProps {
    onGalleryClick?: () => void;
}

const Header: React.FC<HeaderProps> = ({ onGalleryClick }) => {
    return (
        <header className="py-6 px-8 border-b border-zinc-800 flex items-center justify-between sticky top-0 z-50 bg-[#0a0a0a]/80 backdrop-blur-md">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    </svg>
                </div>
                <div>
                    <h1 className="text-xl font-bold tracking-tight">LuxVision <span className="text-zinc-500 font-normal">AI Architect</span></h1>
                    <p className="text-xs text-zinc-500 uppercase tracking-widest font-medium">Powered by Gemini 2.5</p>
                </div>
            </div>

            <div className="hidden md:flex items-center gap-6">
                <a href="#" className="text-sm font-medium text-zinc-400 hover:text-white transition-colors">Documentation</a>
                <a href="#" className="text-sm font-medium text-zinc-400 hover:text-white transition-colors">Pricing</a>
                <div className="w-px h-4 bg-zinc-800"></div>
                <button
                    onClick={onGalleryClick}
                    className="text-sm font-medium px-4 py-2 border border-zinc-700 rounded-full hover:bg-white hover:text-black transition-all"
                >
                    My Gallery
                </button>
            </div>
        </header>
    );
};

export default Header;
