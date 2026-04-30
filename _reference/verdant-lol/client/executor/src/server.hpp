#pragma once

#include <atomic>
#include <functional>
#include <string>
#include <unordered_map>

namespace verdant {

struct HttpRequest {
  std::string method;
  std::string path;
  std::string body;
  std::unordered_map<std::string, std::string> headers;
};

struct HttpReply {
  int status{200};
  std::string contentType{"text/plain; charset=utf-8"};
  std::string body;
};

using HttpHandler = std::function<HttpReply(const HttpRequest&)>;

// Minimal blocking single-threaded HTTP/1.1 server bound to 127.0.0.1.
// Routes are matched by (method, path) - exact match. Anything else returns
// 404. Requests with Content-Length > 16 MiB are rejected.
class HttpServer {
 public:
  HttpServer();
  ~HttpServer();

  HttpServer(const HttpServer&) = delete;
  HttpServer& operator=(const HttpServer&) = delete;

  void route(const std::string& method, const std::string& path, HttpHandler handler);

  // Binds and serves forever. Returns when stop() is called from another
  // thread or on a fatal listen/accept error. Returns false if the socket
  // could not be bound.
  bool listenAndServe(unsigned short port);

  void stop();

 private:
  bool handleClient(uintptr_t socket);
  HttpReply dispatch(const HttpRequest& req);

  std::unordered_map<std::string, HttpHandler> routes_;
  std::atomic<bool> running_{false};
  uintptr_t listenSocket_{(uintptr_t)-1};
};

}  // namespace verdant
