#pragma once

#include <atomic>
#include <chrono>
#include <cstdint>
#include <deque>
#include <mutex>
#include <string>
#include <thread>
#include <vector>

#include "http.hpp"

namespace verdant {

struct ChatMessage {
  int64_t id{0};
  std::string authorId;
  std::string authorName;
  std::string body;
  std::string createdAt;  // ISO-8601 string from Supabase

  // Convenience UTF-8 / wide getters used by the renderer.
  std::wstring wideAuthor() const;
  std::wstring wideBody() const;
};

struct ChatConfig {
  std::wstring supabaseUrl;       // e.g. https://abcd.supabase.co
  std::wstring supabaseAnonKey;
  std::wstring roomId;
  std::wstring authorId;
  std::wstring authorName;
  std::chrono::milliseconds pollInterval{std::chrono::milliseconds(2000)};
  size_t historyLimit{100};
};

// Background-polling Supabase REST chat client. The producer thread fetches new
// rows since the last seen id; the UI thread snapshots the buffer via
// snapshotMessages(). sendMessage() is synchronous from the caller's
// perspective and inserts a single row via PostgREST.
class SupabaseChat {
 public:
  explicit SupabaseChat(ChatConfig config);
  ~SupabaseChat();

  SupabaseChat(const SupabaseChat&) = delete;
  SupabaseChat& operator=(const SupabaseChat&) = delete;

  void start();
  void stop();

  bool sendMessage(const std::wstring& text);

  std::vector<ChatMessage> snapshotMessages();

  std::wstring statusLine() const;

 private:
  void pollLoop();
  bool fetchOnce();

  ChatConfig config_;
  HttpClient http_;

  std::thread thread_;
  std::atomic<bool> running_{false};

  mutable std::mutex mu_;
  std::deque<ChatMessage> buffer_;
  int64_t lastId_{0};
  std::wstring status_{L"Inactive"};
};

}  // namespace verdant
