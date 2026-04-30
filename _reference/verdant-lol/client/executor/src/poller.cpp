#include "poller.hpp"

#include <windows.h>

#include <iostream>
#include <nlohmann/json.hpp>
#include <sstream>

using nlohmann::json;

namespace verdant {

namespace {

std::string wideToUtf8(const std::wstring& s) {
  if (s.empty()) return "";
  int len = WideCharToMultiByte(CP_UTF8, 0, s.data(), static_cast<int>(s.size()), nullptr, 0,
                                nullptr, nullptr);
  std::string out(static_cast<size_t>(len), '\0');
  WideCharToMultiByte(CP_UTF8, 0, s.data(), static_cast<int>(s.size()), out.data(), len, nullptr,
                      nullptr);
  return out;
}

}  // namespace

Poller::Poller(PollerConfig cfg, JobHandler handler)
    : cfg_(std::move(cfg)), handler_(std::move(handler)) {}

Poller::~Poller() { stop(); }

void Poller::start() {
  bool expected = false;
  if (!running_.compare_exchange_strong(expected, true)) return;
  thread_ = std::thread(&Poller::loop, this);
}

void Poller::stop() {
  if (!running_.exchange(false)) return;
  if (thread_.joinable()) thread_.join();
}

std::wstring Poller::statusLine() {
  std::lock_guard<std::mutex> lk(mu_);
  return status_;
}

void Poller::loop() {
  if (cfg_.baseUrl.empty() || cfg_.hwid.empty()) {
    std::lock_guard<std::mutex> lk(mu_);
    status_ = L"disabled (mangler baseUrl/hwid)";
    return;
  }
  while (running_.load()) {
    bool ok = pullOnce();
    if (!ok) {
      // Back off briefly on transport errors so we don't hammer the server.
      for (int i = 0; i < 30 && running_.load(); ++i) {
        std::this_thread::sleep_for(std::chrono::milliseconds(100));
      }
    }
  }
}

bool Poller::pullOnce() {
  std::wstringstream qs;
  qs << cfg_.baseUrl << L"/pull?hwid=" << cfg_.hwid << L"&wait=" << cfg_.waitSeconds;
  std::wstring url = qs.str();

  std::vector<HttpHeader> headers;
  headers.push_back({L"X-Verdant-HWID", cfg_.hwid});
  if (!cfg_.license.empty()) headers.push_back({L"X-Verdant-License", cfg_.license});
  if (!cfg_.author.empty()) headers.push_back({L"X-Verdant-Author", cfg_.author});
  headers.push_back({L"Accept", L"application/json"});

  HttpResponse res = http_.request(L"GET", url, headers, "");
  if (!res.error.empty()) {
    std::lock_guard<std::mutex> lk(mu_);
    status_ = L"transport error: " + res.error;
    return false;
  }

  if (res.status == 204) {
    std::lock_guard<std::mutex> lk(mu_);
    status_ = L"polling (204 timeout)";
    return true;
  }
  if (!res.ok()) {
    std::lock_guard<std::mutex> lk(mu_);
    status_ = L"server " + std::to_wstring(res.status);
    return false;
  }

  PullJob job;
  try {
    json j = json::parse(res.body);
    if (j.contains("queue_id") && j["queue_id"].is_string()) job.queueId = j["queue_id"].get<std::string>();
    if (j.contains("hwid") && j["hwid"].is_string()) job.hwid = j["hwid"].get<std::string>();
    if (j.contains("type") && j["type"].is_string()) job.type = j["type"].get<std::string>();
    if (j.contains("script") && j["script"].is_string()) job.script = j["script"].get<std::string>();
    if (j.contains("name") && j["name"].is_string()) job.name = j["name"].get<std::string>();
  } catch (const std::exception& e) {
    std::lock_guard<std::mutex> lk(mu_);
    status_ = L"json parse failed";
    (void)e;
    return false;
  }

  std::cout << "[poller] received job " << job.queueId << " (" << job.script.size() << " bytes, type="
            << job.type << ")" << std::endl;

  AckResult ack;
  if (handler_) {
    try {
      ack = handler_(job);
    } catch (const std::exception& e) {
      ack.success = false;
      ack.error = e.what();
    }
  } else {
    ack.success = false;
    ack.error = "no handler installed";
  }

  postAck(job, ack);
  {
    std::lock_guard<std::mutex> lk(mu_);
    status_ = L"executed " + std::wstring(ack.success ? L"ok" : L"failed") + L" (" +
              std::to_wstring(job.script.size()) + L" bytes)";
  }
  return true;
}

void Poller::postAck(const PullJob& job, const AckResult& result) {
  json payload = {
      {"queue_id", job.queueId},
      {"hwid", job.hwid.empty() ? wideToUtf8(cfg_.hwid) : job.hwid},
      {"success", result.success},
  };
  if (!result.output.empty()) payload["output"] = result.output;
  if (!result.error.empty()) payload["error"] = result.error;

  std::wstring url = cfg_.baseUrl + L"/ack";
  std::vector<HttpHeader> headers;
  headers.push_back({L"X-Verdant-HWID", cfg_.hwid});
  if (!cfg_.license.empty()) headers.push_back({L"X-Verdant-License", cfg_.license});
  headers.push_back({L"Content-Type", L"application/json"});
  http_.request(L"POST", url, headers, payload.dump());
}

}  // namespace verdant
