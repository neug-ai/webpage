# NeugDBService

**全名：** `neug::NeugDBService`

面向高吞吐场景的 NeuG 数据库 HTTP 服务。

`NeugDBService` 为 NeuG 图数据库提供 HTTP 接口层，支持通过 HTTP 执行远程查询。它管理基于 BRPC 的 HTTP 服务器的生命周期，该服务器通过 RESTful 端点处理 Cypher 查询、服务状态请求和模式查询。
这是 Python 中 `Database.serve()` 功能的 C++ 等效实现，专为需要多个客户端并发访问数据库的高吞吐事务处理 (TP) 场景而设计。

> **平台说明：** HTTP 服务器组件不在 Windows 上构建（`BUILD_HTTP_SERVER` 在 Windows 构建中被禁用），因此 `NeugDBService` 在那里不可用。请在 Linux 或 macOS（或 WSL 下）上运行该服务。

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
  // 3. Start HTTP service
  neug::NeugDBService service(db, config);
  std::string url = service.Start();
  std::cout << "Service running at: " << url << std::endl;
  // 4. Block until shutdown signal (Ctrl+C)
  service.run_and_wait_for_exit();
  // 5. Cleanup
  db.Close();
  return 0;
}
```

**HTTP 端点：**
- `POST /cypher` - 执行 Cypher 查询
- `GET /schema` - 检索图模式
- `GET /status` - 检查服务状态
- `POST /transactions` - 开始显式 TP 事务会话
- `POST /transactions/{id}/query|commit|rollback` - 操作会话

**线程安全：** 所有公共方法都是线程安全的。该服务内部使用一个 `TpExecutionSlotPool` 来高效处理并发请求。

### 构造函数与析构函数

#### `NeugDBService(neug::NeugDB &db, const ServiceConfig &config=ServiceConfig())`

围绕现有数据库实例构建一个服务。

构建前需要先关闭所有现有的嵌入式连接。

- **参数：**
  - `db`：引用将处理查询的 NeuG 数据库
  - `config`

- **注意：**
  - 在创建服务之前，数据库应已打开并准备就绪
  - 最多只能有一个 `NeugDBService` 可以与一个 `NeugDB` 实例在任何给定时间相关联。当服务被析构时，该关联将被释放。

#### `~NeugDBService()`

确保正确清理的析构函数。

若 HTTP 处理程序管理器正在运行，则自动停止该管理器并释放所有关联资源。
所有 `ExecutionSlotLease`从该服务获取的对象必须在服务销毁前被销毁。

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

从内部 TP 池租用一个执行槽。

返回一个 `ExecutionSlotLease`，当它超出作用域时会自动将执行槽释放回池中。

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

- **注意事项：**
  - 如果池中没有可用的执行槽，则会阻塞

- **返回：** `ExecutionSlotLease`，用于管理获取到的执行槽

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

用于高吞吐量查询执行的数据库执行槽。

`ExecutionSlot` 是一个被动的核心执行上下文。它拥有槽本地查询状态，并借用数据库级别的事务、存储、分配器和 WAL 资源。该类本身没有 brpc 或 bthread 依赖：TP 槽调度和同步由 `TpExecutionSlotPool`，因此相同的执行核心也为嵌入式连接提供服务。
嵌入式连接独占一个 `ExecutionSlot`。服务模式通过 `TpExecutionSlotPool` 拥有固定集合，并按请求租用它们。

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
这些是执行内部机制。 `Connection` 和 Session 公开逻辑上的只读/读写语义，并且不得公开或要求调用者选择这些策略之一。

**并发：** 执行槽不得并发使用。它不绑定到物理 pthread 或 bthread 工作线程，并且可以在协作式让出后在另一个物理工作线程上恢复，同时保留相同的分配器、缓存和 WAL 资源。

**生命周期：** 所有借用的构造函数依赖项的生命周期必须长于 `ExecutionSlot` 以及从中创建的每个事务。 `Connection` 和 `TpExecutionSlotPool` 在 `NeugDB` 销毁这些共享依赖项之前释放其槽。

### 公共方法

#### `ExecuteTransactionalRequest(const std::string &request)`

在事务中执行串行化的 Cypher 请求。

执行指定为 JSON 字符串的查询，该字符串包含 Cypher 查询、访问模式和可选参数。这是高吞吐量服务场景中查询执行的主要方法。

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
- `"read"` 或 `"r"`：只读查询（无变更的 MATCH）
- `"insert"` 或 `"i"`：仅插入操作（CREATE）
- `"update"` 或 `"u"`：更新/删除操作（SET、DELETE、MERGE）
- `"schema"` 或 `"s"`: `Schema` 模式修改操作（CREATE/DROP 标签）

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

- **返回：** 成功时返回串行化的 QueryResponse，或错误状态


---

## TpExecutionSlotPool

**全名：** `neug::TpExecutionSlotPool`

用于并发查询执行的数据库槽位池。

`TpExecutionSlotPool` 拥有并调度一组固定的 `ExecutionSlot` 实例用于 TP 查询执行。每个对齐的 Entry 借用一个稳定的、由数据库拥有的每槽位 WAL 写入器。
`TpExecutionSlotPool` 在内部被 `NeugDBService`。对于大多数用例，请通过 `NeugDBService::AcquireExecutionSlot()` 而不是直接通过该池访问。

**主要特性：**
- 拥有用于查询执行的服务本地槽位
- 使用 bthread 同步的线程安全租用/释放
- 每个逻辑槽位拥有稳定的 WAL（预写日志）写入器
- 4096 字节对齐的每槽位 Entry 存储

**池大小：** 服务根据 ``ServiceConfig::thread_num`` and `NeugDBConfig::max_thread_num` 确定其并发度，然后将该值传递给池。每个 TP 查询在其执行期间租用一个槽位。

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

使用数据库所有的分配器构建一个池。

此重载保留了原始的源码兼容行为。需要更小执行限制的服务代码应使用接受显式槽位数的重载。

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

如果没有可用的槽位，则阻塞。

- **返回：** `ExecutionSlotLease` 用于管理已租用的槽位。当租用超出作用域时，槽位会被归还至池中。

#### `getExecutedQueryNum() const`

获取所有槽位中已执行查询的总数。

预期调用方持有锁。

- **返回：** 已执行查询的总数。


---

## ExecutionSlotLease

**全名：** `neug::ExecutionSlotLease`

用于独占使用 TP 的仅移动 RAII 句柄 `ExecutionSlot`.

`TpExecutionSlotPool` 注入一个 noexcept 释放操作，以便该句柄可以返回该槽位，而无需向 `ExecutionSlot`.
