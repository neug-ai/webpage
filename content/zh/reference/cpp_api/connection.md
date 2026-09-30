# 连接

**全名：** `neug::Connection`

用于执行 Cypher 查询的数据库连接。

`Connection` 是与 NeuG 数据库交互的主要嵌入式模式接口。它提供了执行 Cypher 查询、检索模式信息、管理程序化 AP 显式事务以及管理连接生命周期的方法。

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
- `"schema"` 或 `"s"`: `Schema` 模式修改操作（CREATE/DROP 标签）

**线程安全性：** 此类不是线程安全的；每个线程使用一个 `Connection`。多个并发连接仅允许在 READ_ONLY 数据库上使用；READ_WRITE 数据库允许单个连接。

**生命周期：**
- 通过 `NeugDB::Connect()`
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

针对数据库编译并执行 Cypher 查询字符串。查询通过规划器进行优化处理，然后由连接拥有的执行槽执行。

**用法示例：** 
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
- `"insert"` 或 `"i"`：仅插入操作 (CREATE)
- `"update"` 或 `"u"`：更新/删除操作
- `"schema"` 或 `"s"`: `Schema` 修改操作
- 空字符串：从查询文本推断访问模式
  - `parameters`：参数化查询的命名参数。键为参数名称（不带 `$`），值为参数值。

- **注意：**
  - 对动态值使用参数化查询以防止注入。
  - 指定正确的 access_mode 可确保正确的事务处理。
  - 在活动显式事务中，此查询使用连接拥有的固定读视图或私有 COW 写视图。不支持 Cypher BEGIN/COMMIT/ROLLBACK 语句；请使用下面的编程控制方法。

- **返回：** `result<QueryResult>`，包含以下之一：

- `QueryResult`，成功时包含查询结果
- 失败时包含错误状态和消息

- **起始版本：** v0.1.0

#### `BeginTransaction(TransactionMode mode=TransactionMode::kReadWrite)`

开始一个由连接拥有的嵌入式 AP 显式事务。

只读事务锁定一个已发布的读视图，跨越 `Query()` 次调用。读写事务拥有一个私有的 COW 视图；成功的写入对后续在此 `Connection` 上的查询可见，并由 `Commit()` 一起发布。读写 AP 事务持有排他性的 AP 准入，直到终止操作。
持久化的 COPY FROM 语句可以与读写事务中的普通 DML 和 DDL 分组，并在 `Commit()` 发布。LOAD FROM 可以在读写事务中驱动普通 DML；仅图只读的 LOAD FROM 和 COPY TO 语句可以在任一事务模式下运行。COPY TO 输出是外部的，不会被 `Rollback()` 移除。COPY TEMP 可以与读写事务中的持久化图变更混合；只有持久化更改才会写入磁盘。

- **参数：**
  - `mode`

- **注意：**
  - 此 API 不是 Cypher BEGIN 语句，不支持嵌套事务或从读升级到写。

- **返回：** `Status::OK` 成功时返回。否则：

- ERR_CONNECTION_CLOSED 如果此 `Connection` 已关闭
- ERR_TX_STATE_CONFLICT 如果事务已处于活动状态
- ERR_INVALID_ARGUMENT 如果请求的模式无效，或者在只读数据库上请求读写事务
- ERR_NOT_SUPPORTED 如果执行模式不支持嵌入式显式事务

#### `Commit()`

提交活动的显式事务。

读写事务会一次性发布其累积的逻辑重做，在持久化 COPY FROM 进行批量变更时发布一个检查点，或者发布一个没有持久化输出的仅瞬态图。只读事务仅释放其固定的读视图。

- **返回：** 如果没有活动事务或事务为仅可回滚状态，则返回事务状态错误。失败的提交会使`Connection` 事务处于仅可回滚状态；请调用 `Rollback()` 后再重新使用。

#### `Rollback()`

中止活动或仅可回滚的显式事务。

丢弃私有写时复制视图（如果有），并将`Connection` 置为空闲状态。

#### `HasActiveTransaction() const noexcept`

返回此`Connection`是否包含未完成的显式事务。

返回`true`对于活动状态和仅可回滚状态均返回。只有成功的`Commit()`或`Rollback()`才会将`Connection`恢复为空闲状态。

#### `GetSchema() const`

将数据库模式获取为 `YAML` 字符串。

返回完整的图模式定义，格式为 `YAML`，包括所有节点类型、边类型及其属性。

**使用示例：**
```cpp
std::string schema_yaml = conn->GetSchema();
std::cout << "Schema:\n" << schema_yaml << std::endl;
```

- **注意：**
  - 在活动显式事务期间，这将返回该事务固定的读取模式或私有 COW 模式，而不是已发布的模式。

- **抛出异常：**
  - `std::runtime_error`：如果连接已关闭
  - TxStateConflictException：如果活动事务为仅可回滚状态

- **返回：** `std::string` YAML 格式的模式定义

- **起始版本：** v0.1.0

#### `Close()`

关闭连接并释放资源。

将连接标记为已关闭并释放所有持有的资源。关闭后，任何 `Query()`调用都将失败。

**用法示例：**
```cpp
conn->Close();
// conn->Query(...) will now return an error
```

- **注意：**
  - 连续重复调用是幂等的。并发调用不安全。
  - 关闭操作会自动将此连接从其所属数据库中注销。
  - 该连接也会在析构函数中自动关闭。
  - 在临时模式清理和执行槽销毁之前，活动或仅可回滚的显式事务会被回滚。

- **起始版本：** v0.1.0

#### `IsClosed() const`

检查连接是否已关闭。

- **返回值：** 如果连接已关闭则返回 `true`，如果仍然活跃则返回 `false`

- **自版本：** v0.1.0
