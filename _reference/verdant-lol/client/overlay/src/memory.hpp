#pragma once

#include <cstddef>
#include <cstdint>

#ifdef _WIN32
#include <windows.h>
#endif

namespace verdant {

class MemoryBackend {
 public:
  virtual ~MemoryBackend() = default;

  virtual bool open() = 0;
  virtual void close() = 0;
  virtual bool isOpen() const = 0;

  virtual uint32_t getProcessId() const = 0;
  virtual void setProcessId(uint32_t pid) = 0;

  virtual bool read(uintptr_t address, void* out, std::size_t size) = 0;
  virtual bool write(uintptr_t address, const void* data, std::size_t size) = 0;

  template <typename T>
  bool readT(uintptr_t address, T& out) {
    return read(address, &out, sizeof(T));
  }
  template <typename T>
  bool writeT(uintptr_t address, const T& value) {
    return write(address, &value, sizeof(T));
  }
};

class UserModeBackend final : public MemoryBackend {
 public:
  ~UserModeBackend() override;

  bool open() override;
  void close() override;
  bool isOpen() const override { return handle_ != nullptr; }

  uint32_t getProcessId() const override { return pid_; }
  void setProcessId(uint32_t pid) override;

  bool read(uintptr_t address, void* out, std::size_t size) override;
  bool write(uintptr_t address, const void* data, std::size_t size) override;

 private:
  uint32_t pid_{0};
  HANDLE handle_{nullptr};
};

// IOCTL bridge to a separately-deployed signed kernel driver. Without the
// driver loaded the open() call returns false and the caller is expected to
// fall back to UserModeBackend. The default device path can be overridden via
// setDeviceName() for custom builds.
class KernelDriver final : public MemoryBackend {
 public:
  ~KernelDriver() override;

  bool open() override;
  void close() override;
  bool isOpen() const override {
    return device_ != INVALID_HANDLE_VALUE && device_ != nullptr;
  }

  uint32_t getProcessId() const override { return pid_; }
  void setProcessId(uint32_t pid) override;

  bool read(uintptr_t address, void* out, std::size_t size) override;
  bool write(uintptr_t address, const void* data, std::size_t size) override;

  void setDeviceName(const wchar_t* name) { deviceName_ = name; }

 private:
  bool attach();

  uint32_t pid_{0};
  HANDLE device_{INVALID_HANDLE_VALUE};
  const wchar_t* deviceName_{L"\\\\.\\VerdantKM"};
};

uintptr_t getModuleBase(uint32_t pid, const wchar_t* moduleName = nullptr);

}  // namespace verdant
