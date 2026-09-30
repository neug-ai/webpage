# NeugDB

**全称：** `neug::NeugDB`

NeuG 图数据库系统的核心数据库引擎。

`NeugDB` 作为所有 NeuG 图数据库操作的**主要入口点**。它提供了完整的生命周期管理 API，包括数据库初始化、查询执行和优雅关闭。

**使用示例：** 
```cpp
// Create and open database
neug::NeugDB db;
db.Open("/path/to/data", 4);  // 4 threads
// Create connection and execute query
auto conn = db.Connect();
auto result = conn->Query("MATCH (n:Person) RETURN n LIMIT 10");
// Process results
auto& qr = result.value();
while (qr.hasNext()) {
  std::cout << qr.GetCurrentRowAsString() << std::endl;
  qr.next();
}
// Close database (persists data)
db.Close();
```

**核心组件：**
- `PropertyGraph`：底层图数据存储引擎
- `ExecutionSlot`：Cypher 查询编译与执行
- `ConnectionManager`：客户端连接池管理
- `IGraphPlanner`：查询优化（GOPT 或贪心规划器）

**数据库模式：**
- `DBMode::READ_ONLY`：用于分析工作负载的只读访问
- `DBMode::READ_WRITE`：完整的事务读写访问

**线程安全：** `Connection` 的创建和注册是同步的，并且不同的连接可以并发执行查询。单独的 `Connection` 实例不是线程安全的。

**资源管理：**
- 文件锁跨进程串行化写访问：以读写模式打开的数据库是独占的，而多个只读进程（或一个进程内的多个只读实例）可以并发共享同一个数据库目录
- 用于崩溃恢复的自动 WAL（预写日志）
- 关闭时可配置检查点

### 公共方法

#### `Open(...)`

```cpp
Open(
    const std::string &data_dir,
    int32_t max_thread_num=0,
    const DBMode mode=DBMode::READ_WRITE,
    const std::string &planner_kind="gopt",
    bool checkpoint_on_close=true
)
```

从持久化存储中打开数据库。

从指定的数据目录初始化并打开 NeuG 数据库。此方法加载图模式、顶点/边数据，并初始化查询处理器和规划器。

**数据目录结构：** 检查点数据组织如下：
- `checkpoint/CURRENT`：原子发布的清单 ID
- `checkpoint/manifests/`：不可变的清单文件
- `checkpoint/objects/`：不可变的模块对象
- `wal/<id>/`：每个清单的 WAL 纪元
- `runtime/open-<epoch>/`：打开进程的易变分配器工作区

**用法示例：**
```cpp
neug::NeugDB db;
// Simple open with defaults
db.Open("/path/to/graph");
// Open with custom settings (8 threads, read-write mode, GOPT planner)
db.Open("/path/to/graph", 8, neug::DBMode::READ_WRITE, "gopt");
```

- **参数：**
  - `data_dir`: `Path` 指向图数据目录
  - `max_thread_num`：数据库查询容量。0 选择硬件并发数（回退为 1）；正值按原样接受，负值被拒绝。AP 查询为单线程；查询内并行是未来的工作。在 TP 模式下，它是默认的服务执行槽容量；显式指定较小的 `ServiceConfig::thread_num` 会减少服务本地池。
  - `mode`：数据库访问模式（READ_ONLY 或 READ_WRITE）
  - `planner_kind`：查询规划器类型："gopt"（图优化器）或 "greedy"
  - `checkpoint_on_close`：关闭时创建检查点（持久化数据）

- **注意：**
  - 此重载主要为 Python 绑定设计。
  - 对于 C++ 用法，建议使用基于配置的 Open(NeugDBConfig&) 重载。

- **返回：** `true` 如果数据库成功打开，`false` 否则

- **起始版本：** v0.1.0

#### `Open(const NeugDBConfig &config)`

使用配置对象打开数据库。

通过 `NeugDBConfig` 结构体打开数据库，该结构体提供全面的配置选项。

**使用示例：**
```cpp
neug::NeugDBConfig config;
config.data_dir = "/path/to/graph";
config.max_thread_num = 8;
config.mode = neug::DBMode::READ_WRITE;
config.memory_level = 1;  // 使用内存映射虚拟内存
neug::NeugDB db;
db.Open(config);
```

- **参数：**
  - `config`：包含所有数据库设置的配置对象

- **返回值：** 若数据库成功打开则返回 `true`，否则返回 `false`

- **自版本：** v0.1.0

#### `Close()`

关闭数据库并释放所有资源。

执行数据库的优雅关闭。根据配置：
- 如果启用了 checkpoint_on_close，则创建检查点
- 关闭所有打开的连接
- 释放文件锁

**重要提示：** 始终调用`Close()`，在销毁`NeugDB`实例之前，以确保数据完整性和正确的资源清理。

**使用示例：**
```cpp
neug::NeugDB db;
db.Open("/path/to/data");
// ... perform operations ...
db.Close();  // Persist data and cleanup
```
调用方必须确保没有`Connection`操作正在进行中。

- **注意：**
  - 成功关闭后，此方法是幂等的。如果在消耗活动图之前可选的关闭检查点失败，`Close()`会抛出异常并保持数据库打开，以便调用方可以纠正错误并重试。消耗完成后的失败会完成清理然后重新抛出；该实例无法重用。
  - 关闭后，数据库无法重新打开。创建一个新的`NeugDB`实例以再次打开数据库。

- **起始版本：** v0.1.0

#### `IsClosed() const`

检查数据库是否已关闭。

- **返回值：** 如果数据库已关闭则返回 `true`。

#### `HasActiveService() const`

检查 `NeugDBService` 当前是否与此数据库关联。

最多只能有一个 `NeugDBService` 可以关联到一个 `NeugDB` 实例在任何给定时间。当服务处于关联状态时，通过 `Connect()` 的本地连接将被拒绝，并且 `Close()` 失败。

- **返回：** `true` 如果 `NeugDBService` 与此数据库关联。

#### `HasOpenConnections() const`

检查数据库是否存在打开的本地 AP 连接。

用于防止 AP 到 TP 的转换导致调用方仍持有的连接失效。

#### `Connect()`

创建一个新的数据库连接以执行查询。

创建并返回一个 `Connection` 对象，可用于对数据库执行 Cypher 查询。该连接与来自同一数据库的其他连接共享查询计划器和全局缓存，同时独占其 `ExecutionSlot`。

**用法示例：**
```cpp
auto conn = db.Connect();
auto result = conn->Query("MATCH (n) RETURN count(n)");
if (result.has_value()) {
    std::cout << "Query succeeded" << std::endl;
}
conn->Close();  // Optional: auto-closed on destruction
```

- **注意：**
  - 在 READ_ONLY 模式下，可以创建多个连接。
  - 在 READ_WRITE 模式下，仅允许一个写连接。
  - 调用 `Connection::Close` 会自动注销该连接。
  - 连接共享计划器实例以提高效率。
  - 每个 `Connection` 每次只能由一个线程使用。

- **抛出异常：**
  - `std::runtime_error`：如果数据库未打开或已关闭

- **返回：** `std::shared_ptr`<Connection> 指向新 `Connection`

- **起始版本：** v0.1.0

#### `PrepareForServing()`

为 TP 服务准备已打开的数据库，无需重建规划器。

这要求关闭本地 AP 连接，在需要时持久化并刷新实时图，然后针对刷新后的图重建查询运行时句柄。规划器及其元数据注册表被有意保留，以便在 AP 模式下加载的运行时扩展注册在 TP 模式下保持可用。仅当新的持久检查点启动新的 WAL 时间线时，才会替换版本管理器；否则将保留现有时间线。
新连接接收借用刷新后资源的槽位。
调用方必须先关闭所有本地 `Connection`对象。
