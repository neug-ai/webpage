# NeugDBService

**全称：** `neug::NeugDBService`

用于远程事务处理（TP）工作负载的 NeuG 数据库服务门面。

`NeugDBService` 协调一个 TP 运行时和一个 `IServiceTransport`。默认传输层使用 BRPC 暴露 HTTP 端点；查询执行和事务所有权保留在运行时中，与网络处理器无关。
这是 Python 的 `Database.serve()` 功能的 C++ 等价实现，专为高吞吐量事务处理（TP）场景设计，适用于多个客户端需要并发访问数据库的情况。

**使用示例：** 
```cpp
#include <neug/main/neug_db.h>
#include <neug/server/neug_db_service.h>
int main() {
  // 1. Open the database
  neug::NeugDB db;
  db.Open("/path/to/graph", 8);  // 8 threads
  // 2. Create and configure service
  neug::ServiceConfig config;
  config.query_port = 10000;
  config.host_str = "0.0.0.0";
  // 3. Start and block until shutdown (Ctrl+C or Stop from another thread).
  {
    neug::NeugDBService service(db, config);
    service.run_and_wait_for_exit();
  }
  // 4. Close after service resources have been released.
  db.Close();
  return 0;
}
```

**HTTP 端点：**
- `POST /cypher` - 执行 Cypher 查询
- `GET /schema` - 获取图模式
- `GET /service_status` - 检查服务状态
- `POST /transactions` - 开始显式 TP 事务会话
- `POST /transactions/{id}/query|commit|rollback` - 操作会话

**线程安全：** 所有公共方法都是线程安全的。该服务在内部使用 `TpExecutionSlotPool` 来高效处理并发请求。

### 构造函数与析构函数

#### `NeugDBService(neug::NeugDB &db, const ServiceConfig &config=ServiceConfig())`

围绕现有数据库实例构建服务。

构建前需要先关闭所有现有的嵌入式连接。

- **参数：**
  - `db`：将处理查询的 NeuG 数据库引用
  - `config`

- **注意：**
  - 在创建服务之前，应已打开并准备好数据库
  - 在任何给定时间，最多只能有一个 `NeugDBService` 与一个 `NeugDB` 实例关联。当服务被销毁时，该关联将被释放。

#### `NeugDBService(NeugDB &db, const ServiceConfig &config, const TransportFactory &factory)`

使用另一种传输协议构建服务。

工厂不得启动请求回调；`NeugDBService` 会在配置运行时后启动它们。

- **参数：**
  - `db`
  - `config`
  - `factory`

#### `~NeugDBService()`

确保正确清理的析构函数。

如果 HTTP 处理程序管理器正在运行，则自动停止它并释放所有关联资源。
在销毁此服务之前，必须销毁从该服务获取的所有 `ExecutionSlotLease` 对象。

### 公共方法

#### `db()`

获取对底层图数据库的直接访问权限。

直接数据库访问会绕过服务层

- **返回值：** 包装的 `NeugDB` 实例的引用

#### `Start()`

启动服务传输。

绑定到配置的主机和端口，并开始接受 HTTP 请求。返回服务可访问的完整 URL。

- **抛出：**
  - `std::runtime_error`：如果服务未初始化
  - `std::runtime_error`：如果服务已在运行
  - `std::runtime_error`：如果无法绑定到配置的地址

- **返回：**格式为 "http://host:port" 的 URL 字符串，表示服务正在运行的位置

#### `Stop()`

停止服务并排空其请求和事务。

停止接受新请求，排空显式事务，加入活动传输回调，并停止后台压缩。线程安全，但不适合直接从异步信号处理程序中调用。

- **注意：**
  - 如果服务未正确初始化，则向 stderr 打印状态消息
  - 由互斥锁保护，以确保线程安全的关闭

#### `GetServiceConfig() const`

获取当前服务配置。

- **注意事项：**
  - 返回传递给 init() 的配置，而非运行时设置

- **返回值：** 初始化期间使用的 `ServiceConfig` 的常量引用

#### `AcquireExecutionSlot()`

从内部 TP 池中租用一个执行槽位。

返回一个 `ExecutionSlotLease`，当它超出作用域时会自动将执行槽位释放回池中。

**使用示例：** 
```cpp
neug::NeugDBService service(db, config);
service.Start();
// Lease an execution slot and execute a query.
auto lease = service.AcquireExecutionSlot();
auto result = lease->ExecuteTransactionalRequest(
    R"({"query": "MATCH (n) RETURN count(n)"})");
// The ExecutionSlot is automatically returned when lease leaves scope.
```

- **注意：**
  - 如果池中没有可用的执行槽位，则会阻塞

- **返回值：** `ExecutionSlotLease`，用于管理已获取的执行槽位

#### `IsRunning() const`

检查服务传输是否正在接受请求。

- **注意：**
  - 对服务器状态进行线程安全的查询

- **返回：** 在成功 `Start()` 后返回 `true`，直到传输在关闭期间停止接受请求

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

启动服务并阻塞，直到收到关闭信号。

便捷方法，用于启动服务传输层并阻塞调用线程，直到服务器被要求退出（通过 `Stop()` 或信号）。

- **注意：**
  - 这是在生产环境中运行服务的典型方式

- **抛出：**
  - `std::runtime_error`：如果服务未初始化
  - `std::runtime_error`：如果服务已在运行
  - `std::runtime_error`：如果服务传输层无法启动


---

## ExecutionSlot

**全称：** `neug::ExecutionSlot`

用于高吞吐查询执行的数据库执行槽。

`ExecutionSlot` 是一个被动的核心执行上下文。它拥有槽本地的查询状态，并借用数据库范围的事务、存储、分配器和 WAL 资源。该类本身没有 brpc 或 bthread 依赖：TP 槽调度和同步由 `TpExecutionSlotPool` 注入，因此同一执行核心也服务于嵌入式连接。
嵌入式连接独占一个 `ExecutionSlot`。服务模式通过 `TpExecutionSlotPool` 拥有一个固定的集合，并按请求租用它们。

**使用示例：** 
```cpp
// Lease execution slot from service
auto lease = service.AcquireExecutionSlot();
// Execute read query
std::string query = R"({
  "query": "MATCH (n:Person) RETURN n.name LIMIT 10",
  "access_mode": "read"
})";
auto result = lease->ExecuteTransactionalRequest(query);
// Execute write query with parameters
std::string insert_query = R"({
  "query": "CREATE (n:Person {name: $name})",
  "access_mode": "insert",
  "parameters": {"name": "Alice"}
})";
auto write_result = lease->ExecuteTransactionalRequest(insert_query);
```

**内部事务策略：**
- ``SnapshotReadTransaction``：只读快照访问
- ``MvccInsertTransaction``：添加新顶点和边
- ``SnapshotCowWriteTransaction``：版本化私有 COW 更新
- ``InPlaceCompactionTransaction``：后台压缩操作
这些是执行内部机制。`Connection` 和 Session 暴露逻辑上的只读/读写语义，不得暴露或要求调用者选择这些策略之一。

**并发：** 执行槽不得并发使用。它不绑定到物理 pthread 或 bthread 工作线程，在协作式让出后可以在另一个物理工作线程上恢复，同时保留相同的分配器、缓存和 WAL 资源。

**生命周期：** 所有借用的构造函数依赖项的生命周期必须长于 `ExecutionSlot` 以及从它创建的每个事务。`Connection` 和 `TpExecutionSlotPool` 会在 `NeugDB` 销毁那些共享依赖项之前释放它们的槽。

### 公共方法

#### `ExecuteTransactionalRequest(const std::string &request)`

在事务中执行串行化的 Cypher 请求。

执行以 JSON 字符串形式指定的查询，该字符串包含 Cypher 查询、访问模式和可选参数。这是高吞吐服务场景中执行查询的主要方法。

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

**访问模式：**
- `"read"` 或 `"r"`：只读查询（不含变更的 MATCH）
- `"insert"` 或 `"i"`：仅插入操作（CREATE）
- `"update"` 或 `"u"`：更新/删除操作（SET、DELETE、MERGE）
- `"schema"` 或 `"s"`：`Schema` 修改操作（CREATE/DROP 标签）

**使用示例：** 
```cpp
auto lease = service.AcquireExecutionSlot();
// Simple read query
auto result = lease->ExecuteTransactionalRequest(
    R"({"query": "MATCH (n) RETURN count(n)"})");
if (result.has_value()) {
  // Process result
}
// Parameterized query
std::string query = R"({
  "query": "MATCH (n:Person {age: $age}) RETURN n",
  "access_mode": "read",
  "parameters": {"age": 30}
})";
auto param_result = lease->ExecuteTransactionalRequest(query);
```

- **参数：**
  - `request`：包含 query、access_mode 和 parameters 的 JSON 字符串

- **返回：** 成功时返回序列化的 QueryResponse，否则返回错误状态


---

## TpExecutionSlotPool

**全称：** `neug::TpExecutionSlotPool`

用于并发查询执行的数据库槽位池。

`TpExecutionSlotPool` 拥有并调度一组固定的 `ExecutionSlot` 实例，用于 TP 查询执行。每个对齐的条目借用一个稳定的、由数据库拥有的每槽位 WAL 写入器。
`TpExecutionSlotPool` 由 `NeugDBService` 在内部使用。对于大多数用例，请通过 `NeugDBService::AcquireExecutionSlot()` 访问槽位，而不是直接通过池访问。

**主要特性：**
- 拥有服务本地的查询执行槽位
- 线程安全的租约/释放，支持感知调度器的等待
- 每个逻辑槽位对应稳定的 WAL（预写日志）写入器
- 每槽位 Entry 存储按 4096 字节对齐

**池大小：** 服务从 ``ServiceConfig::thread_num`` and `NeugDBConfig::max_thread_num` 解析其并发度，然后将该值传递给池。每个 TP 查询在其持续期间租用一个槽位。

### 构造函数与析构函数

#### `TpExecutionSlotPool(...)`

```cpp
TpExecutionSlotPool(
    GraphSnapshotStore &snapshot_store,
    std::shared_ptr< IGraphPlanner > planner,
    std::shared_ptr< execution::GlobalQueryCache > global_query_cache,
    IVersionManager &version_manager,
    CheckpointCoordinator &checkpoint_coordinator,
    ExtensionManager &extension_manager,
    const std::vector< std::shared_ptr< Allocator > > &allocators,
    WalWriterSet &wal_writers,
    const NeugDBConfig &config
)
```

使用数据库拥有的所有分配器构建一个池。

此重载保留原始的源代码兼容行为。需要更小执行限制的服务代码应使用接受显式槽位数的重载。

- **参数：**
  - `snapshot_store`
  - `planner`
  - `global_query_cache`
  - `version_manager`
  - `checkpoint_coordinator`
  - `extension_manager`
  - `allocators`
  - `wal_writers`
  - `config`

### 公共方法

#### `AcquireExecutionSlot()`

从池中租用一个槽位。

如果没有可用槽位，则阻塞。

- **返回：** `ExecutionSlotLease`，用于管理已租用的槽位。当租约超出作用域时，槽位将归还到池中。

#### `getExecutedQueryNum() const`

获取所有槽位中已执行查询的总数。

期望调用方持有锁。

- **返回：** 已执行查询的总数。


---

## ExecutionSlotLease

**全称：** `neug::ExecutionSlotLease`

用于独占使用 TP `ExecutionSlot` 的仅移动 RAII 句柄。

`TpExecutionSlotPool` 注入一个 noexcept 释放操作，使该句柄能够在不向 `ExecutionSlot` 暴露 bthread 同步的情况下归还槽位。
