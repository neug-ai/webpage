# 开发树外扩展

NeuG 可以构建位于 **NeuG 源码树之外** 的扩展。当 NeuG 作为 Git 子模块（或与你的扩展仓库并列检出）时，这种布局是推荐的。

## 目录结构

```text
my-extension/
  neug/                      # NeuG 子模块或同级目录
  extension_config.cmake     # 将本仓库注册到 NeuG
  CMakeLists.txt             # 扩展的构建规则
  src/
  include/
```

## 注册扩展

在扩展仓库的根目录下创建 `extension_config.cmake` 文件：

```cmake
neug_extension_load(my_ext
    SOURCE_DIR ${CMAKE_CURRENT_LIST_DIR}
)
```

`neug_extension_load` 会记录扩展的名称和源码目录，以便 NeuG 的构建系统能够通过 `add_subdirectory` 加载该扩展。

## 配置与构建

将 **NeuG** 作为 CMake 项目打开（而非扩展仓库的根目录），并传入以下参数：

- `BUILD_EXTENSIONS` —— 待构建的扩展名称列表，以分号分隔（例如 `my_ext`，以及可选的内置扩展如 `parquet`）
- `NEUG_EXTENSION_CONFIGS` —— 指向 `extension_config.cmake` 文件的一个或多个路径

`NEUG_EXTENSION_CONFIGS` 中的相对路径将从 NeuG 源码树根目录（即 `CMAKE_SOURCE_DIR`）解析。

```sh
cmake -S my-extension/neug -B my-extension/build/release \
  -DBUILD_EXTENSIONS=my_ext \
  -DNEUG_EXTENSION_CONFIGS=/absolute/path/to/my-extension/extension_config.cmake

cmake --build my-extension/build/release --target neug_my_ext_extension -j$(nproc)
```

位于 `neug/extension/` 目录下的内置扩展（如 `parquet`、`pattern_matching`、`gds`、`httpfs`）无需指定 `NEUG_EXTENSION_CONFIGS`；只需将其名称列入 `BUILD_EXTENSIONS` 即可。

若 `BUILD_EXTENSIONS` 中指定了某个扩展名，而该扩展既非内置扩展，也未通过 `neug_extension_load` 注册，则配置过程将失败，并给出明确的错误提示。

## 构建产物与 LOAD

共享库将被写入以下路径：

```text
<build>/extension/<name>/lib<name>.neug_extension
```

运行时，基于名称的 `LOAD <name>` 会解析为 `$NEUG_EXTENSION_HOME_PYENV/extension/<name>/` 目录下的文件。请将该环境变量指向你的 NeuG 构建目录（或把构建产物复制/符号链接到你已安装的 NeuG 所使用的目录），然后执行：

```cypher
LOAD my_ext;
```

请确保扩展所构建针对的 NeuG 版本与你实际加载运行时所用的 NeuG 版本一致。
