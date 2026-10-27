<a id="neug.query_result"></a>

# 模块 neug.query\_result

Neug 结果模块。

<a id="neug.query_result.QueryResult"></a>

## QueryResult 对象

```python
class QueryResult(object)
```

QueryResult 表示 Cypher 查询的结果。可以像迭代器一样进行遍历。

它具有以下用于遍历结果的方法。
    - `hasNext()`：如果还有更多结果可供迭代，则返回 True。
    - `getNext()`：以列表形式返回下一个结果。
    - `length()`：返回结果总数。
    - `column_names()`：以字符串形式返回投影列名。

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
TODO(zhanglei,xiaoli)：确保与 Neo4j Bolt 响应的格式一致。

- **返回值：**
  - **str**
    Bolt 响应格式的结果。

<a id="neug.query_result.QueryResult.has_profile_result"></a>

### has\_profile\_result

```python
def has_profile_result() -> bool
```

检查概要结果是否可用。

- **返回：**
  - **bool**
    如果查询以 PROFILE 或 EXPLAIN 模式执行，则为 True；
    对于普通查询，则为 False。

<a id="neug.query_result.QueryResult.get_profile_text"></a>

### get_profile_text

```python
def get_profile_text() -> str
```

获取人类可读的 PROFILE/EXPLAIN 文本输出。

适用于 CLI 输出和调试。如果没有可用的分析结果，则返回空字符串。

- **返回值：**
  - **str**
    格式化的执行树，包含算子耗时和行数。如果没有可用的分析结果，则返回空字符串。

<a id="neug.query_result.QueryResult.get_profile_metrics"></a>

### get_profile_metrics

```python
def get_profile_metrics() -> dict
```

以 Python 字典形式返回详细的 PROFILE 或 EXPLAIN 指标。

结果包含完整的执行计划指标，包括查询执行树中每个算子的计时和输出信息。如果没有可用的概要分析结果，则返回空字典。

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

位置元组使用带有生成字段名（f0、f1、...）的 Arrow 结构列。因此，``to_pylist()`` 会为这些列返回字典，而常规查询迭代则返回 Python 列表。

- **返回值：**
  - **pyarrow.Table**
    已转换为 Arrow 表的结果。
