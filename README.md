# WatchParty 🎬

> Watch videos together in perfect sync. Real-time synchronized video playback with chat, reactions, and presence.

![WatchParty Demo](https://img.shields.io/badge/WatchParty-v1.0.0-blue)
![React](https://img.shields.io/badge/React-18.2-61dafb?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.3-3178c6?logo=typescript)
![Vite](https://img.shields.io/badge/Vite-5.0-646cff?logo=vite)
![Firebase](https://img.shields.io/badge/Firebase-10.7-ffca28?logo=firebase)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-06b6d4?logo=tailwindcss)
![License](https://img.shields.io/badge/License-MIT-green)

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🎥 **Multi-Source Video Sync** | YouTube, HTML5 video, HLS/DASH streams synchronized across all clients |
| 💬 **Real-time Chat** | Firebase Firestore powered chat with presence indicators |
| ❤️ **Reactions & Emojis** | Real-time emoji reactions synced across all viewers |
| 👥 **Presence System** | See who's in the room, who's playing/paused, connection status |
| 🔐 **Firebase Auth** | Anonymous auth + Google/GitHub OAuth support |
| 🎨 **Modern UI** | Tailwind CSS + Radix UI primitives, dark mode ready |
| ⚡ **Low Latency** | Firebase Realtime Database for sub-100ms sync |
| 📱 **Responsive** | Mobile-first responsive design |

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18 + TypeScript + Vite |
| **Styling** | Tailwind CSS + Radix UI |
| **State** | React Context + Custom Hooks |
| **Real-time Sync** | Firebase Realtime Database |
| **Database** | Cloud Firestore |
| **Auth** | Firebase Auth (Anon + OAuth) |
| **Hosting** | Firebase Hosting / Vercel |
| **Video** | YouTube IFrame API + Native HTML5 + HLS.js |

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm / pnpm / yarn
- Firebase project (free tier works)

### 1. Clone & Install
```bash
git clone https://github.com/GoldleoM/WatchParty.git
cd WatchParty
npm install
```

### 2. Firebase Setup
1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable **Authentication** → Anonymous + Google/GitHub providers
3. Enable **Firestore Database** (start in test mode)
4. Enable **Realtime Database** (start in test mode)
5. Enable **Hosting** (optional, for deployment)
6. Copy your config from Project Settings → General → Your apps → Web app

### 3. Configure Environment
```bash
cp .env.example .env
```

Edit `.env` with your Firebase config:
```env
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
VITE_FIREBASE_MEASUREMENT_ID=G-XXXXXXXX
```

### 4. Firestore Rules (Development)
```javascript
// firestore.rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /rooms/{roomId} {
      allow read, write: if request.auth != null;
      match /messages/{messageId} {
        allow read, write: if request.auth != null;
      }
      match /participants/{userId} {
        allow read, write: if request.auth != null;
      }
      match /reactions/{reactionId} {
        allow read, write: if request.auth != null;
      }
    }
  }
}
```

### 5. Realtime Database Rules (Development)
```json
{
  "rules": {
    "rooms": {
      "$roomId": {
        "videoState": {
          ".read": "auth != null",
          ".write": "auth != null"
        },
        "participants": {
          ".read": "auth != null",
          ".write": "auth != null"
        }
      }
    }
  }
}
```

### 6. Run Dev Server
```bash
npm run dev
```
Open http://localhost:5173

---

## 📁 Project Structure

```
WatchParty/
├── public/                 # Static assets
├── src/
│   ├── components/
│   │   ├── layout/         # Navbar, Layout components
│   │   ├── room/           # Chat, Sidebar, Room-specific UI
│   │   ├── ui/             # Reusable UI primitives (Button, Input, Avatar)
│   │   └── video/          # Video players (YouTube, HTML5, Subtitles)
│   ├── contexts/           # React Context providers (Auth)
│   ├── firebase/           # Firebase config & initialization
│   ├── hooks/              # Custom React hooks (useRoom, useVideoSync, etc.)
│   ├── pages/              # Route-level components (Home, Room, CreateRoom)
│   ├── types/              # TypeScript type definitions
│   ├── utils/              # Utilities (cn, cleanup, subtitles parser)
│   ├── App.tsx
│   └── main.tsx
├── .env.example            # Environment template
├── firebase.json           # Firebase hosting config
├── firestore.rules         # Firestore security rules
├── firestore.indexes.json  # Firestore indexes
└── vite.config.ts
```

---

## 🔧 Available Scripts

```bash
npm run dev          # Start dev server (Vite)
npm run build        # Production build
npm run preview      # Preview production build
npm run lint         # ESLint + TypeScript check
npm run typecheck    # TypeScript type checking
```

---

## 🔐 Firebase Security Rules (Production)

### Firestore Rules
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isRoomMember(roomId) {
      return exists(/databases/$(database)/documents/rooms/$(roomId)/participants/$(request.auth.uid));
    }
    
    match /rooms/{roomId} {
      allow read, write: if isRoomMember(roomId);
      match /messages/{messageId} {
        allow read: if isRoomMember(roomId);
        allow create: if isRoomMember(roomId) && request.auth.uid == request.resource.data.userId;
      }
      match /participants/{userId} {
        allow read: if isRoomMember(roomId);
        allow write: if request.auth.uid == userId;
      }
      match /reactions/{reactionId} {
        allow read: if isRoomMember(roomId);
        allow write: if isRoomMember(roomId);
      }
    }
  }
}
```

### Realtime Database Rules
```json
{
  "rules": {
    "rooms": {
      "$roomId": {
        "videoState": {
          ".read": "auth != null && root.child('rooms').child($roomId).child('participants').child(auth.uid).exists()",
          ".write": "auth != null && root.child('rooms').child($roomId).child('participants').child(auth.uid).exists()"
        },
        "participants": {
          ".read": "auth != null",
          ".write": "auth != null"
        }
      }
    }
  }
}
```

---

## 🚀 Deployment

### Firebase Hosting
```bash
npm run build
firebase deploy
```

### Vercel
```bash
npm i -g vercel
vercel --prod
```
Add environment variables in Vercel dashboard.

### Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npx", "serve", "-s", "dist", "-l", "3000"]
```

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Development Guidelines
- Follow TypeScript strict mode
- Use Tailwind CSS for styling
- Write hooks for reusable logic
- Keep components small and focused
- Run `npm run lint` before committing

---

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

---

## 🙏 Acknowledgments

- [Firebase](https://firebase.google.com/) for real-time infrastructure
- [Tailwind CSS](https://tailwindcss.com/) for styling
- [Radix UI](https://www.radix-ui.com/) for accessible primitives
- [HLS.js](https://github.com/video-dev/hls.js/) for HLS playback
- [YouTube IFrame API](https://developers.google.com/youtube/iframe_api_reference)

---

<div align="center">
  <strong>Built with ❤️ for watch parties everywhere</strong>
  <br>
  <a href="https://github.com/GoldleoM/WatchParty/issues">Report Bug</a> •
  <a href="https://github.com/GoldleoM/WatchParty/issues">Request Feature</a>
</div>