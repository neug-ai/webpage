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

所有 getter 均从**当前游标行**读取。每个方法都有两个重载：
按列索引或按列名。使用 `IsNull(...)` 在读取可空
单元格之前。根据列的基础结果类型选择 getter；这些
方法不会解析或强制转换任意源类型。getter 会抛出
`neug::exception::RuntimeError` 当游标或列选择器无效时，
或当源列类型未列在该 getter 的列表中时。

#### `IsNull(size_t column_index)` / `IsNull(const std::string& column_name)`

检查当前行的单元格是否为 NULL。

#### `GetInt32(...)`

将当前单元格作为有符号32位整数返回。仅当
源列类型为 `int32` 或 `bool`；任何其他源类型都会导致
`neug::exception::RuntimeError`。一个 `int32`值将原样返回，而
`true` 被转换为 `1` 和 `false` 到 `0`.

#### `GetUInt32(...)`

将当前单元格作为无符号 32 位整数返回。仅当源列类型为 `uint32` 或 `bool`；任何其他源类型都会引发
`neug::exception::RuntimeError`。`uint32` 值将原样返回，
而 `true` 会被转换为 `1`，而 `false` 转换为 `0`.

#### `GetInt64(...)`

将当前单元格作为有符号64位整数返回。仅当
源列类型为 `int64`, `int32`, `uint32`, `bool`, `date`，或
`timestamp`；任何其他源类型都会导致 `neug::exception::RuntimeError`。
一个 `int64` 值原样返回，较小的整数会被扩展，布尔值
变为 `1` 或 `0`，并且 `date` / `timestamp` 值作为 NeuG 存储的原始纪元
值返回。

#### `GetUInt64(...)`

将当前单元格作为无符号64位整数返回。仅当源列类型为 `uint64`, `uint32`，或 `bool`；任何其他源
类型都会导致 `neug::exception::RuntimeError`。`uint64` 值原样
返回，`uint32` 值会被扩展，而布尔值变为 `1` 或 `0`.

#### `GetFloat(...)`

将当前单元格作为单精度浮点值返回。仅当源列类型为 `float`, `int32`, `uint32`，或
`bool`；任何其他源类型都会导致 `neug::exception::RuntimeError`。一个
`float` 值原样返回，整数值转换为 `float`，
布尔值变为 `1.0f` 或 `0.0f`.

#### `GetDouble(...)`

将当前单元格作为双精度浮点值返回。仅当源列类型为 `double`, `float`, `int32`, `uint32`,
`int64`, `uint64`，或 `bool`；任何其他源类型都会导致
`neug::exception::RuntimeError`。一个 `double` 值将原样返回，其他
数值将转换为 `double`，而布尔值将变为 `1.0` 或 `0.0`。
大型 64 位整数在转换过程中可能会丢失精度。

#### `GetString(...)`

将当前单元格作为字符串返回。这是唯一一种可以针对所有源列类型调用的类型化获取器。字符串值直接返回；
其他值使用 NeuG 的人类可读字符串表示形式。

#### `GetBool(...)`

将当前单元格作为布尔值返回。仅当源列类型为 `bool`；任何其他源类型都会导致
`neug::exception::RuntimeError`。布尔值将原样返回。

> 时间列（`date`, `timestamp`, `interval`）不会作为
> 专用的类型化对象公开。请使用 `GetString(...)` 获取其规范字符串形式
>（例如 `"1970-01-01"`），并使用 `GetInt64(...)` 读取
> `date` / `timestamp` 列的原始纪元值。

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
