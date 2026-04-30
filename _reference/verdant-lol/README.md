# Verdant External Platform

Includes Discord bot, website, and a desktop launcher shell.

## Desktop Launcher (v1)

This repository now contains a first launcher/client shell in `client/launcher`.

- Start launcher: `npm run start:launcher`
- Mock runtime only: `npm run start:client-runtime`

The launcher currently provides:

- Login/key + product selection UI
- API license verification before launch
- HWID bind/lock flow (first login binds HWID)
- Version check endpoint for updater flow
- Start/stop desktop runtime session
- Live runtime status and logs
- Native C++ GUI client support (auto-launched if binary exists)

This is the base where the real remap engine and updater can be integrated.

## Native components (Windows)

The launcher now ships two C++ daemons that take over the runtime - the
ViGEm-based remap engine in `client/cpp-client` was retired:

- **`client/executor/`** - kernel-backed Roblox executor (`POST /execute`
  on `127.0.0.1:6969`). Auto-spawned by the launcher; the "Remap engine"
  IPC session in the UI is now routed through this binary instead of
  ViGEm. See `client/executor/README.md`.
- **`client/overlay/`** - layered always-on-top chat overlay for
  cross-experience friend chat (Supabase backend). See
  `client/overlay/README.md`.

Both projects share `memory.{hpp,cpp}` (kernel IOCTL bridge + user-mode
fallback) and `process.{hpp,cpp}` (Roblox PID detection) under
`client/overlay/src/`.

Build:

```powershell
cmake -S client/executor -B client/executor/build-win -A x64
cmake --build client/executor/build-win --config Release

cmake -S client/overlay -B client/overlay/build-win -A x64
cmake --build client/overlay/build-win --config Release
```

## Discord Bot

Discord bot that posts two onboarding panels:

- `Verdant External Config Request System` (dropdown)
- `Verdant External Application System` (button)

It also creates private ticket channels, notifies status/log channels, and lets Founder/Owner archive tickets.

## Setup

1. Install dependencies:
   - `npm install`
2. Create `.env` from `.env.example`.
3. Fill in:
   - `DISCORD_TOKEN`
   - `DISCORD_GUILD_ID`
   - Optional channel/role overrides from `.env.example` (if needed)
4. Run:
   - `npm start`

## Notes

- Panels are posted to configured channels on startup.
- `Apply Now` and `Config` menu create private ticket channels.
- `Archive Ticket` button is restricted to Founder/Owner role.
- IDs you shared are included as defaults in `index.js`.
