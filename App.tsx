import React, { useState, useEffect, useRef } from 'react';
import Header from './components/Header';
import Button from './components/Button';
import { generateImage, editImage, getPromptSuggestions } from './services/geminiService';
import { uploadToDrive, setUploadUrl, fetchDriveFiles } from './services/driveService';

import { ImageHistoryItem, LoadingState } from './types';

const INITIAL_PROMPT = "Ultra-realistic modern luxury house exterior, contemporary architecture, clean sharp lines, large glass windows, natural stone and wood materials, warm ambient lighting, landscaped garden, green lawn, clear blue sky, cinematic wide-angle shot, front elevation view, symmetrical composition, realistic shadows, high detail, photorealistic, 8k quality. Camera: static, eye-level, wide lens. Environment: suburban residential area, empty surroundings, no people, no vehicles. Style: architectural visualization, realistic daylight";

const ASPECT_RATIOS = ["16:9", "4:3", "1:1"];

const ARCHITECTURAL_KEYWORDS = [
    'Modern', 'Minimalist', 'Industrial', 'Brutalist', 'Victorian', 'Gothic', 'Art Deco', 'Scandinavian',
    'Mediterranean', 'Japanese', 'Cyberpunk', 'Steampunk', 'Bauhaus', 'Mid-Century', 'Rustic',
    'Glass', 'Concrete', 'Wood', 'Stone', 'Marble', 'Brick', 'Steel', 'Corten',
    'Sunset', 'Sunrise', 'Night', 'Rain', 'Snow', 'Fog', 'Overcast', 'Blue Hour', 'Golden Hour',
    'Forest', 'Beach', 'Desert', 'Mountain', 'Urban', 'Cliff', 'Lake', 'Garden',
    'Pool', 'Patio', 'Balcony', 'Rooftop', 'Driveway',
    'Cinematic', 'Photorealistic', '8k', 'Volumetric Lighting', 'Atmospheric'
];

const App: React.FC = () => {
    const [currentImage, setCurrentImage] = useState<string | null>(null);

    const [history, setHistory] = useState<ImageHistoryItem[]>([]);
    const [gallery, setGallery] = useState<ImageHistoryItem[]>([]);
    const [prompt, setPrompt] = useState('');
    const [loadingState, setLoadingState] = useState<LoadingState>(LoadingState.IDLE);
    const [error, setError] = useState<string | null>(null);
    const [aspectRatio, setAspectRatio] = useState<string>("16:9");
    const [activeTab, setActiveTab] = useState<'history' | 'gallery' | 'drive'>('history');


    // Suggestion States
    const [autocompleteSuggestions, setAutocompleteSuggestions] = useState<string[]>([]);
    const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
    const [isAiSuggestionsOpen, setIsAiSuggestionsOpen] = useState(false);
    const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);

    // Drive State
    const [saveToDriveEnabled, setSaveToDriveEnabled] = useState(false);
    const [driveFiles, setDriveFiles] = useState<any[]>([]);
    const [isLoadingDrive, setIsLoadingDrive] = useState(false);


    const inputRef = useRef<HTMLInputElement>(null);

    // Load initial image on mount
    useEffect(() => {
        const init = async () => {
            try {
                setLoadingState(LoadingState.GENERATING);
                const url = await generateImage(INITIAL_PROMPT, "16:9");
                setCurrentImage(url);
                addToHistory(url, "Initial Generation", "16:9");
                setLoadingState(LoadingState.IDLE);
            } catch (err: any) {
                setError(err.message || "Failed to generate initial image.");
                setLoadingState(LoadingState.ERROR);
            }
        };
        init();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const addToHistory = (url: string, promptUsed: string, ratio: string) => {
        const newItem: ImageHistoryItem = {
            id: Math.random().toString(36).substr(2, 9),
            url,
            prompt: promptUsed,
            timestamp: Date.now(),
            aspectRatio: ratio
        };
        setHistory(prev => [newItem, ...prev].slice(0, 10)); // Keep last 10
    };

    const handleSaveToGallery = async () => {
        if (!currentImage) return;

        // Save locally
        const newItem: ImageHistoryItem = {
            id: Math.random().toString(36).substr(2, 9),
            url: currentImage,
            prompt: prompt || "Saved Design",
            timestamp: Date.now(),
            aspectRatio: aspectRatio
        };
        setGallery(prev => [newItem, ...prev]);
        setActiveTab('gallery');

        // Save to Drive if enabled
        if (saveToDriveEnabled) {
            let blob: Blob | null = null;
            let filename: string = "";

            try {
                setLoadingState(LoadingState.SAVING);
                setError(null);

                const response = await fetch(currentImage);
                if (!response.ok) throw new Error("Failed to prepare image for upload");
                blob = await response.blob();
                filename = `LuxVision_${Date.now()}.png`;

                await uploadToDrive(blob, filename);
                // Refresh drive files if they were already loaded or if tab is drive
                if (activeTab === 'drive' || driveFiles.length > 0) {
                    handleFetchDriveFiles();
                }


            } catch (err: any) {
                console.error("Drive upload failed:", err);

                if (err.message === "MISSING_UPLOAD_URL") {
                    // Ensure blob and filename are available for retry
                    if (!blob || !filename) {
                        setError("Drive upload failed: Image data unavailable.");
                        setLoadingState(LoadingState.IDLE);
                        return;
                    }

                    const url = window.prompt("Setup Required: Please enter your Google Apps Script Web App URL to enable login-free uploads.");
                    if (url && url.trim().length > 0) {
                        setUploadUrl(url.trim());
                        try {
                            // Retry once with the new URL
                            await uploadToDrive(blob, filename);
                            // Refresh drive files if they were already loaded or if tab is drive
                            if (activeTab === 'drive' || driveFiles.length > 0) {
                                handleFetchDriveFiles();
                            }

                        } catch (retryErr: any) {
                            setError(`Drive upload failed (Retry): ${retryErr.message || 'Unknown error'}`);
                        }
                    } else {
                        setError("Drive upload cancelled: Web App URL is missing.");
                    }
                } else {
                    setError(`Saved to Gallery, but Drive upload failed: ${err.message}`);
                }
            } finally {
                setLoadingState(LoadingState.IDLE);
            }
        }
    };

    const handleAction = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!prompt.trim() || !currentImage) return;

        try {
            setLoadingState(LoadingState.EDITING);
            setError(null);
            setAutocompleteSuggestions([]);
            const editedUrl = await editImage(currentImage, prompt, aspectRatio);
            setCurrentImage(editedUrl);
            addToHistory(editedUrl, prompt, aspectRatio);
            setPrompt('');
            setLoadingState(LoadingState.IDLE);
        } catch (err: any) {
            setError(err.message || "An error occurred during editing.");
            setLoadingState(LoadingState.ERROR);
        }
    };

    const handleAspectRatioChange = async (newRatio: string) => {
        if (loadingState !== LoadingState.IDLE) return;
        if (newRatio === aspectRatio) return;

        setAspectRatio(newRatio);

        try {
            setLoadingState(LoadingState.GENERATING);
            setError(null);
            const url = await generateImage(INITIAL_PROMPT, newRatio);
            setCurrentImage(url);
            addToHistory(url, `Base Reset (${newRatio})`, newRatio);
            setLoadingState(LoadingState.IDLE);
        } catch (err: any) {
            setError(err.message || "Failed to generate image with new aspect ratio.");
            setLoadingState(LoadingState.ERROR);
        }
    };

    const restoreFromItem = (item: any) => {
        setCurrentImage(item.url);
        // If it's a drive item, it might not have an aspect ratio, 
        // but it will have a 'name' instead of 'prompt'
        if (item.aspectRatio) {
            setAspectRatio(item.aspectRatio);
        }
        if (item.prompt) {
            setPrompt(item.prompt);
        } else if (item.name) {
            // If it's a drive file, we can optionally use the name as a prompt hint
            // but usually we just want to view it.
        }
    };

    const handleReset = async () => {
        try {
            setLoadingState(LoadingState.GENERATING);
            setError(null);
            setPrompt('');
            setAutocompleteSuggestions([]);
            setIsAiSuggestionsOpen(false);

            const url = await generateImage(INITIAL_PROMPT, aspectRatio);
            setCurrentImage(url);
            addToHistory(url, "Reset to initial", aspectRatio);
            setLoadingState(LoadingState.IDLE);
        } catch (err: any) {
            setError(err.message || "Failed to reset image.");
            setLoadingState(LoadingState.ERROR);
        }
    };

    const handleDownload = async () => {
        if (!currentImage) return;
        try {
            const response = await fetch(currentImage);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `luxvision-architect-${Date.now()}.png`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (err) {
            const link = document.createElement('a');
            link.href = currentImage;
            link.download = `luxvision-render.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    // --- Suggestion Logic ---

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setPrompt(value);

        const words = value.split(' ');
        const lastWord = words[words.length - 1].toLowerCase();

        if (lastWord.length > 1) {
            const matches = ARCHITECTURAL_KEYWORDS.filter(k =>
                k.toLowerCase().startsWith(lastWord)
            ).slice(0, 5);
            setAutocompleteSuggestions(matches);
        } else {
            setAutocompleteSuggestions([]);
        }
    };

    const applyAutocomplete = (word: string) => {
        const words = prompt.split(' ');
        words.pop();
        const newPrompt = [...words, word].join(' ') + ' ';
        setPrompt(newPrompt);
        setAutocompleteSuggestions([]);
        inputRef.current?.focus();
    };

    const handleGenerateAiSuggestions = async () => {
        if (isLoadingSuggestions) return;
        setIsLoadingSuggestions(true);
        setError(null);
        try {
            const suggestions = await getPromptSuggestions(currentImage);
            setAiSuggestions(suggestions);
            setIsAiSuggestionsOpen(true);
        } catch (err) {
            console.error(err);
            setError("Could not generate suggestions.");
        } finally {
            setIsLoadingSuggestions(false);
        }
    };

    const handleSelectAiPrompt = (newPrompt: string) => {
        setPrompt(newPrompt);
        setIsAiSuggestionsOpen(false);
        inputRef.current?.focus();
    };

    const handleFetchDriveFiles = async () => {
        setIsLoadingDrive(true);
        setError(null);
        try {
            const files = await fetchDriveFiles();
            setDriveFiles(files);
        } catch (err: any) {
            console.error("Failed to fetch drive files:", err);
            if (err.message === "MISSING_UPLOAD_URL") {
                const url = window.prompt("Setup Required: Please enter your Google Apps Script Web App URL to fetch files.");
                if (url && url.trim().length > 0) {
                    setUploadUrl(url.trim());
                    // Retry once
                    try {
                        const files = await fetchDriveFiles();
                        setDriveFiles(files);
                    } catch (retryErr: any) {
                        setError(`Failed to fetch drive files: ${retryErr.message}`);
                    }
                }
            } else {
                setError(`Failed to fetch drive files: ${err.message}`);
            }
        } finally {
            setIsLoadingDrive(false);
        }
    };

    // Fetch Drive files when switching to drive tab
    useEffect(() => {
        if (activeTab === 'drive' && driveFiles.length === 0) {
            handleFetchDriveFiles();
        }
    }, [activeTab]);


    const getAspectRatioClass = (ratio: string) => {
        switch (ratio) {
            case '16:9': return 'aspect-video';
            case '4:3': return 'aspect-[4/3]';
            case '1:1': return 'aspect-square';
            default: return 'aspect-video';
        }
    };

    return (
        <div className="min-h-screen flex flex-col bg-[#0a0a0a]">
            <Header onGalleryClick={() => setActiveTab('gallery')} />


            <main className="flex-1 container mx-auto px-4 md:px-8 py-10 grid grid-cols-1 lg:grid-cols-12 gap-8">

                {/* Left Section: Main Preview */}
                <div className="lg:col-span-8 flex flex-col gap-6">
                    <div className="relative group flex justify-center">
                        {/* Main Canvas / Display */}
                        <div className={`w-full rounded-2xl overflow-hidden glass-panel flex items-center justify-center relative shadow-2xl transition-all duration-500 ${getAspectRatioClass(aspectRatio)}`}>
                            {loadingState !== LoadingState.IDLE && (
                                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm transition-all duration-300">
                                    <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin mb-4"></div>
                                    <p className="text-lg font-medium tracking-wide">
                                        {loadingState === LoadingState.GENERATING ? "Generating..." :
                                            loadingState === LoadingState.SAVING ? "Uploading to Drive..." : "Processing..."}
                                    </p>
                                    <p className="text-zinc-400 text-sm mt-2 animate-pulse">
                                        {loadingState === LoadingState.SAVING ? "Sending to Secure Cloud..." : "This may take a few moments"}
                                    </p>
                                </div>
                            )}

                            {currentImage ? (
                                <>
                                    <img
                                        src={currentImage}
                                        alt="Architectural Preview"
                                        className={`w-full h-full object-cover transition-opacity duration-700 ${loadingState !== LoadingState.IDLE ? 'opacity-40' : 'opacity-100'}`}
                                    />
                                    {/* Floating Download Button on Hover */}
                                    <button
                                        onClick={handleDownload}
                                        className="absolute top-4 right-4 p-3 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 shadow-xl"
                                        title="Download Media"
                                    >
                                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                        </svg>
                                    </button>
                                </>
                            ) : (
                                <div className="text-zinc-600 flex flex-col items-center">
                                    <svg className="w-16 h-16 mb-4 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                    <p>Initializing LuxVision Architect...</p>
                                </div>
                            )}
                        </div>

                        {/* Error Message */}
                        {error && (
                            <div className="mt-4 p-4 bg-red-900/20 border border-red-500/30 rounded-lg text-red-200 text-sm flex items-center gap-3 absolute -bottom-16 w-full z-30">
                                <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                                {error}
                                <button onClick={() => setError(null)} className="ml-auto hover:text-white">Dismiss</button>
                            </div>
                        )}
                    </div>

                    {/* Quick Actions Bar */}
                    <div className="flex flex-wrap items-center gap-3">
                        <span className="text-sm font-semibold text-zinc-500 mr-2">Quick Tweak:</span>
                        {['Golden hour lighting', 'Add infinity pool', 'Modern black wood', 'Rainy atmosphere'].map((preset) => (
                            <button
                                key={preset}
                                disabled={loadingState !== LoadingState.IDLE}
                                onClick={() => { setPrompt(preset); }}
                                className="px-4 py-1.5 text-xs font-medium bg-zinc-900 border border-zinc-800 rounded-full hover:bg-zinc-800 hover:border-zinc-700 transition-all text-zinc-400 hover:text-zinc-200 disabled:opacity-30"
                            >
                                {preset}
                            </button>
                        ))}
                    </div>

                    {/* Edit Control Input */}
                    <form onSubmit={handleAction} className="mt-4 relative z-30">
                        <div className="relative group">
                            <input
                                ref={inputRef}
                                type="text"
                                value={prompt}
                                onChange={handleInputChange}
                                placeholder="Describe your architectural changes..."
                                className="w-full bg-zinc-900 border border-zinc-800 focus:border-white focus:ring-1 focus:ring-white rounded-xl py-5 pl-6 pr-40 outline-none transition-all text-lg placeholder:text-zinc-600 shadow-xl disabled:opacity-50"
                                disabled={loadingState !== LoadingState.IDLE}
                                autoComplete="off"
                            />

                            {/* Autocomplete Dropdown */}
                            {autocompleteSuggestions.length > 0 && (
                                <div className="absolute bottom-full left-6 mb-2 bg-zinc-800 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden min-w-[200px] z-50">
                                    <div className="text-[10px] uppercase text-zinc-500 font-bold px-3 py-2 bg-zinc-900/50">Suggestions</div>
                                    {autocompleteSuggestions.map((suggestion, idx) => (
                                        <button
                                            key={idx}
                                            type="button"
                                            onClick={() => applyAutocomplete(suggestion)}
                                            className="w-full text-left px-4 py-2 text-sm text-zinc-300 hover:bg-white/10 hover:text-white transition-colors"
                                        >
                                            {suggestion}
                                        </button>
                                    ))}
                                </div>
                            )}

                            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-2">
                                <button
                                    type="button"
                                    onClick={handleGenerateAiSuggestions}
                                    disabled={isLoadingSuggestions || loadingState !== LoadingState.IDLE}
                                    className="p-2.5 text-zinc-400 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                                    title="Inspire me with AI prompts"
                                >
                                    {isLoadingSuggestions ? (
                                        <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                    ) : (
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                                        </svg>
                                    )}
                                </button>

                                <Button
                                    type="submit"
                                    isLoading={loadingState === LoadingState.EDITING}
                                    disabled={!prompt.trim() || loadingState !== LoadingState.IDLE}
                                    className="!py-2 !px-5"
                                >
                                    Apply
                                </Button>
                            </div>
                        </div>
                    </form>

                    {/* AI Suggestions Panel */}
                    {isAiSuggestionsOpen && (
                        <div className="glass-panel p-6 rounded-2xl animate-in fade-in slide-in-from-bottom-4 bg-zinc-900/90 border-zinc-700">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
                                    <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                                    AI Generated Ideas
                                </h3>
                                <button onClick={() => setIsAiSuggestionsOpen(false)} className="text-zinc-500 hover:text-white">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                                </button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                {aiSuggestions.map((s, i) => (
                                    <button
                                        key={i}
                                        onClick={() => handleSelectAiPrompt(s)}
                                        className="text-left p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-purple-500/50 transition-all text-xs text-zinc-300 group"
                                    >
                                        <span className="text-purple-400 font-bold mr-2 opacity-50 group-hover:opacity-100">{i + 1}.</span>
                                        {s}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                </div>

                {/* Right Section: Controls & History */}
                <div className="lg:col-span-4 flex flex-col gap-6 h-[calc(100vh-140px)] sticky top-28">

                    {/* Controls Panel */}
                    <div className="glass-panel rounded-2xl p-6 flex flex-col gap-6 shadow-xl flex-shrink-0">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400">Settings</h3>
                        </div>

                        <div className="space-y-4">
                            {/* Aspect Ratio Control */}
                            <div>
                                <label className="text-xs font-semibold text-zinc-500 mb-2 block uppercase">Aspect Ratio</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {ASPECT_RATIOS.map((ratio) => (
                                        <button
                                            key={ratio}
                                            onClick={() => handleAspectRatioChange(ratio)}
                                            disabled={loadingState !== LoadingState.IDLE}
                                            className={`px-2 py-2 text-xs font-medium rounded-lg border transition-all ${aspectRatio === ratio
                                                ? 'bg-white text-black border-white'
                                                : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-600 hover:text-zinc-200'
                                                } ${loadingState !== LoadingState.IDLE ? 'opacity-50 cursor-not-allowed' : ''}`}
                                        >
                                            {ratio}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <Button
                                    variant="primary"
                                    className="w-full text-xs !px-2"
                                    onClick={handleDownload}
                                    disabled={!currentImage || loadingState !== LoadingState.IDLE}
                                >
                                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                    </svg>
                                    Download
                                </Button>

                                <Button
                                    variant="secondary"
                                    className="w-full text-xs !px-2"
                                    onClick={handleSaveToGallery}
                                    disabled={!currentImage || loadingState !== LoadingState.IDLE}
                                >
                                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                                    </svg>
                                    Save to Gallery
                                </Button>
                            </div>

                            {/* Drive Toggle */}
                            <label className="flex items-center gap-3 p-3 rounded-lg border border-zinc-800 hover:bg-zinc-800/50 cursor-pointer group transition-colors">
                                <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${saveToDriveEnabled ? 'bg-blue-600 border-blue-600' : 'border-zinc-600 bg-transparent'}`}>
                                    {saveToDriveEnabled && <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>}
                                </div>
                                <input type="checkbox" className="hidden" checked={saveToDriveEnabled} onChange={(e) => setSaveToDriveEnabled(e.target.checked)} />
                                <span className="text-xs text-zinc-400 group-hover:text-zinc-200">Also sync to Google Drive</span>
                            </label>

                            <Button
                                variant="ghost"
                                className="w-full !justify-start text-xs !py-2 border border-dashed border-zinc-800"
                                onClick={handleReset}
                                disabled={loadingState !== LoadingState.IDLE}
                            >
                                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                Regenerate Original Base
                            </Button>
                        </div>
                    </div>

                    {/* History/Gallery Panel */}
                    <div className="flex-1 flex flex-col gap-4 overflow-hidden bg-zinc-900/30 rounded-2xl border border-white/5 p-4">
                        <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl">
                            <button
                                onClick={() => setActiveTab('history')}
                                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${activeTab === 'history' ? 'bg-zinc-800 text-white shadow' : 'text-zinc-500 hover:text-zinc-300'}`}
                            >
                                History ({history.length})
                            </button>
                            <button
                                onClick={() => setActiveTab('gallery')}
                                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${activeTab === 'gallery' ? 'bg-zinc-800 text-white shadow' : 'text-zinc-500 hover:text-zinc-300'}`}
                            >
                                Gallery ({gallery.length})
                            </button>
                            <button
                                onClick={() => setActiveTab('drive')}
                                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${activeTab === 'drive' ? 'bg-zinc-800 text-white shadow' : 'text-zinc-500 hover:text-zinc-300'}`}
                            >
                                Cloud ({driveFiles.length})
                            </button>
                        </div>



                        <div className="flex flex-col gap-3 overflow-y-auto pr-2 custom-scrollbar flex-1">
                            {activeTab === 'drive' && (
                                <button
                                    onClick={handleFetchDriveFiles}
                                    disabled={isLoadingDrive}
                                    className="mb-2 py-2 px-3 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 rounded-lg text-blue-300 text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                                >
                                    {isLoadingDrive ? (
                                        <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                    ) : (
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                                    )}
                                    Refresh Cloud Storage
                                </button>
                            )}

                            {(activeTab === 'history' ? history : (activeTab === 'gallery' ? gallery : driveFiles)).length > 0 ? (activeTab === 'history' ? history : (activeTab === 'gallery' ? gallery : driveFiles)).map((item) => (
                                <button
                                    key={item.id}
                                    onClick={() => restoreFromItem(item)}
                                    className={`group relative w-full aspect-video rounded-xl overflow-hidden border-2 transition-all flex-shrink-0 text-left 
                    ${currentImage === item.url ? 'border-white' : 'border-zinc-800 opacity-80 hover:opacity-100 hover:border-zinc-500'}
                  `}
                                >
                                    <img src={item.url} alt={item.prompt || item.name} className="w-full h-full object-cover" />


                                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-3 flex flex-col justify-end">
                                        <p className="text-[10px] text-white font-medium line-clamp-1">{item.prompt || item.name}</p>
                                        <div className="flex justify-between items-center mt-1">
                                            <span className="text-[9px] text-zinc-400">
                                                {item.timestamp ? new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Saved'}
                                            </span>
                                            <div className="flex gap-1">
                                                {item.aspectRatio && <span className="text-[9px] bg-white/20 px-1 rounded text-white">{item.aspectRatio}</span>}
                                            </div>
                                        </div>
                                    </div>
                                </button>
                            )) : (
                                <div className="flex-1 flex flex-col items-center justify-center text-zinc-600 italic text-sm text-center px-6">
                                    <div className="w-12 h-12 rounded-full bg-zinc-900 flex items-center justify-center mb-3">
                                        {activeTab === 'history' ? (
                                            <svg className="w-5 h-5 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                        ) : activeTab === 'gallery' ? (
                                            <svg className="w-5 h-5 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path></svg>
                                        ) : (
                                            <svg className="w-5 h-5 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"></path></svg>
                                        )}
                                    </div>
                                    {activeTab === 'history' ? "History is empty. Apply an edit to see versions." :
                                        activeTab === 'gallery' ? "Gallery is empty. Save your favorite designs here." :
                                            "No files found in Google Drive. Sync your first design!"}
                                </div>
                            )}
                        </div>

                    </div>
                </div>
            </main>

            <footer className="py-6 border-t border-zinc-900 text-center mt-auto">
                <p className="text-zinc-600 text-xs">© 2024 LuxVision AI Architect. Built using Google Gemini 2.5.</p>
            </footer>
        </div>
    );
};

export default App;
