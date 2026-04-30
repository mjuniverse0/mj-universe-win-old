cmake_minimum_required(VERSION 3.20)
project(verdant_executor LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

if(NOT WIN32)
  message(WARNING "verdant_executor is Windows-only; skipping target.")
  return()
endif()

# Luau is non-trivial to fetch + build (~1-2 min on a clean machine). Default
# ON so the embedded sandbox runtime is available out of the box; turn off
# for fast incremental builds when only iterating on the agent itself.
option(VERDANT_EMBED_LUAU "Embed Luau VM + compiler for sandboxed script execution" ON)

include(FetchContent)
FetchContent_Declare(
  nlohmann_json
  GIT_REPOSITORY https://github.com/nlohmann/json.git
  GIT_TAG v3.11.3
  GIT_SHALLOW TRUE
)
FetchContent_MakeAvailable(nlohmann_json)

if(VERDANT_EMBED_LUAU)
  set(LUAU_BUILD_CLI OFF CACHE BOOL "" FORCE)
  set(LUAU_BUILD_TESTS OFF CACHE BOOL "" FORCE)
  set(LUAU_BUILD_WEB OFF CACHE BOOL "" FORCE)
  set(LUAU_EXTERN_C ON CACHE BOOL "" FORCE)
  FetchContent_Declare(
    luau
    GIT_REPOSITORY https://github.com/luau-lang/luau.git
    GIT_TAG 0.654
    GIT_SHALLOW TRUE
  )
  FetchContent_MakeAvailable(luau)
endif()

# Memory + process detection + http live in client/overlay/src; share them
# rather than duplicating to keep one source of truth for the kernel bridge
# and the WinHTTP wrapper.
set(SHARED_SRC_DIR "${CMAKE_CURRENT_SOURCE_DIR}/../overlay/src")

add_executable(verdant_executor
  src/main.cpp
  src/server.cpp
  src/poller.cpp
  src/runtime.cpp
  ${SHARED_SRC_DIR}/memory.cpp
  ${SHARED_SRC_DIR}/process.cpp
  ${SHARED_SRC_DIR}/http.cpp
)

target_include_directories(verdant_executor PRIVATE
  src
  ${SHARED_SRC_DIR}
)

target_link_libraries(verdant_executor PRIVATE
  nlohmann_json::nlohmann_json
  user32
  ws2_32
  winhttp
)

if(VERDANT_EMBED_LUAU)
  target_link_libraries(verdant_executor PRIVATE
    Luau.Compiler
    Luau.VM
  )
  target_compile_definitions(verdant_executor PRIVATE VERDANT_HAVE_LUAU=1)
endif()

target_compile_definitions(verdant_executor PRIVATE
  UNICODE
  _UNICODE
  NOMINMAX
  WIN32_LEAN_AND_MEAN
  _WIN32_WINNT=0x0A00
)

if(MSVC)
  target_compile_options(verdant_executor PRIVATE /W3 /utf-8)
endif()
