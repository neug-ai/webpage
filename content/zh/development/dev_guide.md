# 开发者指南

### 从源码构建

从源码编译 NeuG 需要安装特定的依赖和工具。


由于几乎所有依赖都已作为第三方库包含在 NeuG 仓库中，你只需安装几个基础包即可在本地构建 NeuG。

#### 在 Ubuntu 上

```bash
sudo apt-get update
sudo apt-get install -y build-essential cmake git python3-dev python3-pip g++ make libssl-dev openssl
```

#### 在 macOS 上

```bash
brew update
brew install cmake git python3 openssl@3

# 无需安装 g++，因为也支持 Apple Clang。
```

#### 在 CentOS7 上

```bash
# 由于 CentOS 7 的主镜像已不再可用，更新 yum 仓库以使用 vault.centos.org
sed -i "s/mirror.centos.org/vault.centos.org/g" /etc/yum.repos.d/*.repo && \
    sed -i "s/^#.*baseurl=http/baseurl=http/g" /etc/yum.repos.d/*.repo && \
    sed -i "s/^mirrorlist=http/#mirrorlist=http/g" /etc/yum.repos.d/*.repo
sudo yum -y install centos-release-scl
sed -i "s/mirror.centos.org/vault.centos.org/g" /etc/yum.repos.d/*.repo && \
    sed -i "s/^#.*baseurl=http/baseurl=http/g" /etc/yum.repos.d/*.repo && \
    sed -i "s/^mirrorlist=http/#mirrorlist=http/g" /etc/yum.repos.d/*.repo
sudo yum -y install epel-release
sudo yum -y groupinstall "Development Tools"
sudo yum -y install git python3 python3-pip make cmake3 openssl openssl-devel
sudo ln -sf /usr/bin/cmake3 /usr/local/bin/cmake

# 通过 devtoolset-10 安装较新版本的 gcc/g++
sudo yum -y install devtoolset-10
scl enable devtoolset-10 bash
```

#### 在 CentOS 8/CentOS Stream 8 上

```bash
sudo dnf -y install epel-release dnf-plugins-core

# 启用 PowerTools（在 CentOS 8 中称为 PowerTools；在 Stream 8 中通常为 powertools）
sudo dnf config-manager --set-enabled powertools || sudo dnf config-manager --set-enabled PowerTools
sudo dnf -y groupinstall "Development Tools"
sudo dnf -y install git python3 python3-pip cmake gcc-c++ make
```

### 使用 Python 构建 NeuG

环境准备就绪后，即可开始使用 Python 构建 NeuG 并使用 Python 客户端。

**构建模式**：NeuG 在 `<repo>/build/` 目录下使用单一的根构建树。核心引擎仅编译一次，生成共享库 `libneug.{dylib,so}`，每种语言绑定（目前为 Python；未来为 Node/Rust）都会构建各自的 `.so` 文件，并动态链接到同一个核心库。核心引擎不会针对每种绑定进行独立构建。

```
<repo>/build/
├── src/libneug.{dylib,so}             # 核心，仅构建一次
└── tools/python_bind/neug_py_bind*.so # 绑定，链接至核心
```

#### 用于开发目的

要一次性配置根构建并编译 Python 绑定：

```bash
make python-dev
```

这会引导根构建（`cmake -S . -B build -DBUILD_PYTHON=ON`），
编译核心，并构建 `neug_py_bind` 目标。后续运行只会
重新构建发生更改的部分。然后你可以直接导入 `neug`：

```bash
cd tools/python_bind
python3
>>> import neug
```

加载器会自动在 `<repo>/build/tools/python_bind/` 中发现 `neug_py_bind*.so`
——无需修改 `sys.path`。可以通过 `NEUG_BUILD_DIR=/path/to/build` 指向其他构建目录。

为了获得最高效的增量开发循环，可以直接从
`tools/python_bind/` 运行 `make dev`。如果缺少根构建或未使用 `-DBUILD_PYTHON=ON` 进行配置，它会自动引导，因此你也可以在全新检出的代码中直接使用它。

#### 构建 Wheel 包

```bash
make python-wheel
```

生成的 wheel 包会输出到 `tools/python_bind/dist/`。它将 `neug_py_bind*.so` 和 `libneug.{dylib,so}` 都打包在 `neug` 包内，在运行时通过 `@loader_path` (macOS) / `$ORIGIN` (Linux) RPATH 相互定位，因此该 wheel 包是完全自包含的。

`setup.py` 会使用根目录的构建产物。在 CI 环境中（即没有预存构建目录树的 cibuildwheel 容器），它会回退到在容器内运行 cmake configure 和 `--target neug_py_bind`。

#### 仅构建 C++ 库和可执行文件

若要仅构建 C++ 库和可执行文件（不构建 Python 绑定），请执行：

```bash
make cpp-build   # 使用 -DBUILD_PYTHON=OFF 进行配置，然后构建
```

上述两个目标均支持 `BUILD_TYPE`（默认为 `Release`）和 `EXTRA_CMAKE_FLAGS` 参数：

```bash
BUILD_TYPE=Debug make cpp-build
EXTRA_CMAKE_FLAGS="-DBUILD_HTTP_SERVER=ON -DWITH_MIMALLOC=ON" make cpp-build
```

等效的原始 cmake 命令形式如下：

```bash
cmake -S . -B build -DBUILD_PYTHON=OFF
cmake --build build -j$(nproc)
cmake --install build   # 可选：安装到系统
```

更多 CMake 选项请参阅 `CMakeLists.txt` 文件。

#### 构建选项

您可以通过设置以下环境变量来自定义构建过程：

```bash
export BUILD_EXECUTABLES=ON/OFF # 启用或禁用工具可执行文件的构建
export BUILD_HTTP_SERVER=ON/OFF # 在 NeuG 中启用或禁用 HTTP 服务器支持
export WITH_MIMALLOC=ON/OFF # 决定是否使用 mimalloc 替代 glibc 默认的 malloc
export ENABLE_BACKTRACES=ON/OFF # 将 NeuG 库与 cpptrace 链接，以便在发生异常时提供详细的堆栈跟踪信息
export BUILD_TYPE=DEBUG/RELEASE # 设置 CMake 构建类型
export BUILD_TEST=ON/OFF # 启用或禁用测试套件的构建
```

可分发的构建产物（例如 Python wheel 包、npm tarball 包以及发布镜像）需通过设置 `NEUG_PACKAGE_BUILD=ON` 和 `NEUG_NATIVE_ARCH=OFF` 来构建。**请勿**在构建分发包时启用原生 CPU 调优。

仅针对本地源码构建时，可启用主机特定的 CPU 调优，方法如下：

```bash
NEUG_NATIVE_ARCH=ON make cpp-build
NEUG_PACKAGE_BUILD=OFF NEUG_NATIVE_ARCH=ON make -C tools/python_bind build
NEUG_NATIVE_ARCH=ON make -C tools/nodejs_bind dev
```

#### 调试

默认情况下，C++ 日志处于禁用状态。如需启用，请使用：

```bash
export DEBUG=ON
```

如需更详细的日志，可通过以下方式调整 glog 的 verbosity 级别：

```bash
export GLOG_v=10 # 全局设置
GLOG_v=10 python3 ... # 针对单条命令设置
```

如需进一步排查段错误等复杂问题，建议使用 gdb/lldb：

```bash
GLOG_v=10 gdb --args python3 -m pytest -sv tests/test_db_query.py
GLOG_v=10 lldb -- python3 -m pytest -sv tests/test_db_query.py
```

如需了解更多调试技巧，请分别参考 gdb 和 lldb 的文档。

### 本地 Pre-Commit 检查

在将代码推送到 GitHub 之前，请运行本地检查以尽早发现问题并节省 CI 资源：

> **提示**：检查需要 Python 环境。
> 可通过 `python3 -m venv .venv && source .venv/bin/activate` 或 `conda create -n neug python=3.13 && conda activate neug` 进行设置。

```bash
# 仅进行格式检查（速度快，建议在 commit 前执行）
make format-check

# 包含构建和测试的完整检查（建议在创建 PR 前执行）
make full-check
```

`format-check` 用于验证 C++（clang-format）和 Python（isort、black、flake8）的代码格式。所有可自动修复的问题（clang-format、isort、black）将就地修正；仅 flake8 的问题需要手动修复。
`full-check` 还会编译代码并运行单元测试。

更多选项请参见 `./scripts/pre_commit_check.sh --help`。

### 使用 NodeJS 构建 NeuG

我们还提供了 NodeJS 客户端。这两种客户端共享位于 `<repo>/build/` 的同一根构建树。如果您已经使用 Python 构建过 NeuG，则可以直接复用 `libneug.{dylib,so}` 库。

> **注意**：NodeJS 绑定仅支持 **AP 模式**。直接从 Node.js 进程暴露原始 HTTP 端口来运行 TP 模式是一种危险做法——这会绕过生产服务器在正规反向代理或网关后本应具备的典型安全层（如身份验证、TLS 终结、限流等）。因此，我们特意从 NodeJS 绑定中移除了 `serve()` / `Session` API。
如果您确实需要 TP 模式，请使用 **C++** 或 **Python** 绑定部署专用的 NeuG 服务器，然后在 Node.js 中通过标准 HTTP 客户端与其连接。

#### 用于开发目的

从仓库根目录执行：
```bash
make node-dev
```

或从 `tools/nodejs_bind/` 目录执行：
```bash
cd tools/nodejs_bind && make dev
```

`make dev` 命令会自动完成全部操作：安装 npm 依赖（若已安装则跳过）、配置 CMake（CMake 内部会复用缓存，仅当配置变更时重新生成）、构建项目，并部署产物。该命令可安全地重复执行。

随后，Node.js 即可自动加载这些模块：
```bash
cd tools/nodejs_bind
const { Database } = require('neug');
```

#### 构建 NPM 包

NPM 包将被写入 `tools/nodejs_bind/neug-<version>-<platform>-<arch>.tgz`，其中包含 `neug_node_bind.node` 和 `libneug.{dylib, so}`。
软件包构建始终配置为可移植构建。
```bash
make node-pack

# 或：
cd tools/nodejs_bind && make pack
```

### 常见问题

#### `ImportError: cannot import 'neug_py_bind'`

加载器找不到 `neug_py_bind*.so`。请按以下顺序检查：

1. 是否确实构建了目标？运行 `cd tools/python_bind && make dev` ——
   `.so` 文件应生成在 `<repo>/build/tools/python_bind/` 目录下。
2. 是否指向了正确的构建目录？如果维护了多个构建目录，请设置
   `NEUG_BUILD_DIR=/path/to/build` 以覆盖默认的 `<repo>/build`。
3. 检查加载器实际查找的路径：
   `python3 -c "from neug import __init__; print(__init__._find_neug_py_bind_dir())"`

#### `Library not loaded: @rpath/libneug.dylib` 或传递依赖的第三方库

`neug_py_bind*.so` 配置了 `BUILD_RPATH=@loader_path/../../src`，以便在根构建目录中自动查找同级的 `libneug.dylib`。
如果遇到此错误：

- **如果是 `libneug` 本身报错**：你的构建目录不完整或移动了文件。
  重新运行 `cmake --build build --target neug_py_bind`。
- **如果是第三方依赖**（arrow、openssl 等）：未找到 `libneug.dylib` 的
  传递依赖。将 `DYLD_LIBRARY_PATH=/opt/neug/lib`（macOS）
  或 `LD_LIBRARY_PATH=/opt/neug/lib:/opt/neug/lib64`（Linux）设置为它们的
  安装路径，或者重新构建并静态链接这些依赖。

要检查 `.so` 文件依赖了哪些库：
```bash
otool -L build/tools/python_bind/neug_py_bind*.so   # macOS
ldd     build/tools/python_bind/neug_py_bind*.so    # Linux
```
