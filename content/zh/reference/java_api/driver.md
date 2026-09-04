# Driver

`Driver` 是使用 NeuG 的 Java 应用程序的主入口点。

## 职责

- 创建并拥有底层 HTTP 客户端
- 验证服务器连接
- 创建 `Session` 实例
- 通过 `close()` 管理驱动生命周期

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

- 尽可能重用一个 `Driver` 进行多个查询和会话
- 应用关闭时关闭驱动
- `isClosed()` 可用于检查驱动状态

另请参阅：[Session](session)