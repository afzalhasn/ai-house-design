# 🏛️ LuxVision AI Architect

[![Framework: Next.js](https://img.shields.io/badge/Framework-Next.js_16-000000?style=flat-square&logo=nextdotjs)](https://nextjs.org/)
[![Language: TypeScript](https://img.shields.io/badge/Language-TypeScript-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![AI: Google Gemini](https://img.shields.io/badge/AI-Google_Gemini-4285F4?style=flat-square&logo=google)](https://deepmind.google/technologies/gemini/)
[![Social: Instagram](https://img.shields.io/badge/Social-Instagram-E4405F?style=flat-square&logo=instagram)](https://developers.facebook.com/docs/instagram-api/)

LuxVision AI Architect is a premium architectural visualization platform that empowers users to generate, edit, and publish high-end luxury house designs using **Google Gemini AI**. With integrated cloud storage and one-click social publishing, it's the ultimate toolkit for digital architects.

---

## ✨ Key Features

- **🚀 AI Generation**: Create stunning architectural renders using `Gemini 2.5 Flash Image`.
- **🪄 Intelligent Editing**: Refine designs by describing changes (e.g., "add an infinity pool", "sunset lighting").
- **📸 Direct Instagram Publishing**: Post your designs directly to your Instagram Feed, Reels, Stories, or Carousels.
- **✨ Magic Captions**: Generate humanized, Indian English style captions with architectural hashtags using AI.
- **☁️ Cloud Genesis**: Seamlessly sync designs to Google Drive via a custom Apps Script bridge.
- **🌗 Mode-X Interface**: Dynamic Day/Night theme toggle with a randomized signature color system.
- **🎞️ Gallery & History**: Manage your local session history, saved gallery, and cloud files in one unified view.

---

## 🛠️ Tech Stack

- **Framework**: Next.js 16 (App Router, Turbopack)
- **AI Engine**: Google Generative AI (Gemini 2.5 Flash & 1.5 Flash)
- **Styling**: Vanilla CSS with modern Glassmorphism aesthetics
- **Social Integration**: Meta Graph API (Instagram Content Publishing)
- **Storage Bridge**: Google Apps Script (Web App Deployment)
- **Deployment**: Optimized for Vercel / Node.js environments

---

## 🚀 Setup & Installation

### 1. Prerequisites
- Node.js (v18+)
- [Google AI Studio API Key](https://aistudio.google.com/app/apikey)
- [Meta Developer Account](https://developers.facebook.com/) (For Instagram Publishing)
- Google Account (For Drive Integration)

### 2. Environment Variables
Create a `.env` file in the root:
```env
# AI
GEMINI_API_KEY=your_key_here

# Instagram (Meta Graph API)
IG_USER_ID=your_instagram_business_id
ACCESS_TOKEN=your_facebook_system_user_token

# Storage
NEXT_PUBLIC_DRIVE_UPLOAD_URL=your_apps_script_url
```

### 3. Quick Start
```bash
npm install
npm run dev
```

---

## 🏗️ Technical Architecture

### 🛡️ Social Publishing Engine
The app implements a robust Instagram publishing flow with a 30-second polling mechanism. It ensures media is fully processed by Meta's servers before final publication, resolving the common "Media ID not found" errors.

### 🔌 Google Drive Bridge
Uses a "No-Login" upload strategy. A Google Apps Script (`code.gs`) acts as a secure intermediary, allowing the frontend to store images in a specific Drive folder without forcing users through an OAuth consent screen.

### 🪄 Humanized AI Captions
The caption generator is tuned for the Indian architectural market, producing warm, relatable, and concise "Indian English" captions (e.g., using terms like "aesthetic", "vibe check", "dreamy") followed by curated hashtags.

---

## 📖 Usage

- **Creative Flow**: Enter a prompt -> Generate -> Refine with AI suggestions.
- **Saving**: Toggle "Sync to Drive" to keep a permanent backup in your cloud.
- **Sharing**: Click the "Share" icon (left overlay) -> Select Format (Reel/Post) -> Generate AI Caption -> Publish.
- **Restoration**: Click any image in History or Cloud to restore the prompt and layout.

---

## 🤝 Contributing
Contributions make the world go round! 
1. Fork it.
2. Branch it (`git checkout -b feature/CoolStuff`).
3. Commit it (`git commit -m 'Added more gold'`).
4. Push it (`git push origin feature/CoolStuff`).
5. Open a PR.

---

<p align="center">
  Built with ❤️ by AI Enthusiasts for Modern Architects
</p>
