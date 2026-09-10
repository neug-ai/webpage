# NeugDB

**全称：** `neug::NeugDB`

NeuG 图数据库系统的核心数据库引擎。

`NeugDB` 是所有 NeuG 图数据库操作的**主要入口点**，提供完整的生命周期管理 API，包括数据库初始化、查询执行以及优雅关闭。

**使用示例：**
```cpp
// 创建并打开数据库
neug::NeugDB db;
db.Open("/path/to/data", 4);  // 使用 4 个线程
// 创建连接并执行查询
auto conn = db.Connect();
auto result = conn->Query("MATCH (n:Person) RETURN n LIMIT 10");
// 处理结果
auto& qr = result.value();
while (qr.hasNext()) {
  std::cout << qr.GetCurrentRowAsString() << std::endl;
  qr.next();
}
// 关闭数据库（持久化数据）
db.Close();
```

**核心组件：**
- `PropertyGraph`：底层图数据存储引擎
- `ExecutionSlot`：共享的 AP/TP Cypher 查询编译与执行模块
- `ConnectionManager`：客户端连接池管理
- `IGraphPlanner`：查询优化器（支持 GOPT 或 Greedy 规划器）

**数据库模式：**
- `DBMode::READ_ONLY`：仅读访问，适用于分析型工作负载
- `DBMode::READ_WRITE`：支持完整事务的读写访问

**线程安全性：** 连接的创建与注册是同步的；不同连接可并发执行查询；但单个 `Connection` 实例本身**不是线程安全的**。

**资源管理：**
- 文件锁机制对跨进程的写入访问进行串行化：以读写模式打开的数据库具有排他性；而多个只读进程（或同一进程内的多个只读实例）可并发共享同一数据库目录
- 自动启用 WAL（Write-Ahead Log）以支持崩溃恢复
- 可配置在关闭时执行检查点（checkpoint）

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

从指定的数据目录初始化并打开 NeuG 数据库。该方法加载图模式（graph schema）、顶点/边数据，并初始化查询处理器与查询规划器。

**数据目录结构：** 持久化状态由 `checkpoint/CURRENT` 文件原子性地选定，以不可变的检查点对象（checkpoint objects）、清单文件（manifests）、WAL 时期（WAL epochs）以及每个打开操作对应的运行时工作区（runtime workspaces）形式存储：

```text
data_dir/
├── checkpoint/
│   ├── CURRENT
│   ├── manifests/<id>.manifest
│   └── objects/<object-id>
├── wal/<id>/
└── runtime/open-<epoch>/
```

`CURRENT` 文件以原子方式选定在打开数据库时所使用的清单（manifest）。每个清单记录了其所关联的不可变对象 ID 及其对应 WAL 时期的 `base_ts`（用于限定 WAL 重放范围）。不可达的暂存对象（staging objects）或清单不会被选中。旧版 `checkpoint-N` 目录格式不受支持，且在未修改的情况下将被拒绝。

**使用示例：**
```cpp
neug::NeugDB db;
// 使用默认参数简单打开
db.Open("/path/to/graph");
// 使用自定义设置打开（8 个线程、读写模式、GOPT 规划器）
db.Open("/path/to/graph", 8, neug::DBMode::READ_WRITE, "gopt");
```

- **参数说明：**
  - `data_dir`：图数据目录路径
  - `max_thread_num`：数据库查询并发能力；`0` 表示自动选择硬件并发数（若无法获取则回退为 `1`），更大的值将触发警告并被截断至该值。

    当前嵌入式（AP）查询为单线程；利用此参数实现查询内部并行（intra-query parallelism）属于未来工作。

    在 TP 模式下，该参数用于设定槽位池（slot pool）大小，并限制服务线程数量。查询并发执行，每个查询占用一个槽位/线程。
  - `mode`：数据库访问模式（`READ_ONLY` 或 `READ_WRITE`）
  - `planner_kind`：查询规划器类型：`"gopt"`（图优化器，Graph Optimizer）或 `"greedy"`（贪心规划器）
  - `checkpoint_on_close`：关闭数据库时是否创建检查点（即持久化数据）

- **注意事项：**
  - 此重载版本主要面向 Python 绑定设计。
  - 对于 C++ 使用场景，推荐采用基于配置对象的 `Open(NeugDBConfig&)` 重载版本。

- **返回值：** 若数据库成功打开则返回 `true`，否则返回 `false`

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

执行数据库的优雅关闭。具体行为取决于配置：
- 若启用了 `checkpoint_on_close`，则创建一个检查点（checkpoint）；
- 关闭所有已打开的连接；
- 释放文件锁。

**重要提示：** 在销毁 `NeugDB` 实例前，务必调用 `Close()`，以确保数据完整性及资源的正确清理。

**使用示例：**
```cpp
neug::NeugDB db;
db.Open("/path/to/data");
// ... 执行相关操作 ...
db.Close();  // 持久化数据并执行清理
```

- **注意事项：**
  - 该方法是幂等的——多次调用是安全的；
  - 关闭后，同一 `NeugDB` 实例可再次调用 `Open()` 重新打开；
  - “关闭时创建检查点”为尽力而为（best effort）行为；若创建失败，`Close()` 将记录错误日志、抑制异常，并继续执行后续资源释放；
  - 调用此方法时，不得有任何连接操作正在进行中。

- **自版本：** v0.1.0

#### `IsClosed() const`

检查数据库是否已关闭。

- **返回值：** 如果数据库已关闭则返回 `true`。

#### `Connect()`

为查询执行创建一个新的数据库连接。

创建并返回一个 `Connection` 对象，该对象可用于对数据库执行 Cypher 查询。
连接之间共享查询规划器（planner）和全局查询缓存（global query cache），而每个连接独占其自身的执行槽（execution slot）。

**使用示例：**
```cpp
auto conn = db.Connect();
auto result = conn->Query("MATCH (n) RETURN count(n)");
if (result.has_value()) {
    std::cout << "查询成功" << std::endl;
}
conn->Close();  // 可选：析构时自动关闭
```

- **注意事项：**
  - 在 READ_ONLY 模式下，可创建多个连接。
  - 在 READ_WRITE 模式下，仅允许存在一个写入连接。
  - 调用 `Connection::Close()` 会自动注销该连接。
  - 为提升效率，所有连接共享同一个 planner 实例。
  - 每个连接在同一时刻只能由一个线程使用。

- **异常抛出：**
  - `std::runtime_error`：若数据库未打开或已关闭

- **返回值：** `std::shared_ptr<Connection>` 指向新创建的 `Connection` 的共享指针

- **自版本：** v0.1.0
