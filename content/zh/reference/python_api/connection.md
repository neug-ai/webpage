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

此连接是否具有一个活跃的显式事务。

当事务失败且仅能回滚时，该属性仍为 `True`。调用 `rollback()` 可将连接恢复为自动提交模式。

<a id="neug.connection.Connection.begin_transaction"></a>

### begin_transaction

```python
def begin_transaction(read_only: bool = False)
```

开始一个显式的嵌入式 AP 事务。

- **参数：**
  - `read_only`（bool）：若为 `True`，则固定一个只读视图并拒绝写入操作。默认情况下，将启动一个具有私有写时复制（COW）视图的读写事务。

- **异常：**
  - **RuntimeError**：如果连接已关闭，或当前已存在活跃事务。

### commit

```python
def commit()
```

提交当前的显式事务。仅可回滚的事务必须执行回滚操作，而不能提交。

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

在数据库上执行 Cypher 查询。用户可在单个字符串中指定多个查询，各查询之间以分号分隔。这些查询将按其在字符串中出现的顺序依次执行。若其中任一查询执行失败，则整个执行过程将回滚。

若查询为 DDL（数据定义语言）语句，例如 `CREATE NODE TABLE`、`CREATE REL TABLE`、`DROP TABLE` 等，数据库结构将相应地被修改。

有关查询语法的详细信息，请参阅 Cypher 手册文档。查询结果将以 `QueryResult` 对象形式返回，该对象包含查询结果本身及其元数据。`QueryResult` 对象具有迭代器行为，提供如 `__iter__` 和 `__next__` 等方法，用于遍历查询结果。

若查询为 DDL 或 DML（数据操作语言）语句，则返回的 `QueryResult` 对象为空。

在显式事务中，若某查询已送达数据库引擎但执行失败，则该事务将进入“仅可回滚”（rollback-only）状态。此时，在执行下一条查询前必须先调用 `rollback()`。而发生在执行前的客户端校验错误（例如指定了无效的 `access_mode`）则不会改变当前事务的状态。

部分 Cypher 查询会改变数据库状态，例如 `CREATE NODE TABLE`、`INSERT`、`UPDATE`、`DELETE` 等；而其他查询（如 `MATCH(n) RETURN n.id`）则不会改变数据库状态，仅返回查询结果。

若数据库以只读模式（`read-only mode`）打开，则任何 DDL 或 DML 查询均会抛出异常。若数据库以读写模式（`read-write mode`）打开，则所有查询均可执行，且数据库状态将随之更新。

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
    >>> # 提交带参数的查询
    >>> res = conn.execute(
        'MATCH (n:Person) WHERE n.id = $id RETURN n.name', access_mode='r', parameters={'id': 12345})

```

- **参数说明：**
  - `query`（str）
    待执行的查询语句。
  - `access_mode`（str）
    查询的访问模式。可取值为 `read(r)`（只读）、`insert(i)`（仅插入）、`update(u)`（更新，含删除）或 `schema(s)`（模式修改）。用户应为查询指定正确的访问模式，以确保数据库一致性。若未指定 `access_mode`，NeuG 将根据查询文本自动推断。支持的访问模式包括：
    - `read`、`r`、`READ`、`R`：用于只读查询；
    - `insert`、`i`、`INSERT`、`I`：用于仅插入查询；
    - `update`、`u`、`UPDATE`、`U`：用于更新查询（含删除）；
    - `schema`、`s`、`SCHEMA`、`S`：用于模式修改操作。
  - `parameters`（dict[str, Any] | None）
    查询中使用的参数。该参数应为字典类型，键为参数名，值为对应参数值。若无需参数，可设为 `None`。

- **返回值：**
  - `query_result`（QueryResult）
    查询执行结果。

<a id="neug.connection.Connection.get_schema"></a>

### get\_schema

```python
def get_schema()
```

获取 NeuG 数据库的模式。

**返回**：

NeuG 数据库的模式。
