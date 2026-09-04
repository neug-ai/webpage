<a id="neug.session"></a>

# 模块 neug.session

<a id="neug.session.QueryResult"></a>

## 会话对象

```python
class Session()
```

Session 是一个连接到 NeuG 服务器的类。用户可以像使用普通的 NeuG 连接一样使用它，
而实际上它是连接到 NeuG 服务器的一个会话。

NeuG 服务器可以通过 `Database::serve()` 方法启动，并监听指定的端点。

```python

    >>> from neug import Database
    >>> db = Database("/tmp/test.db", mode="w")
    >>> db.serve(port = 10000, host = "localhost")

```

在另一个 Python shell 中，用户可以使用以下代码连接到 NeuG 服务器：

```python

    >>> from neug import Session
    >>> sess = Session('http://localhost:10000', timeout='10s')
    >>> sess.execute('MATCH(n) return count(n)')

```

查询将被发送到 NeuG HTTP 服务器，结果将以响应的形式返回。
会话将自动处理与服务器的连接和断开连接。

要停止 NeuG 服务器，用户可以向进程发送终止信号。
要关闭会话，用户可以调用 `close()` 方法。

<a id="neug.session.Session.__init__"></a>

### \_\_init\_\_

```python
def __init__(endpoint: str = "http://localhost:10000",
             timeout: str = "10s",
             num_threads: int = 1)
```

使用给定的端点和超时初始化一个会话。

**参数**：

- `endpoint`：会话的端点 URL。
- `timeout`：会话的超时持续时间。

<a id="neug.session.Session.open"></a>

### open

```python
@staticmethod
def open(endpoint: str = "http://localhost:10000",
         timeout: str = "10s",
         num_threads: int = 1)
```

使用给定的端点和超时打开一个会话。

**参数**：

- `endpoint`：会话的端点 URL。
- `timeout`：会话的超时持续时间。

**返回**：

Session 类的一个实例。

<a id="neug.session.Session.close"></a>

### close

```python
def close()
```

关闭会话。将尽最大努力回滚当前活跃的显式事务。

<a id="neug.session.Session.has_active_transaction"></a>

### has_active_transaction

```python
@property
def has_active_transaction() -> bool
```

此会话是否具有一个活跃的显式事务。

当发生失败的事务且该事务处于仅回滚（rollback-only）状态时，该属性仍为 `True`。
在执行下一条查询或开启新事务之前，需调用 `rollback()` 来丢弃该事务。

<a id="neug.session.Session.begin_transaction"></a>

### begin_transaction

```python
def begin_transaction(read_only: bool = False)
```

开始一个显式事务。

- **参数：**
  - `read_only`（布尔值）
    若为 `True`，则固定一个只读视图，并拒绝写入操作。默认情况下，将启动一个具有私有写时复制（COW）视图的读写事务。

- **异常：**
  - **ConnectionError**
    如果会话已关闭，或无法连接到服务。
  - **RuntimeError**
    如果会话当前已存在活跃事务，或服务拒绝了事务开始请求。

### commit

```python
def commit()
```

提交当前活跃的显式事务。

仅回滚事务必须执行回滚操作，而不能提交。

<a id="neug.session.Session.rollback"></a>

### rollback

```python
def rollback()
```

回滚当前的显式事务，并返回自动提交模式。

<a id="neug.session.Session.execute"></a>

### execute

```python
def execute(query: str,
            access_mode: str = "",
            parameters: dict = None) -> QueryResult
```

在 NeuG 服务器上执行查询。

当存在显式事务时，该查询将在该事务中运行。若服务报告失败，则事务将变为仅可回滚状态；在发出下一个查询前，需调用 `rollback()`。客户端验证错误（例如无效的 `access_mode`）不会改变事务状态。

**参数**：

- `query`：待执行的查询字符串。
- `access_mode`：查询的访问模式。若省略此参数，NeuG 将根据查询文本自动推断。支持的模式包括：
  - `read` 或 `r`：只读查询
  - `insert` 或 `i`：仅插入操作
  - `update` 或 `u`：更新/删除操作
  - `schema` 或 `s`：模式修改操作
- `parameters`：可选的查询参数字典。

**返回值**：

查询执行的结果。

<a id="neug.session.Session.service_status"></a>

### service\_status

```python
def service_status()
```

获取 NeuG 服务器的服务状态。

**返回**:

NeuG 服务器的状态。

<a id="neug.session.Session.get_schema"></a>

### get\_schema

```python
def get_schema()
```

获取 NeuG 数据库的模式。

**返回**:

NeuG 数据库的模式。

<a id="neug.session.Session.timeout"></a>

### timeout

```python
@property
def timeout()
```

获取会话的超时持续时间，以秒为单位。
