# BiteBuddy Frontend

React Native app built with Expo for iOS, Android, and Web.

## Getting Started

### Install Dependencies

```bash
npm install
```

### Run the App

```bash
# Web (opens in browser)
npm run web

# Android (requires Android Studio OR Expo Go app on phone)
npm run android

# iOS (requires Mac with Xcode OR Expo Go app on iPhone)
npm run ios

# Start dev server (shows QR code for Expo Go)
npm start
```

### Using Expo Go (Recommended for Mobile Testing)

1. Install **Expo Go** app on your phone (App Store / Play Store)
2. Run `npm start`
3. Scan the QR code with your phone
4. App loads on your device!

---

## Project Structure

```
frontend/
├── app/                    # App screens and navigation (file-based routing)
│   ├── _layout.tsx         # Root layout (navigation setup)
│   ├── index.tsx           # Home screen (/)
│   └── [screenName].tsx    # Add new screens here
├── components/             # Reusable UI components
│   └── MyButton.tsx        # Example: <MyButton />
├── assets/                 # Images, fonts, etc.
├── constants/              # App-wide constants (colors, config)
├── hooks/                  # Custom React hooks
├── app.json                # Expo configuration
└── package.json            # Dependencies
```

---

## Adding New Screens

Expo uses **file-based routing**. Create a file in `app/` and it becomes a route:

| File | Route |
|------|-------|
| `app/index.tsx` | `/` (home) |
| `app/login.tsx` | `/login` |
| `app/profile.tsx` | `/profile` |
| `app/restaurants/[id].tsx` | `/restaurants/:id` (dynamic) |

Example screen:

```tsx
// app/login.tsx
import { View, Text } from 'react-native';

export default function LoginScreen() {
  return (
    <View>
      <Text>Login Screen</Text>
    </View>
  );
}
```

---

## Adding Components

Create reusable components in `components/`:

```tsx
// components/RestaurantCard.tsx
import { View, Text } from 'react-native';

type Props = {
  name: string;
  cuisine: string;
};

export default function RestaurantCard({ name, cuisine }: Props) {
  return (
    <View>
      <Text>{name}</Text>
      <Text>{cuisine}</Text>
    </View>
  );
}
```

Use it in a screen:

```tsx
import RestaurantCard from '@/components/RestaurantCard';

<RestaurantCard name="Pizza Palace" cuisine="Italian" />
```

---

## Calling the Backend API

```tsx
const API_URL = 'http://localhost:3000'; // Change for production

// Example: Fetch restaurants
const response = await fetch(`${API_URL}/api/restaurants`);
const data = await response.json();
```

---

## Installing New Packages

```bash
# Use npx expo install for Expo-compatible versions
npx expo install package-name

# Example
npx expo install react-native-gesture-handler
```

---

## Useful Commands

| Command | Description |
|---------|-------------|
| `npm start` | Start Expo dev server |
| `npm run web` | Run in browser |
| `npm run android` | Run on Android |
| `npm run ios` | Run on iOS |
| `npx expo install <pkg>` | Install Expo-compatible package |

---

## Resources

- [Expo Docs](https://docs.expo.dev/)
- [React Native Docs](https://reactnative.dev/docs/getting-started)
- [Expo Router (Navigation)](https://docs.expo.dev/router/introduction/)
