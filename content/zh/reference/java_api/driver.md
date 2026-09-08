# 驱动程序

`Driver` 是使用 NeuG 的 Java 应用程序的主入口点。 `Config`
自定义其连接、超时和 HTTP 客户端行为。

## 职责

- 创建并负责底层 HTTP 客户端
- 应用共享的连接和超时设置
- 验证服务器连通性
- 创建 `Session` 实例
- 管理驱动程序生命周期，通过 `close()`

## 配置

创建一个 `Config`当应用程序需要更改驱动程序级别的 HTTP
行为而不修改其查询代码时。典型用例包括在测试中设置更短的
连接超时、为重型查询设置更长的读取超时，以及
针对服务工作负载调优连接池。

根据驱动程序版本，`Config.Builder`可以配置：

- 连接超时
- 读取超时
- 写入超时
- 连接池大小
- 保活设置

只需创建一次配置，并在构建驱动程序时重复使用。请保持
超时设置与部署环境一致，并优先使用默认值
除非有特定理由需要对其进行调优。

## 创建 Driver

```java
import com.alibaba.neug.driver.Driver;
import com.alibaba.neug.driver.GraphDatabase;

Driver driver = GraphDatabase.driver("http://localhost:10000");
```

## 使用 Config 创建 Driver

```java
import com.alibaba.neug.driver.Driver;
import com.alibaba.neug.driver.GraphDatabase;
import com.alibaba.neug.driver.utils.Config;

Config config = Config.builder()
        .withConnectionTimeoutMillis(3000)
        .build();

Driver driver = GraphDatabase.driver("http://localhost:10000", config);
```

## 验证连接

```java
try (Driver driver = GraphDatabase.driver("http://localhost:10000")) {
    driver.verifyConnectivity();
}
```

## 打开会话

```java
try (Driver driver = GraphDatabase.driver("http://localhost:10000")) {
    try (Session session = driver.session()) {
        // 在此运行查询
    }
}
```

## 生命周期说明

- 尽可能复用同一个 `Driver` 用于多个查询和会话（若可能）
- 在应用程序关闭时关闭驱动程序
- `isClosed()` 可用于检查驱动程序状态

另请参阅：[会话](session.md)
