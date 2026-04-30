cmake_minimum_required(VERSION 3.20)
project(verdant_overlay LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

if(NOT WIN32)
  message(WARNING "verdant_overlay is Windows-only; skipping target.")
  return()
endif()

include(FetchContent)
FetchContent_Declare(
  nlohmann_json
  GIT_REPOSITORY https://github.com/nlohmann/json.git
  GIT_TAG v3.11.3
  GIT_SHALLOW TRUE
)
FetchContent_MakeAvailable(nlohmann_json)

add_executable(verdant_overlay WIN32
  src/main.cpp
  src/overlay.cpp
  src/hud_painter.cpp
  src/overlay_input_adapter.cpp
  src/aim_assist.cpp
  src/win32_mouse_input.cpp
  src/process.cpp
  src/memory.cpp
  src/explorer.cpp
  src/chat.cpp
  src/http.cpp
)

target_include_directories(verdant_overlay PRIVATE src)

target_link_libraries(verdant_overlay PRIVATE
  nlohmann_json::nlohmann_json
  d2d1
  dwrite
  dxgi
  user32
  gdi32
  winhttp
  shcore
  dwmapi
  shell32
  ole32
)

target_compile_definitions(verdant_overlay PRIVATE
  UNICODE
  _UNICODE
  NOMINMAX
  WIN32_LEAN_AND_MEAN
  _WIN32_WINNT=0x0A00
)

if(MSVC)
  target_compile_options(verdant_overlay PRIVATE /W3 /utf-8)
endif()
