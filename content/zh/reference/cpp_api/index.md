# C++ API 参考

NeuG C++ API 提供了对图数据库功能的高性能、低级访问。专为性能关键型应用、嵌入式系统和高级图算法设计。

## 概述

C++ API 为以下功能提供了强大的能力：

- **数据库管理**：打开、配置和管理 NeuG 数据库实例
- **查询执行**：执行带有参数化输入的 Cypher 查询
- **结果处理**：以类型安全的方式遍历查询结果

## 核心类

- **[NeugDB](neug_db)** - 数据库操作的主要入口点
- **[Connection](connection)** - 针对数据库执行 Cypher 查询
- **[QueryResult](query_result)** - 具有迭代器访问权限的查询结果容器
- **[NeugDBService](service)** - 用于高吞吐量场景的 HTTP 服务

## 快速开始

### 包含头文件

```cpp
#include <neug/main/neug_db.h>
#include <neug/main/connection.h>
```

### 基本用法

```cpp
#include <neug/main/neug_db.h>
#include <iostream>

int main() {
  // 创建并打开数据库
  neug::NeugDB db;
  db.Open("/path/to/graph", 4);  // 4 个线程

  // 创建连接并执行查询
  auto conn = db.Connect();
  auto result = conn->Query("MATCH (n:Person) RETURN n.name LIMIT 10", "read");

  // 处理结果
  if (result.has_value()) {
    auto& qr = result.value();
    while (qr.hasNext()) {
      std::cout << qr.GetCurrentRowAsString() << std::endl;
      qr.next();
    }
  }

  // 关闭数据库
  db.Close();
  return 0;
}
```

## 错误处理

```cpp
auto result = conn->Query("INVALID QUERY", "read");
if (!result.has_value()) {
  std::cerr << "查询失败: " << result.error().message() << std::endl;
}
```

## 线程安全性

- `NeugDB`：连接/服务注册操作是同步的；生命周期变更要求所有连接处于空闲状态
- `Connection`：**非线程安全**；每个线程应使用独立的连接
- `QueryResult`：线程安全（创建后为只读）
