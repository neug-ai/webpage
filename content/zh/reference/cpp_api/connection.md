# 连接

**全称：** `neug::Connection`

用于执行 Cypher 查询的数据库连接。

`Connection` 是与 NeuG 数据库交互的主要嵌入式模式接口。它提供了执行 Cypher 查询、检索模式信息、管理程序化 API 显式事务以及管理连接生命周期的方法。

**使用示例：** 
```cpp
// Get connection from database
auto conn = db.Connect();
// Execute a read query
auto result = conn->Query("MATCH (n:Person) RETURN n.name LIMIT 10", "read");
auto& qr = result.value();
while (qr.hasNext()) {
  std::cout << qr.GetCurrentRowAsString() << std::endl;
  qr.next();
}
// Execute an insert query
conn->Query("CREATE (p:Person {name: 'Alice', age: 30})", "insert");
// Close connection when done
conn->Close();
```

**访问模式：**
- `"read"` 或 `"r"`：只读查询（MATCH、RETURN）
- `"insert"` 或 `"i"`：仅插入操作（CREATE）
- `"update"` 或 `"u"`：更新/删除操作（SET、DELETE、MERGE）
- `"schema"` 或 `"s"`：`Schema` 修改操作（CREATE/DROP 标签）

**线程安全性：** 此类不是线程安全的；每个线程使用一个 `Connection`。仅在只读（READ_ONLY）数据库上允许多个并发连接；读写（READ_WRITE）数据库仅允许单个连接。

**生命周期：**
- 通过 `NeugDB::Connect()` 创建
- 通过 `Query()` 方法执行查询
- 通过 `Close()` 关闭，这将自动注销连接
- 在析构函数中自动关闭并注销

### 公共方法

#### `Query(...)`

```cpp
Query(
    const std::string &query_string,
    const std::string &access_mode="",
    const rapidjson::Value &parameters=rapidjson::Value{rapidjson::kObjectType}
)
```

执行 Cypher 查询并返回结果。

针对数据库编译并执行 Cypher 查询字符串。查询先经由规划器进行优化，然后由连接拥有的执行槽位执行。

**使用示例：** 
```cpp
// Simple read query
auto result = conn->Query("MATCH (n:Person) RETURN n.name", "read");
// Query with parameters
rapidjson::Document params(rapidjson::kObjectType);
params.AddMember("min_age", 18, params.GetAllocator());
result = conn->Query("MATCH (p:Person) WHERE p.age > $min_age RETURN p",
"read", params);
// Process results
if (result.has_value()) {
  auto& qr = result.value();
  while (qr.hasNext()) {
    std::string name = qr.GetString("n.name");
    qr.next();
  }
} else {
  std::cerr << "Query failed: " << result.error().message() << std::endl;
}
```

- **参数：**
  - `query_string`：要执行的 Cypher 查询
  - `access_mode`：查询访问模式：

- `"read"` 或 `"r"`：只读操作
- `"insert"` 或 `"i"`：仅插入操作（CREATE）
- `"update"` 或 `"u"`：更新/删除操作
- `"schema"` 或 `"s"`：`Schema` 修改操作
- 空字符串：从查询文本推断访问模式
  - `parameters`：用于参数化查询的命名参数。键为参数名（不含 `$`），值为参数值。

- **注意：**
  - 对动态值使用参数化查询以防止注入。
  - 指定正确的 access_mode 可确保正确的事务处理。
  - 在活动显式事务内，此查询使用连接拥有的固定读视图或私有 COW 写视图。不支持 Cypher BEGIN/COMMIT/ROLLBACK 语句；请使用下面的编程控制方法。

- **返回：** `result<QueryResult>`，包含以下内容之一：

- 成功时带有查询结果的 `QueryResult`
- 失败时带有错误消息的错误状态

#### `BeginTransaction(TransactionMode mode=TransactionMode::kReadWrite)`

开始一个由连接拥有的嵌入式 AP 显式事务。

只读事务会在 `Query()` 调用期间固定一个已发布的读视图。读写事务拥有一个私有的 COW（写时复制）视图；成功的写入对后续在此 `Connection` 上的查询可见，并由 `Commit()` 一并发布。读写 AP 事务在到达终止操作之前持有排他的 AP 准入权。
持久的 COPY FROM 语句可以与普通 DML 和 DDL 一起分组在一个读写事务中，并在 `Commit()` 处通过一次检查点发布。LOAD FROM 可以在读写事务中驱动普通 DML；仅图读取的 LOAD FROM 和 COPY TO 语句可以在任一种事务模式下运行。COPY TO 输出是外部的，不会被 `Rollback()` 移除。COPY TEMP 可以与读写事务中的持久化图变更混合使用；只有持久化更改才会写入磁盘。

- **参数：**
  - `mode`

- **注意：**
  - 此 API 不是 Cypher BEGIN 语句，不支持嵌套事务或从只读到读写的升级。

- **返回：** 成功时返回 `Status::OK`。否则：

- 如果此 `Connection` 已关闭，则返回 ERR_CONNECTION_CLOSED
- 如果已有活动事务，则返回 ERR_TX_STATE_CONFLICT
- 如果请求的模式无效，或在只读数据库上请求了读写事务，则返回 ERR_INVALID_ARGUMENT
- 如果执行模式不支持嵌入式显式事务，则返回 ERR_NOT_SUPPORTED

#### `Commit()`

提交活动的显式事务。

读写事务会一次性发布其累积的逻辑重做日志，在持久化 COPY FROM 进行批量变更时发布一个检查点，或者发布一个没有持久化输出的仅瞬态图。只读事务仅释放其固定的读视图。

- **返回：** 如果没有活动事务或事务为仅可回滚状态，则返回事务状态错误。提交失败会使 `Connection` 处于仅可回滚状态；在重用之前请调用 `Rollback()`。

#### `Rollback()`

中止活动或仅可回滚的显式事务。

丢弃私有 COW 视图（如果有），并将 `Connection` 返回到空闲状态。

#### `HasActiveTransaction() const noexcept`

返回此 `Connection` 是否存在未完成的显式事务。

在活动状态和仅可回滚状态下均返回 `true`。只有成功的 `Commit()` 或 `Rollback()` 才会将 `Connection` 恢复为空闲状态。

#### `GetSchema() const`

获取数据库模式，格式为 `YAML` 字符串。

以 `YAML` 格式返回完整的图模式定义，包括所有顶点类型、边类型及其属性。

**使用示例：** 
```cpp
std::string schema_yaml = conn->GetSchema();
std::cout << "Schema:\n" << schema_yaml << std::endl;
```

- **注意：**
  - 在活动显式事务期间，此方法返回该事务固定的读取模式或私有 COW 模式，而非已发布的模式。

- **抛出异常：**
  - `std::runtime_error`：如果连接已关闭
  - TxStateConflictException：如果活动事务处于仅可回滚状态

- **返回值：** `std::string` YAML 格式的模式定义

#### `Close()`

关闭连接并释放资源。

将连接标记为已关闭，并释放所有持有的资源。关闭后，任何 `Query()` 调用都将失败。

**使用示例：** 
```cpp
conn->Close();
// conn->Query(...) will now return an error
```

- **注意：**
  - 顺序重复调用是幂等的。并发调用不安全。
  - 关闭操作会自动从数据库中注销此连接。
  - 连接也会在析构函数中自动关闭。
  - 在临时模式清理和执行槽销毁之前，活动事务或仅可回滚的显式事务会被回滚。

#### `IsClosed() const`

检查连接是否已关闭。

- **返回：**如果连接已关闭，则返回 `true`；如果仍处于活动状态，则返回 `false`
