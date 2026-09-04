# 代码风格指南

本文档提供 GraphScope 代码库的编码风格指南，包括 C++、Python、Rust、Java 和 shell 脚本。
在整个代码库中遵循一致的编码标准可提高可维护性、可读性和代码质量。

## C++ 风格

我们遵循 [Google C++ Style Guide](https://google.github.io/styleguide/cppguide.html) 作为 C++ 编码标准。

## Python 风格

我们遵循 [black](https://black.readthedocs.io/en/stable/the_black_code_style/current_style.html) 代码风格作为 Python 编码标准。

## Java 风格

NeuG 中的 Java 代码遵循 [Google Java Style](https://google.github.io/styleguide/javaguide.html)，
由 Maven Spotless 插件（使用 `google-java-format`）强制执行。

Java 源码位于 [tools/java_driver](https://github.com/alibaba/neug/tree/main/tools/java_driver)。

## 风格检查器和代码检查工具

GraphScope 对每种语言使用不同的检查器和代码检查工具来强制执行代码风格规则：

- C++：[clang-format-8](https://releases.llvm.org/8.0.0/tools/clang/docs/ClangFormat.html) 和 [cpplint](https://github.com/cpplint/cpplint)
- Python：[Flake8](https://flake8.pycqa.org/en/latest/)
- Java：[Spotless Maven Plugin](https://github.com/diffplug/spotless/tree/main/plugin-maven)

每个检查器都可以包含在构建过程中，以确保代码符合风格指南。
以下是检查每种语言代码风格的命令：

对于 C++，通过 MakeFile 命令格式化和检查代码：

```bash
# 格式化
$ make neug_clformat
```

对于 Python：

- 先安装依赖：

```bash
$ pushd tools/python_bind
$ python3 -m pip  install -r requirements_dev.txt
$ popd
```

- 检查风格：

```bash
$ pushd tools/python_bind
$ python3 -m isort --check --diff .
$ python3 -m black --check --diff .
$ python3 -m flake8 .
$ popd
$ pushd tools/shell
$ python3 -m isort --check --diff .
$ python3 -m black --check --diff .
$ python3 -m flake8 .
$ popd
```

对于 Java：

- 仅检查风格：

```bash
$ pushd tools/java_driver
$ mvn spotless:check
$ popd
```

- 自动格式化 Java 文件：

```bash
$ pushd tools/java_driver
$ mvn spotless:apply
$ popd
```