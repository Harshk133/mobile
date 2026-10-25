# AnnaSaathi — mobile app

React Native · Expo SDK 58 · Expo Router · TypeScript. Setup, the demo script and project status are in the [root README](../README.md).

```bash
npm install
npx expo start        # scan the QR code with Expo Go (Android), or press a / w
npx tsc --noEmit      # typecheck
npx expo-doctor       # dependency check
```

The app needs the API from `../api` running on port 8000; see the root README.

## Layout

| Path | What |
|---|---|
| `src/app/(tabs)/` | Home, Shop, My Kitchen, Cook Today, Impact |
| `src/app/scan.tsx` | Camera, gallery, pasted text and sample bill, then review |
| `src/app/item/[id].tsx` | Item detail: freshness calculation and corrections |
| `src/app/{voice,check,alerts,family,welcome,onboarding}.tsx` | Voice input, weekly check, alerts, profile and settings, first run |
| `src/ui/theme.ts` | Design tokens (colour, spacing, radius, type, touch size) |
| `src/ui/primitives.tsx`, `controls.tsx`, `feedback.tsx` | Text, buttons, cards, pills, sheet, stepper, toast with Undo, skeletons, empty and error states |
| `src/ui/review.tsx` | Bill review (shared by scan and voice), with saved drafts |
| `src/lib/api.ts` | Typed API client; scan results validated with Zod |
| `src/lib/queries.ts` | TanStack Query hooks. Any stock change refreshes every stock-derived view |
| `src/lib/settings.tsx` | Language, server address and dismissed alerts (AsyncStorage); `t()` and item names |
| `src/locales/*.json` | English, Hindi, Marathi. Missing keys fall back to English |

To add a language: copy `src/locales/en.json`, translate it, and register it in `src/lib/settings.tsx`.
