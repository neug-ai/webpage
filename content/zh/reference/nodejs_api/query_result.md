<a id="neug.query_result"></a>

# 模块 neug.query\_result

Neug 结果模块。

<a id="neug.query_result.QueryResult"></a>

## QueryResult 对象

```javascript
class QueryResult
```

`QueryResult` 表示 Cypher 查询的结果。它支持 JavaScript 迭代器协议（`for...of`），并提供用于遍历结果的方法。

它提供以下用于遍历结果的方法：
    - `hasNext()`：如果还有更多结果可供遍历，则返回 `true`。
    - `getNext()`：以数组形式返回下一个结果。
    - `getAt(index)`：返回指定索引位置的结果。
    - `length()`：返回结果的总数。
    - `columnNames()`：以字符串形式返回投影列的名称。
    - `getProfileMetrics()`：返回结构化的 `PROFILE` 或 `EXPLAIN` 指标。

```javascript

    const { Database } = require('neug');
    const db = new Database({ databasePath: '/tmp/test.db', mode: 'r' });
    const conn = db.connect();
    const result = conn.execute('MATCH (n) RETURN n');
    for (const row of result) {
        console.log(row);
    }

```

<a id="neug.query_result.QueryResult.constructor"></a>

### 构造函数

```javascript
constructor(nativeResult)
```

初始化 QueryResult。

- **参数：**
  - `nativeResult` (object)
    查询引擎返回的查询结果。它是一个 C++ 对象，通过原生绑定导出至 Node.js。

<a id="neug.query_result.QueryResult.hasNext"></a>

### hasNext

```javascript
hasNext() -> boolean
```

检查是否还有更多可用结果。

- **返回：**
  - **boolean**
    如果还有更多结果则返回 True，否则返回 False。

<a id="neug.query_result.QueryResult.getNext"></a>

### getNext

```javascript
getNext() -> Array
```

获取下一行结果。

- **返回值：**
  - **Array**
    下一行数据，以值数组形式返回。

<a id="neug.query_result.QueryResult.getAt"></a>

### getAt

```javascript
getAt(index) -> Array
```

获取指定索引处的结果。

- **参数：**
  - `index` (number)
    要获取的结果的索引。支持负数索引（例如，`-1` 表示最后一行）。

- **返回：**
  - **Array**
    指定索引处的行。

- **抛出：**
  - **RangeError**
    如果索引超出范围（在解析负数索引之后）。

<a id="neug.query_result.QueryResult.length"></a>

### length

```javascript
length() -> number
```

获取结果总数。

- **返回：**
  - **number**
    结果的数量。

<a id="neug.query_result.QueryResult.columnNames"></a>

### columnNames

```javascript
columnNames() -> string[]
```

以字符串数组的形式返回投影的列名。

<a id="neug.query_result.QueryResult.statusCode"></a>

### statusCode

```javascript
statusCode() -> number
```

获取查询结果的状态码。

- **返回值：**
  - **number**
    0 表示成功，非 0 表示错误。

<a id="neug.query_result.QueryResult.statusMessage"></a>

### statusMessage

```javascript
statusMessage() -> string
```

获取查询结果的状态消息。

- **返回：**
  - **string**
    状态消息。

<a id="neug.query_result.QueryResult.getBoltResponse"></a>

### getBoltResponse

```javascript
getBoltResponse() -> string
```

获取 Bolt 响应格式的结果。

- **返回：**
  - **string**
    Bolt 响应格式的结果。

<a id="neug.query_result.QueryResult.close"></a>

### close

```javascript
close()
```

关闭查询结果并释放资源。

<a id="neug.query_result.QueryResult.getProfileMetrics"></a>

### getProfileMetrics

```javascript
getProfileMetrics() -> Object
```

以 JavaScript 对象形式返回详细的 PROFILE 或 EXPLAIN 指标：

```javascript
{
  total_elapsed_ms: number,
  total_output_rows: number,
  operators: [
    {
      operator_id: number,
      parent_id: number,
      operator_name: string,
      elapsed_ms: number,
      output_rows: number,
      child_ids: number[],
    },
  ],
}
```

当无可获取的 profile 结果时，返回一个空对象。

<a id="neug.query_result.QueryResult.Symbol.iterator"></a>

### \[Symbol.iterator\]

```javascript
[Symbol.iterator]() -> Iterator
```

使 `QueryResult` 可通过 `for...of` 循环进行迭代。每次迭代都会以值数组的形式返回一行数据。

```javascript
const result = conn.execute('MATCH (p:Person) RETURN p.name, p.age');
for (const row of result) {
  console.log(`${row[0]}: ${row[1]}`);
}
```

- **产出：**
  - **Array**
    每行数据以列值数组的形式返回。
