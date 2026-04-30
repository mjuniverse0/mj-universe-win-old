# Verdant Executor (kernel-backed local agent)

Local Windows polling agent that replaces the old ViGEm-based remap runtime.
The user-facing "Remap engine" branding in the launcher is preserved - but
the runtime now lives behind `https://verdant.lol/api/executor`:

- The **launcher** posts scripts to `https://verdant.lol/api/executor/execute`
  (with `X-Verdant-HWID`, `X-Verdant-License`, `X-Verdant-Author` headers).
- **server.js** proxies to **`scripts/executor-daemon.js`** on the VPS
  (`pm2 verdant-executor`, port 6969). The daemon enqueues the script keyed
  by HWID and waits for an agent to claim it.
- This binary is the **agent**: it long-polls
  `https://verdant.lol/api/executor/pull?hwid=<HWID>&wait=25`, runs the
  script against Roblox via the kernel bridge, and POSTs the outcome to
  `/api/executor/ack`.
- It also exposes a tiny local `127.0.0.1:6969` server (`GET /`, `GET /health`,
  `POST /execute`) for diagnostics and as a fallback target when
  `VERDANT_EXECUTOR_URL=http://127.0.0.1:6969` is forced.
- Auto-attaches to `RobloxPlayerBeta.exe` / `RobloxStudioBeta.exe` /
  `RobloxPlayer.exe` every 2 s, prefers the kernel driver bridge
  (`\\.\VerdantKM` IOCTLs) and falls back to user-mode `RPM`/`WPM`.

## Layout

```
client/executor/
├── CMakeLists.txt
├── README.md
└── src/
    ├── main.cpp     // entry: backend + HTTP server + attach loop + poll agent
    ├── server.hpp   // Minimal HTTP/1.1 routing + handler signature
    ├── server.cpp   // WinSock single-threaded HTTP server (diagnostic)
    ├── poller.hpp   // Long-poll agent against /pull → handler → /ack
    └── poller.cpp
```

`memory.{hpp,cpp}`, `process.{hpp,cpp}` and `http.{hpp,cpp}` are shared with
`client/overlay/` through CMake (single source of truth for the kernel
bridge, Roblox PID detection and the WinHTTP wrapper).

## Build (Windows / MSVC)

```powershell
cd client/executor
cmake -S . -B build-win -A x64
cmake --build build-win --config Release
```

Output: `client/executor/build-win/Release/verdant_executor.exe`.

The Electron launcher auto-detects this path in `client/launcher/main.js` and
spawns the executor on app boot. `resolveExecutorBaseUrl()` falls back to
`http://127.0.0.1:6969` once the binary exists, so the script editor's
"Run" button hits the local kernel-backed daemon by default.

`nlohmann/json` is fetched via CMake `FetchContent`. No external deps beyond
the Windows 10 SDK.

## HTTP API

| Method | Path        | Body                     | Response |
|--------|-------------|--------------------------|----------|
| GET    | `/`         | -                        | `200 ok` |
| GET    | `/health`   | -                        | `200 application/json` - `{ok, backend, attached, pid, base, scripts_executed, bytes_executed}` |
| POST   | `/execute`  | raw script, **or** `application/json` `{script: "..."}` / `{code: "..."}` | `200 application/json` - `{ok, backend, attached, delivered, received_bytes}` |

`backend` is `"kernel"` when the IOCTL bridge opened successfully, otherwise
`"usermode"`. `attached` flips to `true` once a Roblox process is detected.

## Configuration

| Variable | Purpose | Default |
|---|---|---|
| `VERDANT_EXECUTOR_BASE` | URL the poll agent talks to | `https://verdant.lol/api/executor` |
| `VERDANT_EXECUTOR_HWID` | HWID claimed by this agent | computed from `GetComputerName` |
| `VERDANT_EXECUTOR_LICENSE` | Optional license key (forwarded as `X-Verdant-License`) | empty |
| `VERDANT_EXECUTOR_AUTHOR` | Optional author label (forwarded as `X-Verdant-Author`) | empty |
| `VERDANT_EXECUTOR_PORT` | Local diagnostic HTTP port | `6969` |
| `VERDANT_EXECUTOR_RUNTIME` | `embedded` \| `kernel` \| `auto` | `auto` (`embedded` if compiled in) |

The launcher (`client/launcher/main.js`) populates the URL/HWID/license/author
when it spawns the agent so the HWID seen by the server matches the
launcher's `computeHwid()` result, ensuring jobs reach the right machine.

## Runtimes

`runtime.{hpp,cpp}` defines a small `LuaRuntime` interface. Two
implementations ship today; the active one is picked by
`VERDANT_EXECUTOR_RUNTIME` (or compile-time fallback):

### `embedded` - `EmbeddedLuauRuntime`

A private `lua_State*` per script using Luau (luau-lang/luau, pinned at
`0.654` and pulled via CMake `FetchContent`). The script is compiled to
Luau bytecode in-process via `Luau::compile()` and executed under
`luau_load` + `lua_pcall`. Standard library is opened (`math`, `string`,
`table`, ...). `print()` is replaced with a buffered version so the
captured output lands in the `/ack` payload.

This runtime is fully sandboxed - it does **not** see Roblox globals
(`game`, `workspace`, `Instance`, ...). It is the right choice for
syntax validation, sandboxed Lua/Luau tooling, and end-to-end testing of
the `verdant.lol → daemon → agent → /ack` pipeline.

Toggle off with `cmake -DVERDANT_EMBED_LUAU=OFF` for fast incremental
builds (you'll be left with just the kernel runtime stub).

### `kernel` - `KernelInjectionRuntime`

Architectural sketch for delivering the compiled bytecode into Roblox's
own Luau VM via the `KernelDriver` / `UserModeBackend` bridge. The two
hot spots that need to be filled in per Roblox build live in
`runtime.cpp`:

```cpp
uintptr_t resolveProtoAddress(const RuntimeContext&) const { return 0; }

bool writeBytecode(const RuntimeContext& ctx, uintptr_t target,
                   const std::string& bytecode) { ... }
```

`resolveProtoAddress()` returns `0` on purpose so an unconfigured agent
fails loud with "could not resolve target Proto address" rather than
writing into a random region. The exact resolver (whether you walk
`Roblox.exe`'s `.data` for the script context, scan for a known TString,
or pattern-match into the Luau VM dispatch table) is build-specific and
intentionally not shipped in this repo - drop your offset table /
signature scanner in here.

## Adding a runtime

1. Subclass `LuaRuntime` in `runtime.cpp`.
2. Add a `RuntimeKind` enum value.
3. Wire the new kind through `makeRuntime()` and `resolveRuntimeKind()`.
4. The `Poller` callback in `main.cpp` already routes through whatever
   `runtime->execute()` returns, so no changes are needed there.

## Current limitations / next steps

- `/execute` does **not** yet run Lua. The handler proves the script reached
  the daemon and the kernel bridge is reachable (`delivered=true`), but
  inserting the payload into Roblox's Lua VM is left as a separate task  - 
  the place to plug it in is marked with `TODO(real-impl)` in `main.cpp`.
- The kernel driver itself is not in this repo. The IOCTL contract (device
  `\\.\VerdantKM`, `ATTACH/READ/WRITE` codes) is defined in
  `client/overlay/src/memory.cpp`; ship a signed driver matching it.
- Single-threaded HTTP server (one connection at a time). Fine for the
  launcher workload; swap for `std::thread`-per-connection if you wire in
  external tooling.
