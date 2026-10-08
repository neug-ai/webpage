<a id="neug.database"></a>

# 模块 neug.database

Neug 数据库模块。

<a id="neug.database.time"></a>

## 数据库对象

```python
class Database(object)
```

Neug 数据库的入口。

此类用于打开数据库连接并管理数据库。用户应使用此类来
打开数据库连接，然后使用 `connect` 方法来获取一个 `Connection` 对象以与数据库进行交互。

通过将空字符串作为数据库路径传递，数据库将以内存模式打开。

数据库可以使用不同的模式（只读或读写）和不同的规划器打开。

当数据库以只读模式打开时，其他数据库也可以在同一进程内或不同进程中以
只读模式打开相同的数据库目录。
当数据库以读写模式打开时，其他数据库不能在同一进程内或不同进程中以
只读或读写模式打开相同的数据库目录。

请注意，以只读模式打开数据库仍然需要一个可写的数据目录：如果缺少锁文件，则会按需创建，并且只读进程会在其自己的
`runtime/open-<epoch>/` 目录中。只读模式不能用于只读文件系统或挂载点。

当数据库关闭时，所有到该数据库的连接都将自动关闭。

```python

    >>> from neug import Database
    >>> db = Database("/tmp/test.db", mode="w")
    >>> conn = db.connect()

    >>> # Use the connection to interact with the database
    >>> conn.execute('CREATE NODE TABLE Person(id INT64, name STRING);')
    >>> conn.execute('CREATE REL TABLE KNOWS(FROM Person TO Person, weight DOUBLE);')

    >>> # Import data from csv file.
    >>> conn.execute('COPY Person FROM "person.csv"')
    >>> conn.execute('COPY KNOWS FROM "knows.csv" (from="Person", to="Person");')

    >>> res = conn.execute('MATCH(n) RETURN n.id')
    >>> for record in res:
    >>>     print(record)

```

<a id="neug.database.Database.__init__"></a>

### \_\_init\_\_

```python
def __init__(db_path: str = None,
             mode: str = "read-write",
             max_thread_num: int = 0,
             checkpoint_on_close: bool = True,
             buffer_strategy: str = "M_FULL")
```

打开数据库。

- **参数：**
  - `db_path` (str)
    数据库文件的路径。必填。如果设置为空字符串，数据库将以内存模式打开。
    请注意，在内存模式下，数据库不会持久化到磁盘，并且所有数据将在
    程序退出时丢失。在这种情况下，db_path 不应包含任何非法字符。
  - `mode` (str)
    打开数据库的模式。只读：'r', 'read', 'read-only', 'read_only'。
    读写：'w', 'rw', 'write', 'readwrite', 'read-write', 'read_write'。默认为 'read-write'。
  - `max_thread_num` (int)
    数据库查询容量；0 选择硬件并发数（回退为 1），而更高的输入会发出警告并截断至该值。

    嵌入式（AP）查询当前为单线程；将此设置用于查询内并行是未来的工作。

    在 TP 模式下，它是默认的服务执行槽容量。显式设置较小的
    ``serve(thread_num=...)`` 会减少服务本地池。
  - `checkpoint_on_close` (bool)
    关闭数据库时是否自动创建检查点。默认为 True。
    如果为 False，关闭数据库时不会自动创建检查点。
  - `buffer_strategy` (str)
    数据库使用的缓冲策略，可以是 'InMemory'（或 'M_FULL'）、'SyncToFile'（或 'M_LAZY'）
    或 'HugePagePreferred'（或 'M_HUGE'）。默认为 'M_FULL'。此设置控制图数据如何
    加载到内存中；它不影响持久性。
    - 'InMemory' / 'M_FULL'：将数据库完全在内存中打开。
    - 'SyncToFile' / 'M_LAZY'：按需加载数据库页，适用于无法完全放入内存的数据库。
    - 'HugePagePreferred' / 'M_HUGE'：类似于 'InMemory'，但在可用时优先使用大页。

- **引发：**
  - **RuntimeError**
    如果数据库文件不存在或模式无效。
  - **ValueError**
    如果模式不是 'r', 'read', 'w', 'rw', 'write' 之一。
    如果规划器不是 'gopt'。

<a id="neug.database.Database.version"></a>

### version

```python
@property
def version()
```

获取数据库的版本。

<a id="neug.database.Database.mode"></a>

### mode

```python
@property
def mode() -> str
```

获取数据库的模式。

- **返回:**
  - **str**
    数据库的模式，可以是 'r'、'read'、'w'、'rw'、'write'、'readwrite'。

<a id="neug.database.Database.connect"></a>

### connect

```python
def connect() -> Connection
```

连接到数据库。

- **返回:**
  - **Connection**
    用于与数据库交互的 Connection 对象。
- **抛出:**
  - **RuntimeError**
    如果数据库已关闭或未打开。

<a id="neug.database.Database.serve"></a>

### serve

```python
def serve(port: int = 10000,
          host: str = "localhost",
          blocking: bool = True,
          thread_num: int = 0,
          auto_compaction: bool = True,
          explicit_transaction_timeout_ms: int = 60000)
```

启动数据库服务器以处理远程连接（TP 模式）。
此方法用于启动数据库服务器以处理远程连接。
在 db.serve() 将数据库切换到 TP 模式之前，必须关闭所有本地连接。
切换后，不允许建立新的本地连接。
它将启动一个监听特定端口的服务器，客户端可以连接到该服务器与数据库进行交互。
用户可以使用 Session 连接到服务器。有关详细用法，请参阅 Session 的文档。

- **参数：**
  - `port` (int)
    要监听的端口。默认值为 10000。
  - `host` (str)
    要监听的主机。默认值为 'localhost'。
  - `blocking` (bool)
    启动数据库服务器后是否阻塞进程。
  - `thread_num` (int)
    并发执行的服务查询的最大数量。0 表示遵循
    max_thread_num；显式值会被限制在该范围内。

    每个并发执行的 TP 查询使用一个服务执行槽。
  - `auto_compaction` (bool)
    在服务时启用后台自动压缩。默认值为 `True`.
  - `explicit_transaction_timeout_ms` (int)
    显式事务的绝对生命周期（以毫秒为单位）。
    默认值为 `60000`.

- **返回：**
  - `uri` (str)
    服务器的 URI，格式为 'http://host:port'.

- **引发：**
  - **ValueError**
    如果 `thread_num` 为负数或 `explicit_transaction_timeout_ms` 不为
    正数。如果 `thread_num` 超过 `max_thread_num` 或 CPU 数量，则会被限制并给出警告，而不会被拒绝。
  - **RuntimeError**
    如果存在到本地数据库的打开连接。
    如果数据库已经在提供服务。

- **注意：**
  - **在启动服务器之前，请确保关闭所有连接。**
  - **启动服务器后，将不允许建立到本地数据库的新连接。**
  - **`thread_num` 限制服务器端并发查询执行；客户端**
  - **`Session(num_threads=...)` 调整其 HTTP 池大小。**
  - **服务模式在 Windows 上不可用：** 调用 `serve()` 会引发
    `RuntimeError: HTTP server is not enabled in this build.`。请使用 Linux 或
    macOS 主机（或 WSL）来运行服务。

<a id="neug.database.Database.stop_serving"></a>

### stop\_serving

```python
def stop_serving()
```

停止数据库服务器。
此方法用于停止由 `serve` 方法启动的数据库服务器。
调用此方法后，数据库将切换回本地模式，并且将再次允许连接到本地数据库的新连接。

- **抛出:**
  - **RuntimeError**
    如果数据库未在服务状态。

<a id="neug.database.Database.async_connect"></a>

### async\_connect

```python
def async_connect() -> AsyncConnection
```

异步连接到数据库。

- **返回:**
  - **AsyncConnection**
    一个 AsyncConnection 对象，用于异步与数据库交互。
- **抛出:**
  - **RuntimeError**
    如果数据库已关闭或未打开。

<a id="neug.database.Database.close"></a>

### close

```python
def close(log=True)
```

关闭数据库及其所有连接。

对于具有 `checkpoint_on_close=True`”，此方法
在释放数据库资源前会创建一个检查点。
成功关闭后，该方法具有幂等性。在破坏性转储
之前发生的检查点失败会引发异常，并使数据库
保持打开状态，以便调用方更正问题并重试。在
破坏性转储之后发生的失败会完成清理，然后引发异常。

<a id="neug.database.Database.load_builtin_dataset"></a>

### load\_builtin\_dataset

```python
def load_builtin_dataset(dataset_name: str) -> None
```

将内置数据集加载到此数据库中。如果数据库处于只读模式，此方法将引发错误。
如果数据集的模式与数据库的现有模式冲突，此方法将引发错误。

- **参数:**
  - `dataset_name` (str)
    要加载的内置数据集名称

- **抛出:**
  - **RuntimeError**
    如果数据库已关闭或处于只读模式
  - **ValueError**
    如果数据集不存在

<a id="neug.database.Database.from_builtin_dataset"></a>

### from\_builtin\_dataset

```python
@staticmethod
def from_builtin_dataset(dataset_name: str,
                         database_path: str = None,
                         mode: str = "read-write")
```

从内置数据集创建一个数据库实例。

- **参数：**
  - `dataset_name` (str)
    要使用的内置数据集的名称。
  - `database_path` (str)
    数据库文件的路径。如果为 None，则数据库将以内存模式打开。
  - `mode` (str)
    打开数据库的模式，可以是 'r'、'read'、'w'、'rw'、'write'、'readwrite'。
    默认为 'read-write'。

- **返回：**
  - **Database**
    一个已加载内置数据集的数据库实例。
