'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Header from '@/components/Header';
import Button from '@/components/Button';
import { generateImage, editImage, getPromptSuggestions } from '@/services/geminiService';
import { uploadToDrive, setUploadUrl, fetchDriveFiles } from '@/services/driveService';
import { publishToInstagram, generateAiCaption } from '@/services/socialService';
import { ImageHistoryItem, LoadingState } from '@/types';

const INITIAL_PROMPT = "Ultra-realistic modern luxury house exterior, contemporary architecture, clean sharp lines, large glass windows, natural stone and wood materials, warm ambient lighting, landscaped garden, green lawn, clear blue sky, cinematic wide-angle shot, front elevation view, symmetrical composition, realistic shadows, high detail, photorealistic, 8k quality. Camera: static, eye-level, wide lens. Environment: suburban residential area, empty surroundings, no people, no vehicles. Style: architectural visualization, realistic daylight";

const ASPECT_RATIO_OPTIONS = [
  { label: "Wide (16:9)", value: "16:9", description: "Best for Facebook/Desktop" },
  { label: "Square (1:1)", value: "1:1", description: "Best for Instagram Feed" },
  { label: "Portrait (4:5)", value: "4:5", description: "Best for Instagram Posts" },
  { label: "Story (9:16)", value: "9:16", description: "Best for Stories/Reels" }
];

const ARCHITECTURAL_KEYWORDS = [
  'Modern', 'Minimalist', 'Industrial', 'Brutalist', 'Victorian', 'Gothic', 'Art Deco', 'Scandinavian',
  'Mediterranean', 'Japanese', 'Cyberpunk', 'Steampunk', 'Bauhaus', 'Mid-Century', 'Rustic',
  'Glass', 'Concrete', 'Wood', 'Stone', 'Marble', 'Brick', 'Steel', 'Corten',
  'Sunset', 'Sunrise', 'Night', 'Rain', 'Snow', 'Fog', 'Overcast', 'Blue Hour', 'Golden Hour',
  'Forest', 'Beach', 'Desert', 'Mountain', 'Urban', 'Cliff', 'Lake', 'Garden',
  'Pool', 'Patio', 'Balcony', 'Rooftop', 'Driveway',
  'Cinematic', 'Photorealistic', '8k', 'Volumetric Lighting', 'Atmospheric'
];

const SIGNATURE_COLORS = [
  '#FF6B6B', '#4ECDC4', '#FF9F1C', '#2EC4B6', '#E71D36',
  '#3b82f6', '#8A2BE2', '#00FF7F', '#FF1493', '#0070f3'
];

export default function Home() {
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [history, setHistory] = useState<ImageHistoryItem[]>([]);
  const [gallery, setGallery] = useState<ImageHistoryItem[]>([]);
  const [prompt, setPrompt] = useState('');
  const [loadingState, setLoadingState] = useState<LoadingState>(LoadingState.IDLE);
  const [error, setError] = useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState<string>("9:16");
  const [activeTab, setActiveTab] = useState<'history' | 'gallery' | 'drive'>('history');

  // Suggestion States
  const [autocompleteSuggestions, setAutocompleteSuggestions] = useState<string[]>([]);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [isAiSuggestionsOpen, setIsAiSuggestionsOpen] = useState(false);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);

  // Drive State
  const [saveToDriveEnabled, setSaveToDriveEnabled] = useState(false);
  const [driveFiles, setDriveFiles] = useState<ImageHistoryItem[]>([]);
  const [isLoadingDrive, setIsLoadingDrive] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareCaption, setShareCaption] = useState('');
  const [igContentType, setIgContentType] = useState<'IMAGE' | 'CAROUSEL' | 'REEL' | 'STORY'>('IMAGE');
  const [selectedMediaUrls, setSelectedMediaUrls] = useState<string[]>([]);
  const [thumbOffset, setThumbOffset] = useState(0);
  const [isPublishing, setIsPublishing] = useState({ ig: false, fb: false });
  const [isGeneratingCaption, setIsGeneratingCaption] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  // Initial load
  useEffect(() => {
    // 1. Set random signature color
    const randomColor = SIGNATURE_COLORS[Math.floor(Math.random() * SIGNATURE_COLORS.length)];
    document.documentElement.style.setProperty('--accent', randomColor);

    // 2. Initialize first image
    const init = async () => {
      try {
        setLoadingState(LoadingState.GENERATING);
        const url = await generateImage(INITIAL_PROMPT, "9:16");
        setCurrentImage(url);
        addToHistory(url, "Initial Generation", "9:16");
        setLoadingState(LoadingState.IDLE);
      } catch (err: unknown) {
        let errorMsg = err instanceof Error ? err.message : "Failed to generate initial image.";

        // Handle specific Leaked API Key error
        if (errorMsg.includes("reported as leaked") || (typeof err === 'string' && err.includes("reported as leaked"))) {
          errorMsg = "🛑 CRITICAL: Your Google API Key has been blocked because it was leaked to GitHub. PLEASE GENERATE A NEW KEY at https://aistudio.google.com/app/apikey and update your .env file.";
        }

        setError(errorMsg);
        setLoadingState(LoadingState.ERROR);
      }
    };
    init();
  }, []);

  const addToHistory = (url: string, promptUsed: string, ratio: string) => {
    const newItem: ImageHistoryItem = {
      id: Math.random().toString(36).substr(2, 9),
      url,
      prompt: promptUsed,
      timestamp: Date.now(),
      aspectRatio: ratio
    };
    setHistory(prev => [newItem, ...prev].slice(0, 10));
  };

  const handleSaveToGallery = async () => {
    if (!currentImage) return;

    let finalUrl = currentImage;

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

        const driveUrl = await uploadToDrive(blob, filename);
        if (driveUrl && driveUrl.startsWith('http')) {
          finalUrl = driveUrl;
        }

        if (activeTab === 'drive' || driveFiles.length > 0) {
          handleFetchDriveFiles();
        }
      } catch (err: unknown) {
        const error = err as Error;
        console.error("Drive upload failed:", error);
        if (error.message === "MISSING_UPLOAD_URL") {
          const url = window.prompt("Setup Required: Please enter your Google Apps Script Web App URL.");
          if (url && url.trim().length > 0) {
            setUploadUrl(url.trim());
            try {
              if (blob) {
                const driveUrl = await uploadToDrive(blob, filename);
                if (driveUrl && driveUrl.startsWith('http')) {
                  finalUrl = driveUrl;
                }
                if (activeTab === 'drive' || driveFiles.length > 0) {
                  handleFetchDriveFiles();
                }
              }
            } catch (retryErr: unknown) {
              const retryError = retryErr as Error;
              setError(`Drive upload failed (Retry): ${retryError.message}`);
            }
          }
        } else {
          setError(`Saved to Gallery, but Drive upload failed: ${error.message}`);
        }
      } finally {
        setLoadingState(LoadingState.IDLE);
      }
    }

    const newItem: ImageHistoryItem = {
      id: `gal_${Date.now()}`,
      url: finalUrl,
      prompt: prompt || "Saved Design",
      timestamp: Date.now(),
      aspectRatio: aspectRatio
    };
    setGallery(prev => [newItem, ...prev]);
    setActiveTab('gallery');
  };

  const handleShare = async (platform: 'instagram' | 'facebook' | 'both') => {
    if (!currentImage) return;

    let finalUrls = [...selectedMediaUrls];
    if (finalUrls.length === 0) finalUrls = [currentImage];

    setLoadingState(LoadingState.PUBLISHING);
    const caption = shareCaption || prompt || "Magnificent architectural design created with LuxVision AI.";

    try {
      // Logic for public links if needed (Instagram requires public URLs)
      const processedUrls = await Promise.all(finalUrls.map(async (url) => {
        let targetUrl = url;

        // 1. Convert Data URLs to public Drive links (Required by Instagram)
        if (url.startsWith('data:')) {
          console.log("[IG] Hosting local image on Drive for publishing...");
          const response = await fetch(url);
          const blob = await response.blob();
          const filename = `LuxVision_Share_${Date.now()}.png`;
          targetUrl = await uploadToDrive(blob, filename);
        } else {
          console.log("[IG] Using existing cloud URL for publishing:", url);
        }

        // 2. Fix Google Drive 'view' links to be direct 'uc' links
        if (targetUrl.includes('drive.google.com') && targetUrl.includes('/file/d/')) {
          const fileId = targetUrl.split('/file/d/')[1].split('/')[0];
          targetUrl = `https://drive.google.com/uc?id=${fileId}&export=download`;
        }

        // 3. Add extension hint for Instagram's crawler on lh3/googleusercontent links
        // Meta crawlers often fail if they don't see an image extension
        if (targetUrl.includes('googleusercontent.com') && !targetUrl.includes('.')) {
          targetUrl = `${targetUrl}?=.png`;
        } else if (targetUrl.includes('drive.google.com') && !targetUrl.includes('&ext=')) {
          targetUrl = `${targetUrl}&ext=.png`;
        }

        return targetUrl;
      }));

      if (platform === 'instagram' || platform === 'both') {
        setIsPublishing(p => ({ ...p, ig: true }));
        const res = await publishToInstagram({
          contentType: igContentType,
          mediaUrls: processedUrls,
          caption: caption,
          thumbOffset: igContentType === 'REEL' ? thumbOffset : undefined
        });

        if (!res.success) throw new Error(`Instagram: ${res.error}`);

        // Optimization: If we just uploaded a local image to Drive for sharing,
        // update the main preview to use that Cloud URL now.
        if (processedUrls.length === 1 && !currentImage?.startsWith('http')) {
          setCurrentImage(processedUrls[0]);
        }
      }

      alert("Successfully published!");
      setIsShareModalOpen(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsPublishing({ ig: false, fb: false });
      setLoadingState(LoadingState.IDLE);
    }
  };

  const handleGenerateCaption = async () => {
    if (!currentImage || isGeneratingCaption) return;
    setIsGeneratingCaption(true);
    try {
      let base64 = "";
      if (currentImage.startsWith('data:')) {
        base64 = currentImage.split(',')[1];
      } else {
        const res = await fetch(currentImage);
        const blob = await res.blob();
        base64 = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
          reader.readAsDataURL(blob);
        });
      }

      const caption = await generateAiCaption(base64, prompt);
      setShareCaption(caption);
    } catch (err) {
      console.error(err);
      alert("Failed to generate AI caption.");
    } finally {
      setIsGeneratingCaption(false);
    }
  };


  const handleAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || !currentImage) return;

    try {
      setLoadingState(LoadingState.EDITING);
      setError(null);
      setAutocompleteSuggestions([]);
      const framingPrompt = `${prompt} [Framing: optimized for ${aspectRatio} aspect ratio, social media ${ASPECT_RATIO_OPTIONS.find(o => o.value === aspectRatio)?.label || ''} composition]`;
      const editedUrl = await editImage(currentImage, framingPrompt, aspectRatio);
      setCurrentImage(editedUrl);
      addToHistory(editedUrl, prompt, aspectRatio);
      setPrompt('');
      setLoadingState(LoadingState.IDLE);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred during editing.");
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
      const framingPrompt = `${INITIAL_PROMPT} [Framing: optimized for ${newRatio} aspect ratio, social media ${ASPECT_RATIO_OPTIONS.find(o => o.value === newRatio)?.label || ''} composition]`;
      const url = await generateImage(framingPrompt, newRatio);
      setCurrentImage(url);
      addToHistory(url, `Base Reset (${newRatio})`, newRatio);
      setLoadingState(LoadingState.IDLE);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to generate image.");
      setLoadingState(LoadingState.ERROR);
    }
  };

  const restoreFromItem = (item: ImageHistoryItem) => {
    setCurrentImage(item.url);
    if (item.aspectRatio) setAspectRatio(item.aspectRatio);
    if (item.prompt) setPrompt(item.prompt);
  };

  const handleReset = async () => {
    try {
      setLoadingState(LoadingState.GENERATING);
      setError(null);
      setPrompt('');
      setAutocompleteSuggestions([]);
      const url = await generateImage(INITIAL_PROMPT, aspectRatio);
      setCurrentImage(url);
      addToHistory(url, "Reset to initial", aspectRatio);
      setLoadingState(LoadingState.IDLE);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to reset image.");
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
    } catch {
      const link = document.createElement('a');
      link.href = currentImage;
      link.download = `luxvision-render.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

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
    setPrompt([...words, word].join(' ') + ' ');
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
    } catch {
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
    } catch (err: unknown) {
      const error = err as Error;
      console.error(error);
      if (error.message === "MISSING_UPLOAD_URL") {
        const url = window.prompt("Enter Google Apps Script URL.");
        if (url && url.trim().length > 0) {
          setUploadUrl(url.trim());
          const files = await fetchDriveFiles();
          setDriveFiles(files);
        }
      } else {
        setError(`Failed drive fetch: ${error.message}`);
      }
    } finally {
      setIsLoadingDrive(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'drive' && driveFiles.length === 0) {
      handleFetchDriveFiles();
    }
  }, [activeTab, driveFiles.length]);

  const getAspectRatioClass = (ratio: string) => {
    switch (ratio) {
      case '16:9': return 'aspect-video';
      case '4:3': return 'aspect-[4/3]';
      case '1:1': return 'aspect-square';
      case '4:5': return 'aspect-[4/5]';
      case '9:16': return 'aspect-[9/16]';
      default: return 'aspect-video';
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[var(--background)] transition-colors duration-300">
      <Header onGalleryClick={() => setActiveTab('gallery')} />

      <main className="flex-1 container mx-auto px-4 md:px-8 py-10 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Section: Main Preview */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          <div className="relative group flex justify-center">
            <div className={`w-full max-h-[75vh] rounded-2xl overflow-hidden glass-panel flex items-center justify-center relative shadow-2xl transition-all duration-500 ${getAspectRatioClass(aspectRatio)}`}>
              {loadingState !== LoadingState.IDLE && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm transition-all duration-300">
                  <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin mb-4"></div>
                  <p className="text-lg font-medium tracking-wide text-white">
                    {loadingState === LoadingState.GENERATING ? "Generating..." :
                      loadingState === LoadingState.SAVING ? "Uploading to Drive..." :
                        loadingState === LoadingState.PUBLISHING ? "Publishing to Social..." : "Processing..."}
                  </p>
                </div>
              )}

              {currentImage ? (
                <>
                  <Image
                    src={currentImage}
                    alt="Architectural Preview"
                    fill
                    unoptimized
                    className={`object-cover transition-opacity duration-700 ${loadingState !== LoadingState.IDLE ? 'opacity-40' : 'opacity-100'}`}
                  />
                  <button
                    onClick={handleDownload}
                    className="absolute top-4 right-4 p-3 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 shadow-xl"
                    title="Download Media"
                  >
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </button>
                  <button
                    onClick={() => {
                      setShareCaption(prompt || "");
                      setIsShareModalOpen(true);
                    }}
                    className="absolute top-4 left-4 p-3 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 shadow-xl"
                    title="Share to Social"
                  >
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                    </svg>
                  </button>
                </>
              ) : (
                <div className="text-zinc-500 flex flex-col items-center justify-center p-12 text-center">
                  <div className="w-16 h-16 mb-4 relative">
                    <div className="absolute inset-0 bg-[var(--accent)] opacity-20 blur-2xl rounded-full animate-pulse" />
                    <svg className="w-full h-full relative z-10 opacity-20 text-[var(--accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <p className="text-sm tracking-widest uppercase font-black opacity-40">Initializing LuxVision Architect...</p>
                </div>
              )}
            </div>

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
                onClick={() => { setPrompt(preset); }}
                className="px-4 py-1.5 text-xs font-medium bg-[var(--card-bg)] border border-[var(--card-border)] rounded-full hover:border-[var(--accent)] transition-all text-zinc-500 hover:text-[var(--foreground)] disabled:opacity-30"
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
                className="w-full bg-[var(--card-bg)] border border-[var(--card-border)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] rounded-xl py-5 pl-6 pr-40 outline-none transition-all text-lg placeholder:text-zinc-500 shadow-xl disabled:opacity-50 text-[var(--foreground)]"
                disabled={loadingState !== LoadingState.IDLE}
                autoComplete="off"
              />

              {autocompleteSuggestions.length > 0 && (
                <div className="absolute bottom-full left-6 mb-2 bg-[var(--glass-bg)] border border-[var(--card-border)] rounded-xl shadow-2xl overflow-hidden min-w-[200px] z-50 backdrop-blur-xl">
                  {autocompleteSuggestions.map((suggestion, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => applyAutocomplete(suggestion)}
                      className="w-full text-left px-4 py-2 text-sm text-zinc-500 hover:bg-[var(--accent)]/10 hover:text-[var(--foreground)] transition-colors"
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
                  className="p-2.5 text-zinc-500 hover:text-[var(--foreground)] hover:bg-[var(--card-bg)] rounded-lg transition-all"
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

          {isAiSuggestionsOpen && (
            <div className="glass-panel p-6 rounded-2xl animate-in fade-in slide-in-from-bottom-4 shadow-2xl">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-2">AI Generated Ideas</h3>
                <button onClick={() => setIsAiSuggestionsOpen(false)} className="text-zinc-400 hover:text-[var(--foreground)]">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                {aiSuggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => handleSelectAiPrompt(s)}
                    className="text-left p-3 rounded-xl bg-[var(--card-bg)] border border-[var(--card-border)] hover:border-[var(--accent)] transition-all text-xs text-zinc-500 hover:text-[var(--foreground)] group"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Section: Controls & History */}
        <div className="lg:col-span-4 flex flex-col gap-6 h-[calc(100vh-140px)] sticky top-28">
          <div className="glass-panel rounded-2xl p-6 flex flex-col gap-6 shadow-xl flex-shrink-0">
            <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400">Settings</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-zinc-500 mb-2 block uppercase">Aspect Ratio</label>
                <div className="grid grid-cols-2 gap-2">
                  {ASPECT_RATIO_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => handleAspectRatioChange(option.value)}
                      title={option.description}
                      className={`px-2 py-3 text-[10px] font-bold uppercase tracking-tighter rounded-lg border transition-all flex flex-col items-center justify-center gap-1 ${aspectRatio === option.value
                        ? 'bg-[var(--foreground)] text-[var(--background)] border-[var(--foreground)]'
                        : 'bg-[var(--card-bg)] text-zinc-500 border-[var(--card-border)] hover:border-[var(--accent)]'
                        }`}
                    >
                      <span>{option.label.split(' ')[0]}</span>
                      <span className="opacity-60 text-[8px]">{option.value}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="primary"
                  className="w-full text-xs !px-2"
                  onClick={handleDownload}
                  disabled={!currentImage}
                >
                  Download
                </Button>
                <Button
                  variant="secondary"
                  className="w-full text-xs !px-2"
                  onClick={handleSaveToGallery}
                  disabled={!currentImage}
                >
                  Save to Gallery
                </Button>
              </div>

              <label className="flex items-center gap-3 p-3 rounded-lg border border-[var(--card-border)] hover:bg-[var(--card-bg)] cursor-pointer transition-colors">
                <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${saveToDriveEnabled ? 'bg-[var(--accent)] border-[var(--accent)]' : 'border-zinc-400 bg-transparent'}`}>
                  {saveToDriveEnabled && <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>}
                </div>
                <input type="checkbox" className="hidden" checked={saveToDriveEnabled} onChange={(e) => setSaveToDriveEnabled(e.target.checked)} />
                <span className="text-xs text-zinc-500">Sync to Google Drive</span>
              </label>

              <Button
                variant="ghost"
                className="w-full !justify-start text-xs !py-2 border border-dashed border-[var(--card-border)]"
                onClick={handleReset}
              >
                Regenerate Original Base
              </Button>
            </div>
          </div>

          <div className="flex-1 flex flex-col gap-4 overflow-hidden glass-panel p-4 rounded-2xl">
            <div className="flex items-center gap-1 bg-[var(--card-bg)] p-1 rounded-xl">
              <button onClick={() => setActiveTab('history')} className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${activeTab === 'history' ? 'bg-[var(--background)] text-[var(--foreground)] shadow' : 'text-zinc-500 hover:text-[var(--foreground)]'}`}>History ({history.length})</button>
              <button onClick={() => setActiveTab('gallery')} className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${activeTab === 'gallery' ? 'bg-[var(--background)] text-[var(--foreground)] shadow' : 'text-zinc-500 hover:text-[var(--foreground)]'}`}>Gallery ({gallery.length})</button>
              <button onClick={() => setActiveTab('drive')} className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${activeTab === 'drive' ? 'bg-[var(--background)] text-[var(--foreground)] shadow' : 'text-zinc-500 hover:text-[var(--foreground)]'}`}>Cloud ({driveFiles.length})</button>
            </div>

            <div className="flex flex-col gap-3 overflow-y-auto pr-2 custom-scrollbar flex-1">
              {activeTab === 'drive' && (
                <button onClick={handleFetchDriveFiles} disabled={isLoadingDrive} className="mb-2 py-2 px-3 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 rounded-lg text-blue-300 text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-50">
                  {isLoadingDrive ? "Loading..." : "Refresh Cloud Storage"}
                </button>
              )}
              {(activeTab === 'history' ? history : (activeTab === 'gallery' ? gallery : driveFiles)).map((item) => (
                <button
                  key={item.id}
                  onClick={() => restoreFromItem(item)}
                  className={`group relative w-full aspect-video rounded-xl overflow-hidden border-2 transition-all flex-shrink-0 text-left 
                    ${currentImage === item.url ? 'border-[var(--accent)]' : 'border-[var(--card-border)] opacity-80 hover:opacity-100 hover:border-zinc-400'}
                  `}
                >
                  <div className="w-full h-full bg-[var(--card-bg)] animate-pulse absolute inset-0 -z-10" />
                  <Image
                    src={item.url}
                    alt={item.prompt || item.name || "Gallery image"}
                    fill
                    unoptimized
                    className="object-cover transition-opacity duration-300"
                    loading="lazy"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = 'https://via.placeholder.com/800x450/1a1a1a/555555?text=Image+Unavailable';
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-3 flex flex-col justify-end">
                    <p className="text-[10px] text-white font-medium line-clamp-1">{item.prompt || item.name}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </main>

      <footer className="py-6 border-t border-[var(--card-border)] text-center mt-auto">
        <p className="text-zinc-500 text-xs">© 2024 LuxVision AI Architect. Built using Google Gemini.</p>
      </footer>

      {/* Share Modal */}
      {isShareModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl transition-all">
          <div className="bg-[var(--background)] border border-[var(--card-border)] rounded-[2.5rem] w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.5)] animate-in fade-in zoom-in-95 duration-300 flex flex-col md:flex-row">

            {/* Left: Preview & Selection */}
            <div className="md:w-1/2 p-8 bg-[var(--card-bg)]/50 border-r border-[var(--card-border)] overflow-y-auto">
              <h3 className="text-sm font-black uppercase tracking-[0.2em] text-zinc-500 mb-6">Media Preview</h3>
              <div className="space-y-6">
                <div className="aspect-[4/5] rounded-3xl overflow-hidden shadow-2xl relative group">
                  <Image src={currentImage!} fill unoptimized className="object-cover" alt="To Publish" />
                  <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors" />
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold uppercase text-zinc-400">Add to Carousel (Optional)</label>
                    <span className="text-[10px] text-[var(--accent)] font-bold">{selectedMediaUrls.length} selected</span>
                  </div>
                  <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                    {gallery.map(item => (
                      <button
                        key={item.id}
                        onClick={() => {
                          setSelectedMediaUrls(prev =>
                            prev.includes(item.url) ? prev.filter(u => u !== item.url) : [...prev, item.url]
                          );
                          if (igContentType !== 'CAROUSEL') setIgContentType('CAROUSEL');
                        }}
                        className={`w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 border-2 transition-all ${selectedMediaUrls.includes(item.url) ? 'border-[var(--accent)] scale-90' : 'border-transparent opacity-60 hover:opacity-100'}`}
                      >
                        <Image src={item.url} fill unoptimized className="object-cover" alt="Gallery item" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Options */}
            <div className="md:w-1/2 p-8 overflow-y-auto">
              <div className="flex justify-between items-center mb-10">
                <h3 className="text-2xl font-black tracking-tight">Post to Instagram</h3>
                <button onClick={() => setIsShareModalOpen(false)} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
              </div>

              <div className="space-y-8">
                {/* Format Selection */}
                <div className="space-y-4">
                  <label className="text-xs font-black uppercase tracking-widest text-zinc-500">Select Post Format</label>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { id: 'IMAGE', icon: '📸', label: 'Feed Post', desc: 'Standard image post' },
                      { id: 'CAROUSEL', icon: '🎞️', label: 'Carousel', desc: 'Multiple items' },
                      { id: 'REEL', icon: '🎬', label: 'Reel', desc: 'High reach video' },
                      { id: 'STORY', icon: '⚡', label: 'Story', desc: '24hr visibility' }
                    ].map(type => (
                      <button
                        key={type.id}
                        onClick={() => setIgContentType(type.id as 'IMAGE' | 'CAROUSEL' | 'REEL' | 'STORY')}
                        className={`p-4 rounded-3xl border-2 text-left transition-all ${igContentType === type.id
                          ? 'border-[var(--accent)] bg-[var(--accent)]/5'
                          : 'border-[var(--card-border)] hover:border-zinc-400 opacity-60'}`}
                      >
                        <span className="text-2xl mb-2 block">{type.icon}</span>
                        <div className="font-bold text-sm">{type.label}</div>
                        <div className="text-[10px] text-zinc-500">{type.desc}</div>
                        {((aspectRatio === '9:16' && (type.id === 'REEL' || type.id === 'STORY')) ||
                          (aspectRatio === '1:1' && type.id === 'IMAGE')) && (
                            <span className="inline-block mt-2 px-2 py-0.5 bg-[var(--accent)] text-white text-[8px] font-black rounded-full uppercase">Recommended</span>
                          )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Reel Specifics */}
                {igContentType === 'REEL' && (
                  <div className="p-6 bg-zinc-100 dark:bg-zinc-900 rounded-[2rem] space-y-4 animate-in slide-in-from-top-2">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-black uppercase text-zinc-500">Thumb Offset (ms)</label>
                      <span className="text-sm font-mono font-bold">{thumbOffset}ms</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="5000"
                      step="100"
                      value={thumbOffset}
                      onChange={(e) => setThumbOffset(parseInt(e.target.value))}
                      className="w-full accent-[var(--accent)]"
                    />
                  </div>
                )}

                {/* Caption */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-black uppercase tracking-widest text-zinc-500">Caption</label>
                    <button
                      onClick={handleGenerateCaption}
                      disabled={isGeneratingCaption}
                      className="text-[10px] font-black uppercase tracking-widest text-[var(--accent)] hover:opacity-80 flex items-center gap-1.5 transition-all disabled:opacity-30"
                    >
                      {isGeneratingCaption ? (
                        <span className="flex items-center gap-1">
                          <div className="w-2 h-2 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin"></div>
                          Writing...
                        </span>
                      ) : (
                        <>
                          <span>✨ Generate AI Caption</span>
                        </>
                      )}
                    </button>
                  </div>
                  <textarea
                    value={shareCaption}
                    onChange={(e) => setShareCaption(e.target.value)}
                    className="w-full bg-[var(--card-bg)] border-2 border-[var(--card-border)] rounded-3xl p-5 text-sm min-h-[120px] outline-none focus:border-[var(--accent)] transition-all resize-none shadow-inner"
                    placeholder="Capture the vibe of this design..."
                  />
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-3 pt-4">
                  <button
                    onClick={() => handleShare('instagram')}
                    disabled={loadingState === LoadingState.PUBLISHING}
                    className="group flex items-center justify-center gap-4 py-5 bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 hover:from-purple-500 hover:to-orange-400 rounded-3xl font-black text-white transition-all shadow-xl hover:shadow-2xl active:scale-[0.98] disabled:opacity-50"
                  >
                    <span>{isPublishing.ig ? "Processing..." : `Share as ${igContentType.charAt(0) + igContentType.slice(1).toLowerCase()}`}</span>
                    <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
                  </button>
                  <p className="text-[10px] text-center text-zinc-500/60 uppercase font-black tracking-widest">Powered by LuxVision Social Engine</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
