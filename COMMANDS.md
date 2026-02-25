# Commands Reference

## Install
```bash
npm install
```

## API (apps/api)
```bash
npm -w @bitebuddy/api run dev        # Dev server → http://localhost:3000
npm -w @bitebuddy/api run build      # Production build
npm -w @bitebuddy/api run lint       # Lint
```

## Mobile (apps/mobile)
```bash
npm -w @bitebuddy/mobile start       # Expo dev server (press i for iOS, a for Android)
npm -w @bitebuddy/mobile run ios     # iOS simulator
npm -w @bitebuddy/mobile run android # Android emulator
```

## Adding Packages
```bash
npx expo install <pkg> --project apps/mobile   # Expo-compatible package
npm -w @bitebuddy/api install <pkg>             # API package
```

## Local Dev Setup
1. Start API: `npm -w @bitebuddy/api run dev`
2. Start Mobile: `npm -w @bitebuddy/mobile start`
3. Ensure `apps/mobile/.env` has `EXPO_PUBLIC_API_URL=http://localhost:3000`
