#include "memory.hpp"

#include <cstring>
#include <string>
#include <vector>

#ifdef _WIN32
#include <winsvc.h>
#include <tlhelp32.h>
#include <winioctl.h>
#endif

namespace verdant {

UserModeBackend::~UserModeBackend() { close(); }

bool UserModeBackend::open() {
  if (pid_ == 0) return false;
  if (handle_) return true;
  handle_ = OpenProcess(PROCESS_VM_READ | PROCESS_VM_WRITE | PROCESS_VM_OPERATION |
                            PROCESS_QUERY_INFORMATION,
                        FALSE, pid_);
  return handle_ != nullptr;
}

void UserModeBackend::close() {
  if (handle_) {
    CloseHandle(handle_);
    handle_ = nullptr;
  }
}

void UserModeBackend::setProcessId(uint32_t pid) {
  if (pid != pid_) {
    close();
    pid_ = pid;
  }
}

bool UserModeBackend::read(uintptr_t address, void* out, std::size_t size) {
  if (!handle_) return false;
  SIZE_T got = 0;
  return ReadProcessMemory(handle_, reinterpret_cast<LPCVOID>(address), out, size, &got) != 0 &&
         got == size;
}

bool UserModeBackend::write(uintptr_t address, const void* data, std::size_t size) {
  if (!handle_) return false;
  SIZE_T put = 0;
  return WriteProcessMemory(handle_, reinterpret_cast<LPVOID>(address), data, size, &put) != 0 &&
         put == size;
}

namespace {

constexpr DWORD kVkmDeviceType = 0x8000;
constexpr wchar_t kVkmServiceName[] = L"VerdantKM";

constexpr DWORD vkmIoctl(DWORD fn) {
  return CTL_CODE(kVkmDeviceType, 0x800 + fn, METHOD_BUFFERED, FILE_ANY_ACCESS);
}

constexpr DWORD kVkmIoctlAttach = 0;
constexpr DWORD kVkmIoctlRead = 1;
constexpr DWORD kVkmIoctlWrite = 2;

#pragma pack(push, 1)
struct VkmAttachRequest {
  uint32_t pid;
};

struct VkmRwHeader {
  uint32_t pid;
  uint64_t address;
  uint64_t size;
};
#pragma pack(pop)

std::wstring readWideEnv(const wchar_t* key) {
  wchar_t buf[2048];
  const DWORD n = GetEnvironmentVariableW(key, buf, 2048);
  if (n == 0 || n >= 2048) return {};
  return std::wstring(buf, n);
}

bool waitForServiceRunning(SC_HANDLE service) {
  SERVICE_STATUS_PROCESS ssp{};
  DWORD needed = 0;
  for (int i = 0; i < 30; ++i) {
    if (!QueryServiceStatusEx(service, SC_STATUS_PROCESS_INFO,
                              reinterpret_cast<LPBYTE>(&ssp), sizeof(ssp), &needed)) {
      return false;
    }
    if (ssp.dwCurrentState == SERVICE_RUNNING) return true;
    if (ssp.dwCurrentState != SERVICE_START_PENDING) return false;
    Sleep(100);
  }
  return false;
}

bool ensureKernelServiceReady(const std::wstring& binaryPath) {
  SC_HANDLE scm = OpenSCManagerW(nullptr, nullptr, SC_MANAGER_CONNECT | SC_MANAGER_CREATE_SERVICE);
  if (!scm) return false;

  SC_HANDLE service = OpenServiceW(scm, kVkmServiceName,
                                   SERVICE_QUERY_STATUS | SERVICE_START | SERVICE_STOP);
  if (!service && !binaryPath.empty()) {
    service = CreateServiceW(scm, kVkmServiceName, kVkmServiceName, SERVICE_QUERY_STATUS | SERVICE_START,
                             SERVICE_KERNEL_DRIVER, SERVICE_DEMAND_START, SERVICE_ERROR_NORMAL,
                             binaryPath.c_str(), nullptr, nullptr, nullptr, nullptr, nullptr);
  }

  if (!service) {
    CloseServiceHandle(scm);
    return false;
  }

  SERVICE_STATUS_PROCESS ssp{};
  DWORD needed = 0;
  bool ok = QueryServiceStatusEx(service, SC_STATUS_PROCESS_INFO,
                                 reinterpret_cast<LPBYTE>(&ssp), sizeof(ssp), &needed) != 0;
  if (!ok) {
    CloseServiceHandle(service);
    CloseServiceHandle(scm);
    return false;
  }

  if (ssp.dwCurrentState == SERVICE_STOPPED) {
    if (!StartServiceW(service, 0, nullptr)) {
      const DWORD err = GetLastError();
      if (err != ERROR_SERVICE_ALREADY_RUNNING) {
        CloseServiceHandle(service);
        CloseServiceHandle(scm);
        return false;
      }
    }
    ok = waitForServiceRunning(service);
  } else {
    ok = (ssp.dwCurrentState == SERVICE_RUNNING || ssp.dwCurrentState == SERVICE_START_PENDING);
    if (ssp.dwCurrentState == SERVICE_START_PENDING) ok = waitForServiceRunning(service);
  }

  CloseServiceHandle(service);
  CloseServiceHandle(scm);
  return ok;
}

}  // namespace

KernelDriver::~KernelDriver() { close(); }

bool KernelDriver::open() {
  if (isOpen()) return true;

  // Optional auto-load path:
  // set VERDANTKM_SYS_PATH to allow service creation when it is missing.
  // Without admin rights this still fails safely and open() returns false.
  const std::wstring sysPath = readWideEnv(L"VERDANTKM_SYS_PATH");
  ensureKernelServiceReady(sysPath);

  device_ = CreateFileW(deviceName_, GENERIC_READ | GENERIC_WRITE,
                        FILE_SHARE_READ | FILE_SHARE_WRITE, nullptr, OPEN_EXISTING, 0, nullptr);
  if (device_ == INVALID_HANDLE_VALUE) return false;
  if (pid_ != 0) attach();
  return true;
}

void KernelDriver::close() {
  if (isOpen()) {
    CloseHandle(device_);
    device_ = INVALID_HANDLE_VALUE;
  }
}

void KernelDriver::setProcessId(uint32_t pid) {
  pid_ = pid;
  if (isOpen() && pid_ != 0) attach();
}

bool KernelDriver::attach() {
  VkmAttachRequest req{pid_};
  DWORD ret = 0;
  return DeviceIoControl(device_, vkmIoctl(kVkmIoctlAttach), &req, sizeof(req), nullptr, 0, &ret,
                         nullptr) != 0;
}

bool KernelDriver::read(uintptr_t address, void* out, std::size_t size) {
  if (!isOpen() || pid_ == 0) return false;
  VkmRwHeader req{pid_, static_cast<uint64_t>(address), static_cast<uint64_t>(size)};
  DWORD ret = 0;
  return DeviceIoControl(device_, vkmIoctl(kVkmIoctlRead), &req, sizeof(req), out,
                         static_cast<DWORD>(size), &ret, nullptr) != 0 &&
         ret == size;
}

bool KernelDriver::write(uintptr_t address, const void* data, std::size_t size) {
  if (!isOpen() || pid_ == 0) return false;
  std::vector<uint8_t> buf(sizeof(VkmRwHeader) + size);
  VkmRwHeader hdr{pid_, static_cast<uint64_t>(address), static_cast<uint64_t>(size)};
  std::memcpy(buf.data(), &hdr, sizeof(hdr));
  std::memcpy(buf.data() + sizeof(hdr), data, size);
  DWORD ret = 0;
  return DeviceIoControl(device_, vkmIoctl(kVkmIoctlWrite), buf.data(),
                         static_cast<DWORD>(buf.size()), nullptr, 0, &ret, nullptr) != 0;
}

uintptr_t getModuleBase(uint32_t pid, const wchar_t* moduleName) {
  HANDLE snap = CreateToolhelp32Snapshot(TH32CS_SNAPMODULE | TH32CS_SNAPMODULE32, pid);
  if (snap == INVALID_HANDLE_VALUE) return 0;
  MODULEENTRY32W me{};
  me.dwSize = sizeof(me);
  uintptr_t base = 0;
  if (Module32FirstW(snap, &me)) {
    do {
      if (!moduleName || _wcsicmp(me.szModule, moduleName) == 0) {
        base = reinterpret_cast<uintptr_t>(me.modBaseAddr);
        break;
      }
    } while (Module32NextW(snap, &me));
  }
  CloseHandle(snap);
  return base;
}

}  // namespace verdant
