# 连接

**全名：** `neug::Connection`

用于执行 Cypher 查询的数据库连接。

`Connection` 是与 NeuG 数据库交互的主要接口。它提供了执行 Cypher 查询、获取模式信息以及管理连接生命周期的方法。

**使用示例：**
```cpp
// 从数据库获取连接
auto conn = db.Connect();
// 执行读取查询
auto result = conn->Query("MATCH (n:Person) RETURN n.name LIMIT 10", "read");
auto& qr = result.value();
while (qr.hasNext()) {
  std::cout << qr.GetCurrentRowAsString() << std::endl;
  qr.next();
}
// 执行插入查询
conn->Query("CREATE (p:Person {name: 'Alice', age: 30})", "insert");
// 完成后关闭连接
conn->Close();
```

**访问模式：**
- `"read"` 或 `"r"`：只读查询（MATCH、RETURN）
- `"insert"` 或 `"i"`：仅插入操作（CREATE）
- `"update"` 或 `"u"`：更新/删除操作（SET、DELETE、MERGE）
- `"schema"` 或 `"s"`：模式（`Schema`）修改操作（CREATE/DROP 标签）

**线程安全性：** 该类**不是线程安全的**。请勿在同一个连接上并发调用 `Query()`、`GetSchema()` 或 `Close()`。每个线程应使用独立的连接。

**生命周期：**
- 通过 `NeugDB::Connect()` 创建
- 通过 `Query()` 方法执行查询
- 通过 `Close()` 关闭连接，该操作会自动注销该连接
- 析构函数中会自动关闭并注销连接

### 公共方法

#### `Query(...)`

```cpp
Query(
    const std::string &query_string,
    const std::string &access_mode="",
    const execution::ParamsMap &parameters={}
)
```

执行 Cypher 查询并返回结果。

针对数据库编译并执行一条 Cypher 查询字符串。该查询将经由查询规划器（planner）进行优化，再交由查询处理器（query processor）执行。

**使用示例：**
```cpp
// 简单读取查询
auto result = conn->Query("MATCH (n:Person) RETURN n.name", "read");
// 带参数的查询
neug::execution::ParamsMap params;
params["min_age"] = neug::Value(18);
result = conn->Query("MATCH (p:Person) WHERE p.age > $min_age RETURN p",
"read", params);
// 处理结果
if (result.has_value()) {
  auto& qr = result.value();
  while (qr.hasNext()) {
    // 通过 qr.GetString(0)、qr.GetInt32(1) 等方式访问各列
    qr.next();
  }
} else {
  std::cerr << "查询失败：" << result.error().message() << std::endl;
}
```

- **参数说明：**
  - `query_string`：待执行的 Cypher 查询语句
  - `access_mode`：查询访问模式：

- `"read"` 或 `"r"`：仅读取操作
- `"insert"` 或 `"i"`：仅插入操作（CREATE）
- `"update"` 或 `"u"`：更新/删除操作
- `"schema"` 或 `"s"`：`Schema` 修改操作
- 空字符串：根据查询文本自动推断访问模式
  - `parameters`：参数化查询所用的具名参数。键为参数名（不含 `$` 符号），值为对应参数值。

- **注意事项：**
  - 对动态值应始终使用参数化查询，以防止注入攻击。
  - 正确指定 `access_mode` 可确保事务处理行为符合预期。

- **返回值：** `result<QueryResult>` 类型对象，其内容为以下二者之一：

- 成功时：包含查询结果的 `QueryResult`
- 失败时：包含错误状态及错误消息的对象

- **自版本：** v0.1.0

#### `Query(...)`

```cpp
Query(
    const std::string &query_string,
    const std::string &access_mode,
    const rapidjson::Value &parameters_json
)
```

执行带有 JSON 参数的 Cypher 查询。

参数值以 JSON 对象的形式提供。

- **参数：**
  - `query_string`
  - `access_mode`
  - `parameters_json`

#### `BeginTransaction(...)`

```cpp
Status BeginTransaction(
    TransactionMode mode = TransactionMode::kReadWrite
)
```

开始一个由该连接拥有的显式嵌入式事务。只读事务会固定一个已发布的视图；读写事务则使用私有的写时复制（copy-on-write）视图，并在调用 `Commit()` 时将所有成功的写操作一并发布。不支持嵌套事务以及从只读升级为读写的操作。

- **参数：**
  - `mode`：`TransactionMode::kReadWrite` 或 `TransactionMode::kReadOnly`
- **返回值：** 成功时返回 `Status::OK`；否则返回连接错误、状态错误、参数错误或不支持的模式错误

#### `Commit()`

```cpp
Status Commit()
```

提交当前的显式事务。提交失败会使连接进入仅回滚（rollback-only）状态；在重新使用该连接前，需先调用 `Rollback()`。

#### `Rollback()`

```cpp
Status Rollback()
```

放弃当前活跃的事务或仅回滚的事务，并将连接恢复为自动提交模式。

#### `HasActiveTransaction() const`

```cpp
bool HasActiveTransaction() const noexcept
```

返回此连接是否具有活动的或仅回滚的显式事务。

#### `GetSchema() const`

以 `YAML` 字符串形式获取数据库的 Schema。

返回完整的图谱 Schema 定义（`YAML` 格式），包括所有顶点类型、边类型及其属性。

**使用示例：**
```cpp
std::string schema_yaml = conn->GetSchema();
std::cout << "Schema:\n" << schema_yaml << std::endl;
```

- **抛出异常：**
  - `std::runtime_error`：若连接已关闭

- **返回值：** `std::string` 类型，为 YAML 格式的 Schema 定义

- **自版本：** v0.1.0

#### `Close()`

关闭连接并释放资源。

将连接标记为已关闭，并释放所有已占用的资源。关闭后，任何 `Query()` 调用都将失败。

**使用示例：**
```cpp
conn->Close();
// 此时 conn->Query(...) 将返回错误
```

- **注意事项：**
  - 连续多次调用该方法是幂等的；但并发调用不安全。
  - 关闭操作会自动将此连接从其所属数据库中注销。
  - 在连接对象的析构函数中也会自动执行关闭操作。

- **自版本：** v0.1.0

#### `IsClosed() const`

检查连接是否已关闭。

- **返回值：** 如果连接已关闭则返回 `true`，如果仍然活跃则返回 `false`

- **自版本：** v0.1.0
