# 命令行界面（CLI）

NeuG 提供 CLI shell，您可以通过它使用 Cypher 查询查询数据库。

## 启动命令行

NeuG 支持嵌入式和远程数据库服务。命令行界面（CLI）在这两种模式下提供相同的功能。

### 嵌入式数据库

您可以在终端中使用 `neug-cli open` 命令后指定路径来创建嵌入式数据库。这将以读写模式打开嵌入式数据库，数据在 CLI shell 关闭后持久化到磁盘。注意，如果数据库目录不存在，将为您创建。
```bash
neug-cli open /workspaces/neug_example
```
```
INFO:neug:Build directory: /workspaces/neug/tools/python_bind/neug/../build/lib.linux-x86_64-3.10
INFO:neug:Adding build directory to sys.path: /workspaces/neug/tools/python_bind/neug/../build/lib.linux-x86_64-3.10
Opened database at /workspaces/neug_example in rw mode
INFO:neug.database:Open database /workspaces/neug_example in rw mode
INFO:neug:Connection established.
Welcome to the NeuG shell. Type :help for usage hints.

neug >
```

### 远程数据库服务

您也可以使用 `neug-cli connect` 命令连接到已运行的数据库服务。假设 NeuG 服务运行在 http://127.0.0.1:10001，您可以使用以下命令连接到服务。
```bash
neug-cli connect http://127.0.0.1:10001
```
```
INFO:neug:Build directory: /workspaces/neug/tools/python_bind/neug/../build/lib.linux-x86_64-3.10
INFO:neug:Adding build directory to sys.path: /workspaces/neug/tools/python_bind/neug/../build/lib.linux-x86_64-3.10
Connecting to 127.0.0.1:10001
INFO:neug.session:Opening session at endpoint: http://127.0.0.1:10001/ with timeout: 300, num_threads: 1
INFO:neug.session:Session initialized with endpoint: http://127.0.0.1:10001/ and timeout: 300
INFO:neug:Connection established.
Welcome to the NeuG shell. Type :help for usage hints.

neug >
```

## Shell 命令

通过运行 `neug-cli --help` 列出所有可用命令
```
neug-cli --help
Usage: neug-cli [OPTIONS] COMMAND [ARGS]...

  NeuG CLI Tool.

Options:
  --version  Show the version and exit.
  --help     Show this message and exit.

Commands:
  connect  Connect to a remote database.
  open     Open a local database.
```

### :help
在 NeuG shell 内显示内置命令列表。
```
neug > :help

            Usage hints:
            - Enter Cypher queries directly to execute them on the connected database.
            - Use :help to display this help message.
            - Use :quit to leave the shell.
            - Use :max_rows <number> to set the maximum number of rows to display for query results.
            - Use :ui <endpoint> to start a web ui service on endpoint.
            - Multi-line commands are supported. Use ';' at the end to execute.
            - Command history is supported; use the up/down arrow keys to navigate previous commands.
```

### :quit
退出 shell。您也可以使用 `Ctrl + C` 退出 shell。

### :max_rows [max_rows]
设置显示的最大行数。

### :ui [service_endpoint]
在 service_endpoint 上启动 web ui 服务。（默认端点：127.0.0.1:5000）。
启动 web 服务后，您可以通过浏览器在 `http://service_endpoint` 访问 NeuG 的 web 服务。