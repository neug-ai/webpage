# QueryResult

**全名：** `neug::QueryResult`

protobuf `QueryResponse` 的轻量级封装。

`QueryResult` 存储完整的查询响应，并提供以下实用方法：
- 从序列化的 protobuf 字节进行构造（`From()`），
- 获取行数（`length()`），
- 访问响应模式（`result_schema()`），
- 序列化/反序列化（`Serialize()` / `From()`），
- 调试输出（`ToString()`），
- 通过 `hasNext()` / `next()` 进行基于游标的行遍历，
- 通过 `GetInt32()`、`GetString()` 等进行类型化单元格访问。

### 游标遍历

#### `hasNext() const`

检查是否还有更多行可供消费。

#### `next()`

将游标移动到下一行。若无更多可用行，则抛出异常。

#### `Reset()`

将内部游标重置回第一行。

#### `CurrentRowIndex() const`

返回当前光标位置（从 0 开始的行索引）。

### 类型化值访问器

所有 getter 方法均从**当前游标行**读取数据。每个方法均有两种重载：按列索引或按列名。

#### `IsNull(size_t column_index)` / `IsNull(const std::string& column_name)`

检查当前行的单元格是否为 NULL。

#### `GetInt32(...)` —— 接受 `int32`、`bool`

#### `GetUInt32(...)` —— 接受 `uint32`、`bool`

#### `GetInt64(...)` — 接受 `int64`、`int32`、`uint32`、`bool`、`date`、`timestamp`（date/timestamp 返回原始的 int64 纪元值）

#### `GetUInt64(...)` —— 接受 `uint64`、`uint32`、`bool`

#### `GetFloat(...)` — 接受 `float`、`int32`、`uint32`、`bool`

#### `GetDouble(...)` — 接受 `double`、`float`、`int32`、`uint32`、`int64`、`uint64`、`bool`

#### `GetString(...)` — 接受**任意类型**（回退为字符串表示形式）

#### `GetBool(...)` — 仅接受 `bool` 类型

> 时间类型列（`date`、`timestamp`、`interval`）不会作为专用的类型化对象暴露。请使用 `GetString(...)` 获取其标准字符串形式（例如 `"1970-01-01"`），并使用 `GetInt64(...)` 读取 `date` / `timestamp` 列的原始纪元值。

### 元数据

#### `ColumnCount() const`

获取列数。

#### `ColumnNames() const`

从模式中获取列名。

### 其他方法

#### `ToString() const`

将整个结果集转换为字符串。

#### `GetCurrentRowAsString() const`

将**当前游标行**转换为易于阅读的逗号分隔字符串（NULL 单元格显示为 `null`）。在使用 `hasNext()` / `next()` 进行迭代时，可方便地打印行数据。若游标超出结果集末尾，则会抛出异常。

#### `length() const`

获取总行数。

#### `result_schema() const`

获取结果模式元数据。

#### `response() const`

获取底层 protobuf 响应（`const` 引用）。

#### `shared_response() const`

获取底层 protobuf 响应的共享所有权。

当调用者需要将响应的生命周期延长到 `QueryResult` 之外时（例如零拷贝 Arrow 导出），此方法非常有用。

#### `Serialize() const`

将整个结果集序列化为字符串。

### 示例

```cpp
auto result = QueryResult::From(serialized);

// 按列索引访问
while (result.hasNext()) {
    if (!result.IsNull(0)) {
        int32_t id = result.GetInt32(0);
        std::string name = result.GetString(1);
    }
    result.next();
}

// 按列名访问
result.Reset();
while (result.hasNext()) {
    if (!result.IsNull("id")) {
        int32_t id = result.GetInt32("id");
        std::string name = result.GetString("name");
        double score = result.GetDouble("score");
    }
    result.next();
}
```
