#include "http.hpp"

#include <windows.h>
#include <winhttp.h>

#include <sstream>

namespace verdant {

namespace {

struct ParsedUrl {
  std::wstring host;
  std::wstring path;
  INTERNET_PORT port{0};
  bool https{false};
};

bool parseUrl(const std::wstring& url, ParsedUrl& out) {
  URL_COMPONENTSW c{};
  c.dwStructSize = sizeof(c);
  wchar_t hostBuf[256] = {0};
  wchar_t pathBuf[2048] = {0};
  c.lpszHostName = hostBuf;
  c.dwHostNameLength = 256;
  c.lpszUrlPath = pathBuf;
  c.dwUrlPathLength = 2048;
  if (!WinHttpCrackUrl(url.c_str(), 0, 0, &c)) return false;
  out.host.assign(hostBuf, c.dwHostNameLength);
  out.path.assign(pathBuf, c.dwUrlPathLength);
  if (out.path.empty()) out.path = L"/";
  out.port = c.nPort;
  out.https = (c.nScheme == INTERNET_SCHEME_HTTPS);
  return true;
}

std::wstring buildHeaderBlock(const std::vector<HttpHeader>& headers) {
  std::wstring out;
  for (const auto& h : headers) {
    out += h.name;
    out += L": ";
    out += h.value;
    out += L"\r\n";
  }
  return out;
}

std::wstring lastErrorMessage() {
  DWORD err = GetLastError();
  std::wstringstream ss;
  ss << L"WinHTTP error " << err;
  return ss.str();
}

}  // namespace

HttpClient::HttpClient() {
  session_ = WinHttpOpen(L"VerdantOverlay/1.0", WINHTTP_ACCESS_TYPE_AUTOMATIC_PROXY,
                         WINHTTP_NO_PROXY_NAME, WINHTTP_NO_PROXY_BYPASS, 0);
}

HttpClient::~HttpClient() {
  if (session_) WinHttpCloseHandle(session_);
}

HttpResponse HttpClient::request(const std::wstring& method, const std::wstring& url,
                                 const std::vector<HttpHeader>& headers, const std::string& body) {
  HttpResponse res;

  if (!session_) {
    res.error = L"Session not initialized";
    return res;
  }

  ParsedUrl pu;
  if (!parseUrl(url, pu)) {
    res.error = L"Failed to parse URL";
    return res;
  }

  HINTERNET conn = WinHttpConnect(session_, pu.host.c_str(), pu.port, 0);
  if (!conn) {
    res.error = lastErrorMessage();
    return res;
  }

  DWORD flags = pu.https ? WINHTTP_FLAG_SECURE : 0;
  HINTERNET req = WinHttpOpenRequest(conn, method.c_str(), pu.path.c_str(), nullptr,
                                     WINHTTP_NO_REFERER, WINHTTP_DEFAULT_ACCEPT_TYPES, flags);
  if (!req) {
    res.error = lastErrorMessage();
    WinHttpCloseHandle(conn);
    return res;
  }

  std::wstring headerBlock = buildHeaderBlock(headers);
  const wchar_t* hdrs = headerBlock.empty() ? WINHTTP_NO_ADDITIONAL_HEADERS : headerBlock.c_str();
  DWORD hdrLen = headerBlock.empty() ? 0 : static_cast<DWORD>(-1L);

  BOOL sent = WinHttpSendRequest(req, hdrs, hdrLen,
                                 body.empty() ? WINHTTP_NO_REQUEST_DATA
                                              : const_cast<char*>(body.data()),
                                 static_cast<DWORD>(body.size()),
                                 static_cast<DWORD>(body.size()), 0);
  if (!sent) {
    res.error = lastErrorMessage();
    WinHttpCloseHandle(req);
    WinHttpCloseHandle(conn);
    return res;
  }

  if (!WinHttpReceiveResponse(req, nullptr)) {
    res.error = lastErrorMessage();
    WinHttpCloseHandle(req);
    WinHttpCloseHandle(conn);
    return res;
  }

  DWORD status = 0;
  DWORD statusSize = sizeof(status);
  WinHttpQueryHeaders(req, WINHTTP_QUERY_STATUS_CODE | WINHTTP_QUERY_FLAG_NUMBER,
                      WINHTTP_HEADER_NAME_BY_INDEX, &status, &statusSize, WINHTTP_NO_HEADER_INDEX);
  res.status = static_cast<int>(status);

  for (;;) {
    DWORD avail = 0;
    if (!WinHttpQueryDataAvailable(req, &avail)) break;
    if (avail == 0) break;
    std::string chunk(avail, '\0');
    DWORD read = 0;
    if (!WinHttpReadData(req, chunk.data(), avail, &read)) break;
    chunk.resize(read);
    res.body.append(chunk);
  }

  WinHttpCloseHandle(req);
  WinHttpCloseHandle(conn);
  return res;
}

}  // namespace verdant
