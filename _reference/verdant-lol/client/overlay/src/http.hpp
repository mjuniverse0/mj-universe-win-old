#pragma once

#include <string>
#include <utility>
#include <vector>

namespace verdant {

struct HttpHeader {
  std::wstring name;
  std::wstring value;
};

struct HttpResponse {
  int status{0};
  std::string body;
  std::wstring error;  // Non-empty when the call failed before a status was received.

  bool ok() const { return status >= 200 && status < 300; }
};

class HttpClient {
 public:
  HttpClient();
  ~HttpClient();

  HttpClient(const HttpClient&) = delete;
  HttpClient& operator=(const HttpClient&) = delete;

  HttpResponse request(const std::wstring& method, const std::wstring& url,
                       const std::vector<HttpHeader>& headers, const std::string& body);

 private:
  void* session_{nullptr};
};

}  // namespace verdant
