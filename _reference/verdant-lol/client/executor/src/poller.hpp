#pragma once

#include <atomic>
#include <chrono>
#include <functional>
#include <mutex>
#include <string>
#include <thread>

#include "http.hpp"

namespace verdant {

struct PullJob {
  std::string queueId;
  std::string hwid;
  std::string type;
  std::string script;
  std::string name;
};

struct AckResult {
  bool success{false};
  std::string output;
  std::string error;
};

using JobHandler = std::function<AckResult(const PullJob&)>;

struct PollerConfig {
  std::wstring baseUrl;  // e.g. https://verdant.lol/api/executor
  std::wstring hwid;
  std::wstring license;
  std::wstring author;
  unsigned int waitSeconds{25};
};

// Long-poll loop against /pull?hwid=… on a background thread. When a job
// arrives the configured handler is invoked synchronously; its AckResult is
// POSTed to /ack so the server can record outcome.
class Poller {
 public:
  Poller(PollerConfig cfg, JobHandler handler);
  ~Poller();

  void start();
  void stop();

  std::wstring statusLine();

 private:
  void loop();
  bool pullOnce();
  void postAck(const PullJob& job, const AckResult& result);

  PollerConfig cfg_;
  JobHandler handler_;
  HttpClient http_;
  std::thread thread_;
  std::atomic<bool> running_{false};
  std::mutex mu_;
  std::wstring status_{L"idle"};
};

}  // namespace verdant
