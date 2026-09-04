# Config

`Config` 用于自定义 Java 驱动行为，如连接和超时设置。

## 目的

当您想调整驱动级 HTTP 行为而不更改应用程序查询代码时使用 `Config`。

典型用例包括：

- 测试中较短的连接超时
- 重查询较长的读取超时
- 为服务工作负载调整连接池设置

## 基本示例

```java
import com.alibaba.neug.driver.Driver;
import com.alibaba.neug.driver.GraphDatabase;
import com.alibaba.neug.driver.utils.Config;

Config config = Config.builder()
        .withConnectionTimeoutMillis(3000)
        .build();

Driver driver = GraphDatabase.driver("http://localhost:10000", config);
```

## 常用选项

根据驱动版本，`Config.Builder` 可用于调整：

- 连接超时
- 读取超时
- 写入超时
- 连接池大小
- 保活设置

## 使用说明

- 创建一次 `Config` 并在构造驱动时重用
- 保持超时值与您的部署环境一致
- 除非有特定的性能原因需要调整，否则首选保守的默认值

另请参阅：[Driver](driver)