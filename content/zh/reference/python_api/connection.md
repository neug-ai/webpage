<a id="neug.connection"></a>

# 模块 neug.connection

Neug 连接模块。

<a id="neug.connection.annotations"></a>

## 连接对象

```python
class Connection(object)
```

Connection 表示到数据库的逻辑连接。用户应使用此类与数据库进行交互，
例如执行查询和管理事务。
连接由 `Database.connect` 方法创建，不再需要时应通过调用 `close` 方法关闭。
如果数据库被关闭，所有到该数据库的连接将自动关闭。

<a id="neug.connection.Connection.__init__"></a>

### \_\_init\_\_

```python
def __init__(py_connection)
```

初始化一个 Connection 对象。
- **参数:**
  - `py_connection` (PyConnection)
    提供实际数据库连接的底层 c++ 连接对象。

<a id="neug.connection.Connection.is_open"></a>

### is\_open

```python
@property
def is_open() -> bool
```

检查连接是否已打开。
- **返回:**
  - **bool**
    如果连接已打开则返回 True，否则返回 False。

<a id="neug.connection.Connection.close"></a>

### close

```python
def close()
```

关闭连接。活动的显式事务将被回滚。

<a id="neug.connection.Connection.has_active_transaction"></a>

### has_active_transaction

```python
@property
def has_active_transaction() -> bool
```

此连接是否具有活动的显式事务。

当事务失败且仅能回滚时，该属性仍为 `True`。调用 `rollback()` 可将连接恢复为自动提交模式。

<a id="neug.connection.Connection.begin_transaction"></a>

### begin\_transaction

```python
def begin_transaction(read_only: bool = False)
```

开始一个显式嵌入式 AP 事务。

- **参数：**
  - `read_only` (bool)
    当为 true 时，固定一个读视图并拒绝写入。默认情况下，启动一个带有私有写时复制（COW）视图的读写事务。

- **引发：**
  - **RuntimeError**
    如果连接已关闭或已经存在活动事务。

<a id="neug.connection.Connection.commit"></a>

### commit

```python
def commit()
```

提交活动显式事务。

自 v0.2.1 起，持久化 ``COPY FROM`` 语句——可以
与普通 DML/DDL 和 ``COPY TEMP`` 在同一个读写
事务中组合——通过单个检查点发布。其他写入
使用普通的逻辑 WAL 提交路径。仅可回滚事务
必须改为回滚。

<a id="neug.connection.Connection.rollback"></a>

### rollback

```python
def rollback()
```

回滚当前的显式事务，并返回自动提交模式。

<a id="neug.connection.Connection.execute"></a>

### execute

```python
def execute(query: str,
            access_mode="",
            parameters: Optional[Dict[str, Any]] = None) -> QueryResult
```

在数据库上执行 cypher 查询。用户可以在单个字符串中指定多个查询，
用分号分隔。查询将按指定的顺序执行。
如果任何查询失败，整个执行将被回滚。
如果查询是 DDL 查询，例如 `CREATE NODE TABLE`, `CREATE REL TABLE`, `DROP TABLE` 等，数据库将
进行相应的修改。

有关查询语法的详细信息，请参阅 cypher 手册文档。
查询的结果将作为 `QueryResult` 对象返回，该对象包含
查询的结果和查询的元数据。
QueryResult 对象类似于迭代器，提供遍历结果的方法，
例如 `__iter__` 和 `__next__`。

如果查询是 DDL 或 DML 查询，结果将是一个空的 `QueryResult` 对象。

在显式事务中，到达数据库引擎并
失败的查询会使事务变为仅可回滚状态。调用 `rollback()` 以执行
另一个查询。在执行前发生的客户端验证错误，例如
无效的 `access_mode`，不会改变事务状态。

某些 cypher 查询可以改变数据库的状态，例如 `CREATE NODE TABLE`, `INSERT`,
`UPDATE`, `DELETE` 等。其他查询，例如 `MATCH(n) RETURN n.id`，不会改变
数据库的状态，但会返回查询的结果。

如果数据库以只读模式打开，任何 DDL 或 DML 查询都会引发异常。
如果数据库以读写模式打开，则可以执行所有查询，并且数据库的状态将
相应地改变。

```python

    >>> from neug import Database
    >>> db = Database("/tmp/test.db", mode="w")
    >>> conn = db.connect()
    >>> res = conn.execute('CREATE NODE TABLE Person(id INT64, name STRING);')
    >>> res = conn.execute('CREATE REL TABLE KNOWS(FROM Person TO Person, weight DOUBLE);')
    >>> res = conn.execute('COPY Person FROM "person.csv"')
    >>> res = conn.execute('COPY KNOWS FROM "knows.csv" (from="Person", to="Person");')
    >>> res = conn.execute('MATCH(n) RETURN n.id')
    >>> for record in res:
    >>>    print(record)
    >>> res = conn.execute('MATCH(p:Person)-[:KNOWS]->(q:Person) RETURN p.id, q.id LIMIT 10;')
    >>> # submitting query with parameters
    >>> res = conn.execute(
        'MATCH (n:Person) WHERE n.id = $id RETURN n.name', access_mode='r', parameters={'id': 12345})

```

- **参数：**
  - `query` (str)
    要执行的查询。
  - `access_mode` (str)
    查询的访问模式。可以是 `read(r)`, `insert(i)`, `update(u)`（包括删除），
    或 `schema(s)` 用于模式修改。用户应为查询指定正确的访问模式
    以确保数据库的正确性。如果未指定访问模式，则从
    查询文本中推断。支持的访问模式包括：
    - `read`,`r`,`READ`,`R`：用于只读查询
    - `insert`,`i`,`INSERT`,`I`：用于仅插入查询
    - `update`,`u`,`UPDATE`,`U`：用于更新查询（包括删除）
    - `schema`,`s`,`SCHEMA`,`S`：用于模式修改操作
  - `parameters` (dict[str, Any] | None)
    查询中要使用的参数。参数应为一个字典，其中键为
    参数名称，值为参数值。如果不需要参数，可以将其设置为 None。

- **返回：**
  - `query_result` (QueryResult)
    查询的结果。

<a id="neug.connection.Connection.get_schema"></a>

### get\_schema

```python
def get_schema()
```

获取 NeuG 数据库的模式。

**返回**：

NeuG 数据库的模式。
