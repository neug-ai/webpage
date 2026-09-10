# NeugDBService

**全名：** `neug::NeugDBService`

面向高吞吐量场景的 NeuG 图数据库 HTTP 服务。

`NeugDBService` 为 NeuG 图数据库提供了一层 HTTP 接口，支持通过 HTTP 远程执行查询。它管理一个基于 BRPC 的 HTTP 服务器的生命周期，该服务器通过 RESTful 端点处理 Cypher 查询、服务状态请求以及模式（schema）查询。
此组件是 Python 中 `Database.serve()` 功能的 C++ 实现，专为高吞吐量事务处理（TP）场景设计，适用于多个客户端需并发访问数据库的情形。

**使用示例：**
```cpp
#include <neug/main/neug_db.h>
#include <neug/server/neug_db_service.h>
int main() {
  // 1. 打开数据库
  neug::NeugDB db;
  db.Open("/path/to/graph", 8);  // 使用 8 个线程
  // 2. 创建并配置服务
  neug::ServiceConfig config;
  config.query_port = 10000;
  config.host_str = "0.0.0.0";
  config.thread_num = 0;  // 自动从数据库的 max_thread_num 中选取服务线程数。
  config.auto_compaction = true;
  // 3. 启动 HTTP 服务
  neug::NeugDBService service(db, config);
  std::string url = service.Start();
  std::cout << "服务运行于: " << url << std::endl;
  // 4. 阻塞等待退出信号（Ctrl+C）
  service.run_and_wait_for_exit();
  // 5. 清理资源
  db.Close();
  return 0;
}
```

**HTTP 端点：**
- `POST /cypher` — 执行 Cypher 查询
- `GET /schema` — 获取图模式（schema）
- `GET /status` — 检查服务状态

**线程安全性：** 所有公有方法均为线程安全。服务内部使用 `TpExecutionSlotPool` 高效处理并发请求。

**服务线程：** `ServiceConfig::thread_num` 控制服务线程数量。默认值 `0` 表示自动从数据库的 `max_thread_num` 中选取；若显式指定，则其值不得超过数据库的 `max_thread_num`。在数据库采用默认线程配置时，`max_thread_num` 将依据硬件并发能力自动推导；若运行时无法检测到硬件并发数，则回退为 `1`。
服务线程可并发执行 TP 查询，但每个查询仅占用一个执行槽（execution slot）和一个线程。

**自动压缩（Auto Compaction）：** `ServiceConfig::auto_compaction` 控制是否在服务运行期间启用后台自动压缩线程。默认值为 `true`。

### 构造函数与析构函数

#### `NeugDBService(neug::NeugDB &db, const ServiceConfig &config=ServiceConfig())`

围绕一个已存在的数据库实例构建服务。

- **参数：**
  - `db`：将用于处理查询的 NeuG 数据库的引用
  - `config`

- **注意事项：**
  - 在创建服务前，数据库应已打开并处于就绪状态。
  - 构造过程会关闭所有已存在的嵌入式连接；此时不得有任何嵌入式连接正在使用。

#### `~NeugDBService()`

确保正确清理的析构函数。

如果 HTTP 处理器管理器正在运行，则自动停止它并释放所有相关资源。

### 公共方法

#### `db()`

获取对底层图数据库的直接访问权限。

直接数据库访问会绕过服务层

- **返回值：** 包装的 `NeugDB` 实例的引用

#### `Start()`

启动 HTTP 服务器。

绑定到配置的主机和端口，并开始接受 HTTP 请求。返回服务可访问的完整 URL。

- **抛出异常:**
  - `std::runtime_error`: 如果服务未初始化
  - `std::runtime_error`: 如果服务已在运行
  - `std::runtime_error`: 如果无法绑定到配置的地址

- **返回值:** 格式为 "http://host:port" 的 URL 字符串，表示服务正在运行的位置

#### `Stop()`

优雅地停止 HTTP 服务器。

停止接受新连接并关闭 BRPC 服务器。此方法是线程安全的，可以从信号处理器中调用。

- **注意事项:**
  - 如果服务未正确初始化，则向 stderr 打印状态消息
  - 由互斥锁保护以确保线程安全的关闭

#### `GetServiceConfig() const`

获取当前服务配置。

- **注意事项：**
  - 返回传递给 init() 的配置，而非运行时设置

- **返回值：** 初始化期间使用的 `ServiceConfig` 的常量引用

#### `AcquireExecutionSlot()`

从内部 TP 执行槽（execution-slot）池中租用一个执行槽。

返回一个 `ExecutionSlotLease`，当该对象超出作用域时，会自动将执行槽归还至池中。在需要对租用生命周期进行细粒度控制的直接查询执行场景中，请使用此方法。

**使用示例：**
```cpp
neug::NeugDBService service(db, config);
service.Start();
// 租用一个执行槽并执行查询。
auto lease = service.AcquireExecutionSlot();
auto result = lease->ExecuteTransactionalRequest(
    R"({"query": "MATCH (n) RETURN count(n)"})");
// 当 lease 离开作用域时，ExecutionSlot 将自动被归还。
```

- **注意事项：**
  - 若池中暂无可用执行槽，则该调用将阻塞

- **返回值：** 管理已租用执行槽的 `ExecutionSlotLease`

#### `IsRunning() const`

检查 HTTP 服务器当前是否正在运行。

- **备注：**
  - 这会委托给 HTTP 处理器管理器的 `IsRunning()` 方法
  - 线程安全的服务器状态查询

- **返回值：** 如果底层 BRPC 服务器正在接受连接则返回 `true`

#### `service_status()`

获取当前服务状态信息。

返回指示当前状态的状态消息：
- 如果未初始化，返回 "NeugDB service has not been inited!"
- 如果已初始化但未运行，返回 "NeugDB service has not been started!"
- 如果正在积极处理请求，返回 "NeugDB service is running ..."

- **备注：**
  - 始终返回 OK 状态，实际状态在消息字符串中

- **返回值：** 包含状态消息和 OK 状态码的结果

#### `run_and_wait_for_exit()`

启动服务并阻塞直到收到关闭信号。

该便利方法启动 HTTP 服务器，并阻塞调用线程，直到服务器被要求退出（通过 `Stop()` 或信号）。使用底层 BRPC 服务器的 RunUntilAskedToQuit() 机制。

- **注意事项：**
  - 这是在生产环境中运行服务的典型方式

- **抛出异常：**
  - `std::runtime_error`：如果服务未初始化
  - `std::runtime_error`：如果服务已在运行中
  - `std::runtime_error`：如果 HTTP 处理器管理器不可用


---

## ExecutionSlot

**全名：** `neug::ExecutionSlot`

**头文件：** `neug/main/execution_slot.h`

用于 AP 和 TP 查询执行的可复用执行上下文。

`ExecutionSlot` 是一种与运行时无关的执行上下文。它拥有槽位（slot）本地的查询状态，并借用数据库快照存储、版本管理器、内存分配器以及可选的 WAL 写入器。嵌入式连接（embedded connection）各自持有一个 slot；服务模式（service mode）则通过 `TpExecutionSlotPool` 持有一组固定数量的 slot，该池同时也绑定仅用于 TP 的 WAL 写入器。该类本身不依赖 brpc 或 bthread。

一个 `ExecutionSlot` **不得被并发使用**。它不绑定到某个具体的 pthread 或 bthread，因此一个请求可在协作式让出（cooperative yield）期间持续复用同一个 execution slot、allocator 和 WAL 写入器。

`ExecutionSlot` 所有构造函数参数均为借用关系。连接（Connection）和 service pool 会在 `NeugDB` 销毁这些依赖项之前，先行释放其所持有的 slot。

**使用示例：**
```cpp
// 从 service 获取 execution slot
auto lease = service.AcquireExecutionSlot();
// 执行只读查询
std::string query = R"({
  "query": "MATCH (n:Person) RETURN n.name LIMIT 10",
  "access_mode": "read"
})";
auto result = lease->ExecuteTransactionalRequest(query);
// 执行带参数的写入查询
std::string insert_query = R"({
  "query": "CREATE (n:Person {name: $name})",
  "access_mode": "insert",
  "parameters": {"name": "Alice"}
})";
auto write_result = lease->ExecuteTransactionalRequest(insert_query);
```

**内部事务策略：**
- ``SnapshotReadTransaction``：只读快照访问
- ``MvccInsertTransaction``：新增顶点和边
- ``SnapshotCowWriteTransaction``：事务执行中使用的带版本的写时复制（COW）更新
- ``CurrentCowWriteTransaction``：AP 当前图（current graph）的私有 COW 更新
- ``InPlaceCompactionTransaction``：后台压缩操作

以上均为 `ExecutionSlot` 的实现策略。Connection 和 Session 层仍向用户暴露逻辑上的只读/读写事务语义；客户端无需也不应直接选择这些内部类型。

**线程安全性：** Execution slot **不得被并发使用**。顺序调用可能在不同的物理工作线程（worker）上恢复执行，因为该 slot 是一个执行上下文，而非线程局部（thread-local）状态。

### 公共方法

#### `ExecuteTransactionalRequest(const std::string &query)`

在执行槽（execution slot）内执行一条 Cypher 查询。

执行一个以 JSON 字符串形式指定的查询，该字符串包含 Cypher 查询语句、访问模式（access mode）以及可选的参数。这是高吞吐量服务场景下查询执行的主要方法。

**JSON 格式：**
```cpp
{
  "query": "MATCH (n:Person) RETURN n.name",
  "access_mode": "read",
  "parameters": {
    "param1": "value1",
    "list_param": [1, 2, 3],
    "map_param": {"key": "value"}
  }
}
```

**访问模式（Access Modes）：**
- `"read"` 或 `"r"`：只读查询（仅含 `MATCH`，不含任何修改操作）
- `"insert"` 或 `"i"`：仅插入操作（如 `CREATE`）
- `"update"` 或 `"u"`：更新/删除操作（如 `SET`、`DELETE`、`MERGE`）
- `"schema"` 或 `"s"`：模式（`Schema`）修改操作（如 `CREATE/DROP` 标签）

**使用示例：**
```cpp
auto lease = service.AcquireExecutionSlot();
// 简单只读查询
auto result = lease->ExecuteTransactionalRequest(
    R"({"query": "MATCH (n) RETURN count(n)"})");
if (result.has_value()) {
  // 处理结果
}
// 带参数的查询
std::string query = R"({
  "query": "MATCH (n:Person {age: $age}) RETURN n",
  "access_mode": "read",
  "parameters": {"age": 30}
})";
auto param_result = lease->ExecuteTransactionalRequest(query);
```

- **参数：**
  - `query`：包含查询语句、访问模式（`access_mode`）及参数的 JSON 字符串

- **返回值：**
  成功时返回包含 `QueryResult` 的结果；失败时返回错误状态

## TpExecutionSlotPool

**全名：** `neug::TpExecutionSlotPool`

用于并发查询执行的数据库执行槽（execution slot）池。

`TpExecutionSlotPool` 拥有并调度一组固定数量的 `ExecutionSlot` 实例，专用于 TP（事务处理）类查询。每个对齐的条目均以内联方式存储其对应的执行槽，维持其内存分配器（allocator）的存活，并拥有其专属的 WAL（预写式日志）写入器（WAL writer）。
`TpExecutionSlotPool` 由 `NeugDBService` 内部使用。在绝大多数使用场景中，应通过 `NeugDBService::AcquireExecutionSlot()` 获取执行槽，而非直接访问该池。

**核心特性：**
- 由服务托管的执行槽，支持显式的租用（lease）与释放（release）
- 基于 bthread 同步机制的线程安全槽调度
- 每个槽自动管理其专属 WAL（Write-Ahead Log）
- 内存对齐的 TP 槽上下文，提升缓存效率

**池大小：** 由 `NeugDBConfig::max_thread_num` 决定。每个查询在其整个执行期间独占租用一个执行槽及一个线程。

### 公共方法

#### `AcquireExecutionSlot()`

从执行槽池中租用一个执行槽。

若当前无可用执行槽，则阻塞等待。

- **返回值：** 一个用于管理已租用执行槽的 `ExecutionSlotLease` 对象。当该租约对象超出作用域时，对应的执行槽将自动归还至池中。

#### `getExecutedQueryNum() const`

获取所有执行槽中已执行查询的总数。

调用方需持有锁。

- **返回值：** 已执行查询的总数。

## ExecutionSlotLease

**全名：** `neug::ExecutionSlotLease`

用于独占使用执行槽（execution slot）的仅可移动 RAII 租约。

`ExecutionSlotLease` 会在析构时自动将其执行槽归还给发放该租约的 `TpExecutionSlotPool`。嵌入式连接（embedded connections）不租用执行槽。

租约的生命周期不得长于发放该租约的 `NeugDBService` 实例。

**使用示例：**
```cpp
{
  // 租用一个执行槽；若当前无可租用槽，则阻塞等待。
  auto lease = service.AcquireExecutionSlot();
  // 使用该执行槽执行查询
  auto result = lease->ExecuteTransactionalRequest(query);
} // 执行槽在此处自动释放
```

**线程安全性：** `ExecutionSlotLease` 是仅可移动（move-only）类型（不可拷贝），以确保执行槽的独占性。每个租约一次应仅被一个逻辑请求使用。
