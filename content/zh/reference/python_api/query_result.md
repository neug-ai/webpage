<a id="neug.query_result"></a>

# 模块 neug.query\_result

Neug 结果模块。

<a id="neug.query_result.QueryResult"></a>

## QueryResult 对象

```python
class QueryResult(object)
```

QueryResult 表示 Cypher 查询的结果，可作为迭代器进行遍历。

它提供了以下方法用于遍历查询结果：
    - `hasNext()`：若尚有更多结果可供遍历，则返回 `True`。
    - `getNext()`：以列表形式返回下一个结果。
    - `length()`：返回结果的总数。
    - `column_names()`：以字符串形式返回投影列的名称。
    - `get_profile_metrics()`：返回结构化的 PROFILE 或 EXPLAIN 指标。

```python

    >>> from neug import Database
    >>> db = Database("/tmp/test.db", mode="r")
    >>> conn = db.connect()
    >>> result = conn.execute('MATCH (n) RETURN n')
    >>> for row in result:
    >>>     print(row)

```

<a id="neug.query_result.QueryResult.__init__"></a>

### \_\_init\_\_

```python
def __init__(result)
```

初始化 QueryResult。

- **参数:**
  - `result` (PyQueryResult)
    查询的结果，由查询引擎返回。它是一个 C++ 对象，并通过 pybind 导出到 Python。

<a id="neug.query_result.QueryResult.column_names"></a>

### column\_names

```python
def column_names()
```

以字符串列表的形式返回投影的列名。

<a id="neug.query_result.QueryResult.get_bolt_response"></a>

### get_bolt_response

```python
def get_bolt_response() -> str
```

以 Bolt 响应格式获取结果。
TODO(zhanglei,xiaoli)：确保该格式与 Neo4j Bolt 响应格式保持一致。

- **返回值：**
  - **str**
    以 Bolt 响应格式表示的结果。

### get_profile_metrics

```python
def get_profile_metrics() -> dict
```

以 Python 字典形式返回详细的 PROFILE 或 EXPLAIN 指标：

```python
{
    "total_elapsed_ms": float,
    "total_output_rows": int,
    "operators": [
        {
            "operator_id": int,
            "parent_id": int,
            "operator_name": str,
            "elapsed_ms": float,
            "output_rows": int,
            "child_ids": [int],
        }
    ],
}
```

<a id="neug.query_result.QueryResult.to_arrow"></a>

### to\_arrow

```python
def to_arrow()
```

将结果转换为 Arrow 表。

- **返回:**
  - **pyarrow.Table**
    转换为 Arrow 表的结果。
