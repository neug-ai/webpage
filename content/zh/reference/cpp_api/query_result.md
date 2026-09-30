# QueryResult

**全名：** `neug::QueryResult`

围绕 protobuf 的轻量级封装 `QueryResponse`.

``QueryResult`` 存储完整的查询响应，并提供以下实用方法：
- 从序列化的 protobuf 字节构造（``From()``），
- 获取行数（``length()``），
- 访问响应模式（``result_schema()``），
- 序列化/反序列化（``Serialize()`` / ``From()``），
- 调试输出（``ToString()``），
- 通过 ` 进行基于游标的行遍历`hasNext()`` / ``next()``,
- 通过 ` 进行类型化单元格访问`GetInt32()``, ``GetString()`` 等。

**类型化访问器：** 每个 getter 从当前游标行读取，并具有两个重载：按列索引或按列名。调用 `IsNull(...)` 在读取可能为 NULL 的单元格之前。时间列（`date`, `timestamp`, `interval`）不作为专用的类型化对象公开：使用 `GetString(...)` 获取其规范字符串形式（例如，`"1970-01-01"`）和 `GetInt64(...)` 获取 `date` / `timestamp` 的原始纪元值 列。

**示例：**
```cpp
auto result = QueryResult::From(serialized);
// Access by column index
while (result.hasNext()) {
    if (!result.IsNull(0)) {
        int32_t id = result.GetInt32(0);
        std::string name = result.GetString(1);
    }
    result.next();
}
// Access by column name
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

### 公共方法

#### `hasNext() const`

检查是否还有更多行可供读取。

#### `next()`

将游标移动到下一行。

如果没有更多可用行则抛出异常（请检查 `hasNext()` 首先）。

#### `Reset()`

将内部游标重置回第一行。

#### `CurrentRowIndex() const`

返回当前游标位置（从 0 开始的行索引）。

#### `IsNull(size_t column_index) const`

检查当前行的单元格是否为 NULL。

- **参数：**
  - `column_index`：从零开始的列索引。

#### `IsNull(const std::string &column_name) const`

检查当前行的指定单元格是否为 NULL。

- **参数：**
  - `column_name`：结果模式中的列名。

#### `GetInt32(size_t column_index) const`

将当前单元格作为有符号 32 位整数返回。

源列的类型必须为 int32 或 `bool`。任何其他源类型都会引发异常。int32 值原样返回；一个 `bool`值被转换为 1 或 0。

- **参数：**
  - `column_index`：从零开始的列索引。

#### `GetInt32(const std::string &column_name) const`

将指定的当前单元格作为有符号 32 位整数返回。

源列的类型必须为 int32 或 `bool`。任何其他源类型都会引发异常。int32 值原样返回；`bool` 值将转换为 1 或 0。

- **参数：**
  - `column_name`：结果模式中的列名。

#### `GetUInt32(size_t column_index) const`

将当前单元格作为无符号 32 位整数返回。

源列的类型必须为 uint32 或 `bool`。任何其他源类型都会引发异常。uint32 值原样返回；`bool` 值将被转换为 1 或 0。

- **参数：**
  - `column_index`：从零开始的列索引。

#### `GetUInt32(const std::string &column_name) const`

将指定的当前单元格作为无符号 32 位整数返回。

源列的类型必须为 uint32 或 `bool`。任何其他源类型都会引发异常。uint32 值原样返回；一个 `bool` 值会被转换为 1 或 0。

- **参数：**
  - `column_name`：结果模式中的列名。

#### `GetInt64(size_t column_index) const`

将当前单元格作为有符号 64 位整数返回。

源列的类型必须为 int64、int32、uint32，`bool`，date 或 timestamp。任何其他源类型都会引发异常。较小的整数会被扩展，`bool` 会被转换为 1 或 0，而 date 和 timestamp 值则以其原始存储的纪元值返回。

- **参数：**
  - `column_index`：从零开始的列索引。

#### `GetInt64(const std::string &column_name) const`

将指定的当前单元格作为有符号 64 位整数返回。

源列的类型必须为 int64、int32、uint32、`bool`、date 或 timestamp。任何其他源类型都会引发异常。较小的整数会被拓宽，`bool`会被转换为 1 或 0，而 date 和 timestamp 值则以其原始存储的纪元值返回。

- **参数：**
  - `column_name`：结果模式中的列名。

#### `GetUInt64(size_t column_index) const`

将当前单元格作为无符号 64 位整数返回。

源列的类型必须为 uint64、uint32 或 `bool`。任何其他源类型都会引发异常。uint32 值会被加宽，而 `bool` 会被转换为 1 或 0。

- **参数：**
  - `column_index`：从零开始的列索引。

#### `GetUInt64(const std::string &column_name) const`

将指定的当前单元格作为无符号 64 位整数返回。

源列的类型必须为 uint64、uint32 或 `bool`。任何其他源类型都会引发异常。uint32 值会被拓宽，而 `bool` 会被转换为 1 或 0。

- **参数：**
  - `column_name`：结果模式中的列名。

#### `GetFloat(size_t column_index) const`

将当前单元格作为单精度浮点值返回。

源列的类型必须为 `float`、int32、uint32 或 `bool`。任何其他源类型都会引发异常。整数将被转换为 `float`，且 `bool` 将被转换为 1.0 或 0.0。

- **参数：**
  - `column_index`：从零开始的列索引。

#### `GetFloat(const std::string &column_name) const`

将指定的当前单元格作为单精度浮点值返回。

源列的类型必须为 `float`、int32、uint32 或 `bool`。任何其他源类型都会引发异常。整数将被转换为 `float`，而 `bool` 将被转换为 1.0 或 0.0。

- **参数：**
  - `column_name`：结果模式中的列名。

#### `GetDouble(size_t column_index) const`

将当前单元格作为`double`精度浮点值。

源列的类型必须为`double`, `float`、int32、uint32、int64、uint64 或`bool`。任何其他源类型都会引发异常。数值将转换为`double`，而`bool`将转换为 1.0 或 0.0。较大的 64 位整数可能会丢失精度。

- **参数：**
  - `column_index`：从零开始的列索引。

#### `GetDouble(const std::string &column_name) const`

将指定的当前单元格返回为 `double`-精度的浮点值。

源列的类型必须为 `double`, `float`, int32, uint32, int64, uint64 或 `bool`. 任何其他源类型都会引发异常。数值将被转换为 `double`, 而 `bool` 将被转换为 1.0 或 0.0。较大的 64 位整数可能会丢失精度。

- **参数：**
  - `column_name`: 结果模式中的列名。

#### `GetString(size_t column_index) const`

将当前单元格作为字符串返回。

此 getter 支持所有源列类型。字符串值直接返回；所有其他值使用其人类可读的表示形式。

- **参数：**
  - `column_index`：从零开始的列索引。

#### `GetString(const std::string &column_name) const`

将指定的当前单元格作为字符串返回。

此 getter 支持所有源列类型。字符串值直接返回；所有其他值使用其人类可读的表示形式。

- **参数：**
  - `column_name`: 结果模式中的列名。

#### `GetBool(size_t column_index) const`

将当前单元格作为布尔值返回。

源列的类型必须为 `bool`。任何其他源类型都会引发异常。`bool` 值将原样返回。

- **参数：**
  - `column_index`：从零开始的列索引。

#### `GetBool(const std::string &column_name) const`

将指定的当前单元格作为布尔值返回。

源列的类型必须为 `bool`。任何其他源类型都会引发异常。该`bool`值将原样返回。

- **参数：**
  - `column_name`：结果模式中的列名。

#### `ColumnCount() const`

获取列数。

#### `ColumnNames() const`

从模式中获取列名。

#### `ToString() const`

将整个结果集转换为字符串。

#### `GetCurrentRowAsString() const`

将当前游标行转换为人类可读的字符串。

生成该行各列值的逗号分隔列表（NULL 单元格显示为 "null"）。在遍历使用 `hasNext()`/next()。如果游标超过结果集末尾，则抛出异常。

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

#### `has_profile_result() const`

检查性能分析结果是否可用。

#### `profile_result_text() const`

获取人类可读的 PROFILE/EXPLAIN 文本输出。

如果没有可用的 profile_result，则返回空字符串。适用于 CLI 输出和调试。
