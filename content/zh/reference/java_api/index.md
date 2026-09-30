# Java API 参考

NeuG Java API 为连接到 NeuG 服务器、执行 Cypher 查询和读取类型化查询结果提供了原生的 Java 驱动程序。

## 概述

Java 驱动程序专为应用程序集成和服务端使用而设计：

- **创建驱动程序** 以通过 HTTP 连接到 NeuG 服务器
- **打开会话** 以执行 Cypher 查询
- **读取结果** 通过类型化的 `ResultSet` API
- **检查元数据** 使用原生 NeuG `Types`

## 部署模型

当前的 Java SDK 仅支持**通过 HTTP 进行远程访问**，即
入门指南中描述的[**服务模式**](../../getting_started/getting_started.md)。

- **支持**：连接到运行中的 NeuG 服务器，使用 `GraphDatabase.driver("http://host:port")`
- **不支持**：从 Java 进行嵌入式/进程内数据库访问

如果您需要嵌入式访问，请使用 C++ 或 Python API。Java SDK 应被视为已运行的 NeuG 服务的客户端。

## 使用方法

### 在另一个 Maven 项目中添加依赖

```xml
<dependency>
	<groupId>com.alibaba.neug</groupId>
	<artifactId>neug-java-driver</artifactId>
	<version>${neug.version}</version>
</dependency>
```

## 核心接口

- **[Driver](driver.md)** - 配置连接并创建会话
- **[Session](session.md)** - 执行语句并管理显式事务
- **[ResultSet](result_set.md)** - 读取行、类型化值和结果元数据

## 快速开始

```java
import com.alibaba.neug.driver.Driver;
import com.alibaba.neug.driver.GraphDatabase;
import com.alibaba.neug.driver.ResultSet;
import com.alibaba.neug.driver.Session;

public class Example {
	public static void main(String[] args) {
		try (Driver driver = GraphDatabase.driver("http://localhost:10000")) {
			driver.verifyConnectivity();

			try (Session session = driver.session()) {
				try (ResultSet rs = session.run("RETURN 1 AS value")) {
					while (rs.next()) {
						System.out.println(rs.getInt("value"));
					}
				}
			}
		}
	}
}
```

## 启动 NeuG 服务器

在使用 Java SDK 之前，启动一个暴露查询端点的 NeuG HTTP 服务器。
你可以使用 C++ 二进制文件或 Python API 来启动服务器。

### 选项 A：使用 Python 启动

如果你已经安装了 `neug` Python 包，可以直接从 Python 启动服务器：

```python
from neug import Database

db = Database("/path/to/graph", mode="rw")

# 阻塞直到进程被终止（Ctrl+C 或 SIGTERM）
db.serve(port=10000, host="0.0.0.0", blocking=True, thread_num=0)
```

To run non-blocking (e.g. inside a larger script):

```python
import time
from neug import Database

db = Database("/path/to/graph", mode="rw")
uri = db.serve(port=10000, host="0.0.0.0", blocking=False, thread_num=0)
print("Server started at:", uri)

try:
    while True:
        time.sleep(60)
except KeyboardInterrupt:
    db.stop_serving()
```

`thread_num` 设置并发执行的服务查询的最大数量。
默认 `0` 遵循数据库 `max_thread_num`。如果显式设置，则
必须小于或等于
数据库 `max_thread_num`。在默认的数据库线程设置下，
`max_thread_num` 由硬件并发度解析得出，并回退到 `1` 如果
运行时无法检测到它。
每个并发执行的 TP 查询使用一个服务执行槽位。

### 选项 B：使用 C++ 二进制文件启动

#### 1. 构建服务器二进制文件

在仓库根目录下：

```bash
cmake -S . -B build -DBUILD_EXECUTABLES=ON -DBUILD_HTTP_SERVER=ON

# macOS
cmake --build build --target rt_server -j$(sysctl -n hw.ncpu)

# Linux
cmake --build build --target rt_server -j$(nproc)
```

#### 2. 启动服务器

```bash
./build/bin/rt_server --data-path /path/to/graph --http-port 10000 --host 0.0.0.0 --thread-num 0
```

常用选项：

- `--data-path`：NeuG 数据目录的路径
- `--http-port`：Java 客户端的 HTTP 端口，默认值为 `10000`
- `--host`：绑定地址，默认值为 `127.0.0.1`
- `--thread-num`：数据库 `max_thread_num` 和服务 `thread_num`。
  默认值为 `0`：NeuG 首先解析数据库线程数，然后根据得出的数据库 `max_thread_num`。在
  默认数据库线程设置下，数据库线程数根据
  硬件并发数解析，若无法检测则回退到 `1`（若运行时无法检测到）。
  每个并发执行的 TP 查询使用一个服务执行槽。

> **注意：** 在调用 `db.serve()`。
> 服务器启动后，在 `db.stop_serving()` 被调用之前，不允许建立新的本地连接。

### 从 Java 连接

通过任一选项启动服务器后：

```java
Driver driver = GraphDatabase.driver("http://localhost:10000");
```

## 参数化查询

```java
import java.util.HashMap;
import java.util.Map;

Map<String, Object> parameters = new HashMap<>();
parameters.put("name", "Alice");
parameters.put("age", 30);

try (Session session = driver.session()) {
	String query = "CREATE (p:Person {name: $name, age: $age}) RETURN p";
	try (ResultSet rs = session.run(query, parameters)) {
		if (rs.next()) {
			System.out.println(rs.getObject("p"));
		}
	}
}
```

## 依赖项

Java 驱动程序依赖于以下库：

- OkHttp - HTTP 客户端
- Protocol Buffers - 响应序列化
- Jackson - JSON 处理
- SLF4J - 日志门面

这些依赖项由 Maven 自动管理。

## API 文档

按照以下说明可在本地构建生成的 Javadoc。

## 在本地构建 Javadoc

```bash
cd tools/java_driver
mvn -DskipTests javadoc:javadoc
```

生成的 Javadoc 写入到 `tools/java_driver/target/site/apidocs`。
