#include "chat.hpp"

#include <windows.h>

#include <algorithm>
#include <nlohmann/json.hpp>
#include <sstream>

using nlohmann::json;

namespace verdant {

namespace {

std::wstring utf8ToWide(const std::string& s) {
  if (s.empty()) return L"";
  int len = MultiByteToWideChar(CP_UTF8, 0, s.data(), static_cast<int>(s.size()), nullptr, 0);
  std::wstring out(static_cast<size_t>(len), L'\0');
  MultiByteToWideChar(CP_UTF8, 0, s.data(), static_cast<int>(s.size()), out.data(), len);
  return out;
}

std::string wideToUtf8(const std::wstring& s) {
  if (s.empty()) return "";
  int len =
      WideCharToMultiByte(CP_UTF8, 0, s.data(), static_cast<int>(s.size()), nullptr, 0, nullptr, nullptr);
  std::string out(static_cast<size_t>(len), '\0');
  WideCharToMultiByte(CP_UTF8, 0, s.data(), static_cast<int>(s.size()), out.data(), len, nullptr,
                      nullptr);
  return out;
}

}  // namespace

std::wstring ChatMessage::wideAuthor() const { return utf8ToWide(authorName); }
std::wstring ChatMessage::wideBody() const { return utf8ToWide(body); }

SupabaseChat::SupabaseChat(ChatConfig config) : config_(std::move(config)) {}

SupabaseChat::~SupabaseChat() { stop(); }

void SupabaseChat::start() {
  bool expected = false;
  if (!running_.compare_exchange_strong(expected, true)) return;
  thread_ = std::thread(&SupabaseChat::pollLoop, this);
}

void SupabaseChat::stop() {
  if (!running_.exchange(false)) return;
  if (thread_.joinable()) thread_.join();
}

std::vector<ChatMessage> SupabaseChat::snapshotMessages() {
  std::lock_guard<std::mutex> lk(mu_);
  return std::vector<ChatMessage>(buffer_.begin(), buffer_.end());
}

std::wstring SupabaseChat::statusLine() const {
  std::lock_guard<std::mutex> lk(mu_);
  return status_;
}

void SupabaseChat::pollLoop() {
  // Initial fetch should pull recent history once, then incremental.
  while (running_.load()) {
    fetchOnce();
    auto deadline = std::chrono::steady_clock::now() + config_.pollInterval;
    while (running_.load() && std::chrono::steady_clock::now() < deadline) {
      std::this_thread::sleep_for(std::chrono::milliseconds(50));
    }
  }
}

bool SupabaseChat::fetchOnce() {
  if (config_.supabaseUrl.empty() || config_.supabaseAnonKey.empty() || config_.roomId.empty()) {
    std::lock_guard<std::mutex> lk(mu_);
    status_ = L"Mangler SUPABASE_URL / KEY / ROOM_ID";
    return false;
  }

  std::wstringstream qs;
  qs << config_.supabaseUrl << L"/rest/v1/chat_messages?room_id=eq." << config_.roomId
     << L"&order=id.asc&limit=" << config_.historyLimit;
  if (lastId_ > 0) qs << L"&id=gt." << lastId_;
  std::wstring url = qs.str();

  std::vector<HttpHeader> headers = {
      {L"apikey", config_.supabaseAnonKey},
      {L"Authorization", L"Bearer " + config_.supabaseAnonKey},
      {L"Accept", L"application/json"},
  };

  HttpResponse res = http_.request(L"GET", url, headers, "");
  if (!res.error.empty()) {
    std::lock_guard<std::mutex> lk(mu_);
    status_ = L"Nettverksfeil: " + res.error;
    return false;
  }
  if (!res.ok()) {
    std::lock_guard<std::mutex> lk(mu_);
    status_ = L"Supabase-svar: HTTP " + std::to_wstring(res.status);
    return false;
  }

  std::vector<ChatMessage> incoming;
  try {
    json arr = json::parse(res.body);
    if (!arr.is_array()) {
      std::lock_guard<std::mutex> lk(mu_);
      status_ = L"Uventet svarformat";
      return false;
    }
    incoming.reserve(arr.size());
    for (const auto& row : arr) {
      ChatMessage m;
      if (row.contains("id") && row["id"].is_number_integer()) m.id = row["id"].get<int64_t>();
      if (row.contains("author_id") && row["author_id"].is_string())
        m.authorId = row["author_id"].get<std::string>();
      if (row.contains("author_name") && row["author_name"].is_string())
        m.authorName = row["author_name"].get<std::string>();
      if (row.contains("body") && row["body"].is_string())
        m.body = row["body"].get<std::string>();
      if (row.contains("created_at") && row["created_at"].is_string())
        m.createdAt = row["created_at"].get<std::string>();
      incoming.push_back(std::move(m));
    }
  } catch (const std::exception& e) {
    std::lock_guard<std::mutex> lk(mu_);
    status_ = L"JSON-feil";
    (void)e;
    return false;
  }

  if (!incoming.empty()) {
    std::lock_guard<std::mutex> lk(mu_);
    for (auto& m : incoming) {
      if (m.id > lastId_) lastId_ = m.id;
      buffer_.push_back(std::move(m));
    }
    while (buffer_.size() > config_.historyLimit) buffer_.pop_front();
  }

  {
    std::lock_guard<std::mutex> lk(mu_);
    status_ = L"Tilkoblet (" + std::to_wstring(buffer_.size()) + L" meldinger)";
  }
  return true;
}

bool SupabaseChat::sendMessage(const std::wstring& text) {
  if (text.empty()) return false;
  if (config_.supabaseUrl.empty() || config_.supabaseAnonKey.empty() || config_.roomId.empty()) {
    return false;
  }

  json payload = {
      {"room_id", wideToUtf8(config_.roomId)},
      {"author_id", wideToUtf8(config_.authorId)},
      {"author_name", wideToUtf8(config_.authorName)},
      {"body", wideToUtf8(text)},
  };

  std::wstring url = config_.supabaseUrl + L"/rest/v1/chat_messages";
  std::vector<HttpHeader> headers = {
      {L"apikey", config_.supabaseAnonKey},
      {L"Authorization", L"Bearer " + config_.supabaseAnonKey},
      {L"Content-Type", L"application/json"},
      {L"Prefer", L"return=minimal"},
  };

  HttpResponse res = http_.request(L"POST", url, headers, payload.dump());
  if (!res.ok()) {
    std::lock_guard<std::mutex> lk(mu_);
    status_ = L"Send feilet: HTTP " + std::to_wstring(res.status);
    return false;
  }
  return true;
}

}  // namespace verdant
