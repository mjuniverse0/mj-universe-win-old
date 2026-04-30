# Verdant Chat Overlay

External Win32 overlay that lets friends chat across different Roblox
experiences. Renders as a layered, always-on-top widget in the bottom-right
corner of the primary monitor and exchanges messages through a Supabase
`chat_messages` table.

## Components

```
client/overlay/
├── CMakeLists.txt
└── src/
    ├── main.cpp        // wWinMain: env config + chat thread + overlay window
    ├── overlay.{hpp,cpp}  // Direct2D + DirectWrite layered window
    ├── chat.{hpp,cpp}     // Supabase REST polling + send (background thread)
    ├── http.{hpp,cpp}     // Minimal WinHTTP wrapper (HTTPS supported)
    ├── process.{hpp,cpp}  // Roblox PID + main-window detection
    └── memory.{hpp,cpp}   // MemoryBackend interface + KernelDriver / UserMode
```

`main.cpp` prefers `KernelDriver` (IOCTL bridge to a separately-deployed
signed driver, default device path `\\.\VerdantKM`) and falls back to
`UserModeBackend` (`OpenProcess` + `ReadProcessMemory`) when no driver is
present. Memory access is wired but not yet used by the chat UI; it gives
later iterations a clean place to read in-game state (current experience,
nearby players, etc.) without changing the overlay layer.

## Build (Windows / MSVC)

```powershell
cd client/overlay
cmake -S . -B build-win -A x64
cmake --build build-win --config Release
```

The output binary lives at
`client/overlay/build-win/Release/verdant_overlay.exe`. The Electron launcher
auto-detects this path in `client/launcher/main.js` and spawns the overlay
together with the engine.

`nlohmann/json` is pulled in via CMake `FetchContent`, so the only
prerequisites are CMake ≥ 3.20 and the Windows 10 SDK.

## Configuration

The overlay reads its config from environment variables - set them in your
shell or via the launcher `.env`:

| Variable | Purpose |
|---|---|
| `SUPABASE_URL` | e.g. `https://xxxx.supabase.co` |
| `SUPABASE_PUBLISHABLE_KEY` | anon / publishable key (also accepts `SUPABASE_ANON_KEY`) |
| `VERDANT_CHAT_ROOM_ID` | UUID of the chat room (the seeded room is `00000000-0000-0000-0000-00000000c1a7`) |
| `VERDANT_CHAT_AUTHOR_ID` | optional, defaults to `<hostname>-<pid>` |
| `VERDANT_CHAT_AUTHOR_NAME` | optional, defaults to the Windows user name |

## Supabase schema

See `supabase/migrations/20260428033000_create_overlay_chat_tables.sql`.
Tables created:

- `public.chat_rooms (id uuid, name text, created_at, created_by)`
- `public.chat_messages (id bigint, room_id uuid, author_id, author_name, body, created_at)`

RLS is permissive (anyone with the anon key + room id can read/insert).
The room id acts as the shared secret between friends. Tighten this once
the launcher passes a real Supabase JWT to the overlay process.

## Roadmap

- Replace the 2 s polling loop with Supabase Realtime (WebSocket) once an
  embeddable wss client is added.
- Plug a real signed kernel driver into the `KernelDriver` IOCTLs.
- Position the overlay relative to the detected Roblox window instead of
  the monitor work area.
- Per-user color, avatar, and unread badges.
- Pass an authenticated JWT from the launcher so RLS can require auth.
