# Java API 参考

NeuG Java API 为连接到 NeuG 服务器、执行 Cypher 查询和消费类型化查询结果提供了原生的 Java 驱动程序。

## 概述

Java 驱动程序专为应用程序集成和服务端使用而设计：

- **创建驱动程序** 以通过 HTTP 连接到 NeuG 服务器
- **打开会话** 以执行 Cypher 查询
- **读取结果** 通过类型化的 `ResultSet` API
- **检查元数据** 使用原生 NeuG `Types`

## 部署模型

当前的 Java SDK 仅支持 **通过 HTTP 的远程访问**，即 [**服务模式**](../../getting_started/getting_started.md#service-mode)。

- **支持**：使用 `GraphDatabase.driver("http://host:port")` 连接到正在运行的 NeuG 服务器
- **不支持**：从 Java 嵌入式/进程内数据库访问

如果你需要嵌入式访问，请使用 C++ 或 Python API。Java SDK 应被视为已运行的 NeuG 服务的客户端。

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

- **[Driver](driver)** — 管理连接并创建会话
- **[Config](config)** — 自定义连接行为和超时设置
- **[Session](session)** — 针对 NeuG 服务器执行语句
- **[Transaction](transaction)** — 将多个语句组合为一个显式事务
- **[ResultSet](result_set)** — 从查询结果中读取行及类型化值
- **[ResultSetMetaData](result_set_metadata)** — 检查结果集列名、是否可为空以及原生 NeuG 类型

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
# 阻塞式运行，直至进程被终止（Ctrl+C 或 SIGTERM）
db.serve(port=10000, host="0.0.0.0", blocking=True, thread_num=0)
```

如需非阻塞式运行（例如在更大的脚本中）：

```python
import time
from neug import Database

db = Database("/path/to/graph", mode="rw")
uri = db.serve(port=10000, host="0.0.0.0", blocking=False, thread_num=0)
print("服务器已启动，地址为：", uri)

try:
    while True:
        time.sleep(60)
except KeyboardInterrupt:
    db.stop_serving()
```

`thread_num` 用于设置服务线程数。默认值 `0` 表示由数据库的 `max_thread_num` 自动选择。若显式指定该值，则其必须小于或等于数据库的 `max_thread_num`。在数据库使用默认线程配置时，`max_thread_num` 将依据硬件并发能力自动推导；若运行时无法检测到硬件并发能力，则回退为 `1`。
服务线程可并发执行 TP 查询，但每个查询仅使用一个执行上下文和一个线程。

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
- `--http-port`：Java 客户端使用的 HTTP 端口，默认为 `10000`
- `--host`：绑定地址，默认为 `127.0.0.1`
- `--thread-num`：数据库的 `max_thread_num` 和服务端的 `thread_num`。默认值为 `0`：NeuG 首先解析数据库线程数，再基于该数据库 `max_thread_num` 解析服务端线程数。在默认数据库线程配置下，数据库线程数由硬件并发数决定；若运行时无法检测到硬件并发数，则回退为 `1`。服务端线程用于并发执行 TP 查询，但每个查询仅使用一个执行上下文和一个线程。

> **注意：** 在调用 `db.serve()` 之前，请确保所有本地连接均已关闭。
> 服务器启动后，除非调用 `db.stop_serving()`，否则不允许建立新的本地连接。

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

生成的 Javadoc 可以在本地构建。参见下面的[在本地构建 Javadoc](#build-javadoc-locally)。

## 在本地构建 Javadoc

```bash
cd tools/java_driver
mvn -DskipTests javadoc:javadoc
```

生成的 Javadoc 写入到 `tools/java_driver/target/site/apidocs`。
