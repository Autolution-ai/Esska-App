# Supabase Expo Mobile Template

A production-ready mobile SaaS template built with React Native, Expo, and Supabase. This template provides a complete mobile application with authentication, file management, task management, and internationalization support.

## Video
[![Watch the video](https://img.youtube.com/vi/qcASa0Ywsy4/maxresdefault.jpg)](https://youtube.com/shorts/qcASa0Ywsy4?feature=share)


## 📱 Platform Support

- **iOS** - Full native support
- **Android** - Full native support
- **Shared Backend** - Powered by Supabase

## 🚀 Features

### Authentication
- Email/Password authentication
- Multi-factor authentication (MFA/2FA) with TOTP
- QR code enrollment for authenticator apps
- Password reset via email
- Email verification
- Deep link handling for password reset
- Persistent sessions

### User Management
- User profile display
- Password change functionality
- MFA device management
- Multiple MFA device support
- User settings and preferences

### File Management (2FA Protected)
- Secure file upload with document picker
- Drag and drop support
- File sharing with time-limited URLs
- File download
- File deletion with confirmation
- Progress indicators
- Maximum file size: 50MB

### Task Management (2FA Protected)
- Create, read, update, delete tasks
- Task filtering (All/Active/Completed)
- Mark tasks as urgent
- Mark tasks as done
- Task descriptions
- Real-time updates
- Row-level security

### Internationalization (i18n)
- **Supported Languages:**
  - English (en)
  - Polish (pl)
  - Chinese Simplified (zh)
- Automatic device language detection
- In-app language switching
- Persistent language preferences
- Language selector on login/register screens
- All screens fully translated

### UI/UX
- Tab-based navigation with icons
- Safe area support for all devices
- Loading states and spinners
- Error handling with alerts
- Success notifications
- Native modal dialogs
- Themed color scheme
- Responsive layouts

## 🛠️ Tech Stack

### Core
- **React Native** 0.81.4
- **Expo SDK** 54
- **React** 19.1.0

### Navigation & Routing
- **Expo Router** 6.0.8 (file-based routing)
- **React Navigation** (bottom tabs)

### Backend
- **Supabase** (Authentication, Database, Storage)
- **@supabase/supabase-js** 2.58.0

### UI Components
- **Lucide React Native** (icons)
- **React Native QRCode SVG** (MFA QR codes)
- **React Native Safe Area Context**

### Internationalization
- **i18next** 25.5.2
- **react-i18next** 16.0.0
- **expo-localization** 17.0.7

### File & Storage
- **Expo Document Picker** 14.0.7
- **Expo Clipboard** 8.0.7
- **Expo Sharing** 14.0.7
- **Expo Web Browser** 15.0.7

### State Management
- React hooks (useState, useEffect, useContext)
- AsyncStorage for persistent storage

## 📦 Getting Started

### Prerequisites

- Node.js 18+
- Yarn or npm
- Expo CLI
- iOS Simulator (Mac) or Android Emulator
- Supabase project

### 1. Backend Setup

First, set up your Supabase backend following the main repository README. You need:
- Supabase Project URL
- Supabase Anon Key
- Migrations applied
- Storage bucket configured
- RLS policies enabled

### 2. Install Dependencies

```bash
cd supabase-expo-template
yarn install
```

### 3. Configure Environment

Create a `.env` file in the root directory:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### 4. Configure App Settings

Edit `app.json`:

```json
{
  "expo": {
    "name": "Your App Name",
    "slug": "your-app-slug",
    "scheme": "yourappscheme",
    "ios": {
      "bundleIdentifier": "com.yourcompany.yourapp"
    },
    "android": {
      "package": "com.yourcompany.yourapp"
    }
  }
}
```

**Important:** The `scheme` value is used for deep linking (password reset). Update it to match your app.

### 5. Configure Supabase Redirect URLs

In your Supabase dashboard, add these redirect URLs:
- `yourappscheme://reset-password` (replace with your actual scheme)

Or update `supabase/config.toml`:

```toml
[auth]
additional_redirect_urls = ["yourappscheme://reset-password"]
```

### 6. Run the App

```bash
# Start development server
npx expo start

# Run on iOS simulator
npx expo run:ios

# Run on Android emulator
npx expo run:android

# Or scan QR code with Expo Go app
```

## 📁 Project Structure

```
supabase-expo-template/
├── app/                          # App screens (Expo Router)
│   ├── (app)/                    # Authenticated app screens
│   │   ├── _layout.tsx          # Tab navigation
│   │   ├── index.tsx            # Home screen
│   │   ├── settings.tsx         # Settings screen
│   │   ├── storage.tsx          # File management
│   │   └── tasks.tsx            # Task management
│   ├── (auth)/                   # Authentication screens
│   │   ├── _layout.tsx          # Auth stack layout
│   │   ├── login.tsx            # Login screen
│   │   ├── register.tsx         # Registration screen
│   │   ├── forgot-password.tsx  # Password reset request
│   │   ├── reset-password.tsx   # Password reset form
│   │   ├── two-factor.tsx       # 2FA verification
│   │   └── verify-email.tsx     # Email verification
│   ├── _layout.tsx              # Root layout
│   └── index.tsx                # Initial route
├── components/                   # Reusable components
│   ├── MFASetup.tsx             # MFA enrollment component
│   └── ui/                       # UI components
│       ├── alert.tsx
│       ├── button.tsx
│       ├── card.tsx
│       └── input.tsx
├── constants/
│   └── theme.ts                  # Theme colors
├── hooks/                        # Custom hooks
│   └── use-color-scheme.ts
├── lib/                          # Utilities
│   ├── i18n.ts                  # i18n configuration
│   ├── storage.ts               # AsyncStorage wrapper
│   ├── supabase.ts              # Supabase client
│   └── types.ts                 # TypeScript types
├── locales/                      # Translation files
│   ├── en.json                  # English
│   ├── pl.json                  # Polish
│   └── zh.json                  # Chinese
├── app.json                      # Expo configuration
├── package.json
└── tsconfig.json
```

## 🔐 Authentication Flow

### Login Flow
1. User enters email and password
2. App checks for MFA requirement
3. If MFA enabled → redirect to 2FA screen
4. If no MFA → redirect to app

### Registration Flow
1. User enters email and password
2. User accepts terms and privacy policy (required)
3. Account created
4. Email verification sent
5. User redirected to verify-email screen

### Password Reset Flow
1. User requests password reset
2. Email sent with reset link containing tokens
3. User clicks link: `yourappscheme://reset-password#access_token=...&refresh_token=...`
4. App intercepts deep link in `app/_layout.tsx`
5. Tokens extracted from hash fragment
6. Session established via `supabase.auth.setSession()`
7. User redirected to reset-password screen
8. New password set
9. Redirect to app

### MFA Enrollment Flow
1. User navigates to Settings → MFA
2. User provides device name
3. QR code displayed
4. User scans with authenticator app (Google Authenticator, Authy, etc.)
5. User enters 6-digit code
6. Factor verified and enrolled
7. Multiple devices can be enrolled

## 🌍 Internationalization

### Adding a New Language

1. **Create translation file:**
```bash
# Create new file in locales/
touch locales/es.json
```

2. **Add translations:**
```json
{
  "auth": {
    "login": "Iniciar sesión",
    "register": "Registrarse",
    ...
  },
  ...
}
```

3. **Import in `lib/i18n.ts`:**
```typescript
import es from '../locales/es.json'

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    pl: { translation: pl },
    zh: { translation: zh },
    es: { translation: es }, // Add here
  },
  ...
})
```

4. **Add to language selector UI** in `app/(auth)/login.tsx` and `app/(auth)/register.tsx`

### Translation Keys Structure

```typescript
{
  "auth": { /* Authentication screens */ },
  "home": { /* Home screen */ },
  "app": { /* App navigation */ },
  "storage": { /* File management */ },
  "tasks": { /* Task management */ },
  "mfa": { /* MFA screens */ },
  "settings": { /* Settings screen */ }
}
```

## 🚀 Building for Production

### iOS

```bash
# Configure EAS
eas build:configure

# Build for iOS
eas build --platform ios --profile production

# Submit to App Store
eas submit --platform ios
```

### Android

```bash
# Build for Android
eas build --platform android --profile production

# Submit to Google Play
eas submit --platform android
```

### Build Profiles

Edit `eas.json` to configure build profiles:

```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal"
    },
    "production": {}
  }
}
```

See [Expo EAS Build documentation](https://docs.expo.dev/build/introduction/) for details.

## 🎨 Customization

### Colors and Theme

Edit `constants/theme.ts`:

```typescript
export const Colors = {
  light: {
    text: '#11181C',
    background: '#fff',
    tint: '#0a7ea4', // Primary color
    icon: '#687076',
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: '#fff',
    icon: '#9BA1A6',
  },
};
```

### App Name and Branding

1. Update `app.json`:
```json
{
  "expo": {
    "name": "Your App Name",
    "icon": "./assets/images/icon.png",
    "splash": {
      "image": "./assets/images/splash-icon.png"
    }
  }
}
```

2. Replace icon files in `assets/images/`

### Navigation

Edit `app/(app)/_layout.tsx` to customize tabs:

```typescript
<Tabs.Screen
  name="your-screen"
  options={{
    title: t('app.yourScreen'),
    tabBarIcon: ({ color, size }) => <YourIcon size={size} color={color} />,
  }}
/>
```

## 🤝 Contributing

Contributions welcome! Please:
- Follow existing code style
- Add tests for new features
- Update documentation
- Test on both iOS and Android

## 📝 License

This project is licensed under the Apache License - see the LICENSE file for details.

## 💪 Support

If you find this template helpful:
- Give it a star ⭐️
- [Buy me a coffee](https://buymeacoffee.com/razikus)
