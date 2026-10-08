<a id="neug.query_result"></a>

# 模块 neug.query\_result

Neug 结果模块。

<a id="neug.query_result.QueryResult"></a>

## QueryResult 对象

```python
class QueryResult(object)
```

QueryResult 表示 Cypher 查询的结果。可作为迭代器进行访问。

它具有以下方法来遍历结果。
    - `hasNext()`: 如果还有更多结果可供迭代，则返回 True。
    - `getNext()`: 将下一个结果作为列表返回。
    - `length()`: 返回结果总数。
    - `column_names()`: 将投影的列名作为字符串返回。

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

### get\_bolt\_response

```python
def get_bolt_response() -> str
```

获取 Bolt 响应格式的结果。
TODO(zhanglei,xiaoli): 确保与 neo4j bolt 响应的格式一致性。

- **返回:**
  - **str**
    Bolt 响应格式的结果。

<a id="neug.query_result.QueryResult.has_profile_result"></a>

### has\_profile\_result

```python
def has_profile_result() -> bool
```

检查性能分析结果是否可用。

- **返回：**
  - **bool**
    如果查询在 PROFILE 或 EXPLAIN 模式下执行，则为 True，
    对于普通查询则为 False。

<a id="neug.query_result.QueryResult.get_profile_text"></a>

### get\_profile\_text

```python
def get_profile_text() -> str
```

获取人类可读的 PROFILE/EXPLAIN 文本输出。

适用于 CLI 输出和调试。如果没有
可用的 profile 结果，则返回空字符串。

- **返回：**
  - **str**
    带有算子耗时和行数的格式化执行树。
    如果没有可用的 profile 结果，则返回空字符串。

<a id="neug.query_result.QueryResult.get_profile_metrics"></a>

### get\_profile\_metrics

```python
def get_profile_metrics() -> dict
```

以 Python 字典形式返回详细的 PROFILE 或 EXPLAIN 指标。

结果包含完整的执行计划指标，包括查询执行树中每个算子的计时
和输出信息。
如果没有可用的 profile 结果，则返回空字典。

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
