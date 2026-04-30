#include "server.hpp"

#include <winsock2.h>
#include <ws2tcpip.h>

#include <algorithm>
#include <cctype>
#include <cstring>
#include <sstream>
#include <vector>

#pragma comment(lib, "ws2_32.lib")

namespace verdant {

namespace {

constexpr size_t kMaxHeaderBytes = 16 * 1024;
constexpr size_t kMaxBodyBytes = 16 * 1024 * 1024;

std::string toLower(std::string s) {
  std::transform(s.begin(), s.end(), s.begin(),
                 [](unsigned char c) { return static_cast<char>(std::tolower(c)); });
  return s;
}

std::string trim(const std::string& s) {
  size_t a = 0;
  while (a < s.size() && std::isspace(static_cast<unsigned char>(s[a]))) ++a;
  size_t b = s.size();
  while (b > a && std::isspace(static_cast<unsigned char>(s[b - 1]))) --b;
  return s.substr(a, b - a);
}

bool readUntilHeaderEnd(SOCKET s, std::string& out) {
  out.clear();
  char buf[2048];
  for (;;) {
    int n = recv(s, buf, sizeof(buf), 0);
    if (n <= 0) return false;
    out.append(buf, buf + n);
    if (out.size() > kMaxHeaderBytes) return false;
    if (out.find("\r\n\r\n") != std::string::npos) return true;
  }
}

bool parseRequest(const std::string& raw, HttpRequest& req, size_t& headerEnd) {
  headerEnd = raw.find("\r\n\r\n");
  if (headerEnd == std::string::npos) return false;
  std::string head = raw.substr(0, headerEnd);
  std::istringstream iss(head);
  std::string line;
  if (!std::getline(iss, line)) return false;
  if (!line.empty() && line.back() == '\r') line.pop_back();
  std::istringstream startLine(line);
  std::string version;
  if (!(startLine >> req.method >> req.path >> version)) return false;
  while (std::getline(iss, line)) {
    if (!line.empty() && line.back() == '\r') line.pop_back();
    if (line.empty()) continue;
    auto colon = line.find(':');
    if (colon == std::string::npos) continue;
    req.headers[toLower(line.substr(0, colon))] = trim(line.substr(colon + 1));
  }
  headerEnd += 4;
  return true;
}

bool readBody(SOCKET s, std::string& body, size_t expected, std::string& already) {
  body = already;
  if (body.size() >= expected) {
    body.resize(expected);
    return true;
  }
  body.reserve(expected);
  std::vector<char> buf(8192);
  while (body.size() < expected) {
    int want = static_cast<int>(std::min(buf.size(), expected - body.size()));
    int n = recv(s, buf.data(), want, 0);
    if (n <= 0) return false;
    body.append(buf.data(), buf.data() + n);
  }
  return true;
}

std::string statusText(int code) {
  switch (code) {
    case 200: return "OK";
    case 400: return "Bad Request";
    case 404: return "Not Found";
    case 413: return "Payload Too Large";
    case 500: return "Internal Server Error";
    default: return "OK";
  }
}

bool sendAll(SOCKET s, const char* data, size_t size) {
  size_t sent = 0;
  while (sent < size) {
    int n = send(s, data + sent, static_cast<int>(size - sent), 0);
    if (n <= 0) return false;
    sent += static_cast<size_t>(n);
  }
  return true;
}

bool sendReply(SOCKET s, const HttpReply& reply) {
  std::ostringstream oss;
  oss << "HTTP/1.1 " << reply.status << " " << statusText(reply.status) << "\r\n"
      << "Content-Type: " << reply.contentType << "\r\n"
      << "Content-Length: " << reply.body.size() << "\r\n"
      << "Connection: close\r\n"
      << "\r\n";
  std::string header = oss.str();
  if (!sendAll(s, header.data(), header.size())) return false;
  if (!reply.body.empty() && !sendAll(s, reply.body.data(), reply.body.size())) return false;
  return true;
}

}  // namespace

HttpServer::HttpServer() {
  WSADATA wsa{};
  WSAStartup(MAKEWORD(2, 2), &wsa);
}

HttpServer::~HttpServer() {
  stop();
  WSACleanup();
}

void HttpServer::route(const std::string& method, const std::string& path, HttpHandler handler) {
  routes_[method + " " + path] = std::move(handler);
}

HttpReply HttpServer::dispatch(const HttpRequest& req) {
  auto it = routes_.find(req.method + " " + req.path);
  if (it == routes_.end()) {
    HttpReply r;
    r.status = 404;
    r.body = "not found";
    return r;
  }
  try {
    return it->second(req);
  } catch (const std::exception& e) {
    HttpReply r;
    r.status = 500;
    r.body = std::string("error: ") + e.what();
    return r;
  }
}

bool HttpServer::handleClient(uintptr_t sock) {
  SOCKET s = static_cast<SOCKET>(sock);
  std::string raw;
  if (!readUntilHeaderEnd(s, raw)) {
    closesocket(s);
    return false;
  }
  HttpRequest req;
  size_t headerEnd = 0;
  if (!parseRequest(raw, req, headerEnd)) {
    HttpReply r;
    r.status = 400;
    r.body = "bad request";
    sendReply(s, r);
    closesocket(s);
    return false;
  }
  size_t contentLength = 0;
  auto cl = req.headers.find("content-length");
  if (cl != req.headers.end()) {
    try {
      contentLength = std::stoull(cl->second);
    } catch (...) {
      contentLength = 0;
    }
  }
  if (contentLength > kMaxBodyBytes) {
    HttpReply r;
    r.status = 413;
    r.body = "payload too large";
    sendReply(s, r);
    closesocket(s);
    return false;
  }
  if (contentLength > 0) {
    std::string already = raw.substr(headerEnd);
    if (!readBody(s, req.body, contentLength, already)) {
      closesocket(s);
      return false;
    }
  }
  HttpReply reply = dispatch(req);
  sendReply(s, reply);
  closesocket(s);
  return true;
}

bool HttpServer::listenAndServe(unsigned short port) {
  SOCKET listener = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
  if (listener == INVALID_SOCKET) return false;

  int opt = 1;
  setsockopt(listener, SOL_SOCKET, SO_REUSEADDR, reinterpret_cast<const char*>(&opt), sizeof(opt));

  sockaddr_in addr{};
  addr.sin_family = AF_INET;
  addr.sin_port = htons(port);
  inet_pton(AF_INET, "127.0.0.1", &addr.sin_addr);

  if (bind(listener, reinterpret_cast<sockaddr*>(&addr), sizeof(addr)) == SOCKET_ERROR) {
    closesocket(listener);
    return false;
  }
  if (listen(listener, SOMAXCONN) == SOCKET_ERROR) {
    closesocket(listener);
    return false;
  }

  listenSocket_ = listener;
  running_.store(true);
  while (running_.load()) {
    sockaddr_in client{};
    int clen = sizeof(client);
    SOCKET s = accept(listener, reinterpret_cast<sockaddr*>(&client), &clen);
    if (s == INVALID_SOCKET) {
      if (!running_.load()) break;
      continue;
    }
    handleClient(static_cast<uintptr_t>(s));
  }
  closesocket(listener);
  listenSocket_ = (uintptr_t)-1;
  return true;
}

void HttpServer::stop() {
  if (!running_.exchange(false)) return;
  if (listenSocket_ != (uintptr_t)-1) {
    closesocket(static_cast<SOCKET>(listenSocket_));
  }
}

}  // namespace verdant
