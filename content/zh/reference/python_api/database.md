<a id="neug.database"></a>

# 模块 neug.database

Neug 数据库模块。

<a id="neug.database.time"></a>

## 数据库对象

```python
class Database(object)
```

NeuG 数据库的入口类。

该类用于打开数据库连接并管理数据库。用户应使用此类打开数据库连接，然后调用 `connect` 方法获取一个 `Connection` 对象，以与数据库进行交互。

若将空字符串作为数据库路径传入，则数据库将以内存模式（in-memory mode）打开。

数据库可采用不同模式（只读或读写）及不同查询规划器（planner）打开。

当数据库以只读模式打开时，其他数据库实例（无论在同一进程内还是不同进程中）也可同时以只读模式打开同一数据库目录。
当数据库以读写模式打开时，则不允许任何其他数据库实例（无论在同一进程内还是不同进程中）以只读或读写模式打开同一数据库目录。

注意：即使以只读模式打开数据库，仍需提供一个可写的数据库数据目录：锁文件（lock file）在需要时按需创建；只读进程会在其自身的 `runtime/open-<epoch>/` 目录下创建临时工作文件。因此，只读模式无法在只读文件系统或只读挂载点上使用。

当数据库被关闭时，所有指向该数据库的连接将自动关闭。

```python

    >>> from neug import Database
    >>> db = Database("/tmp/test.db", mode="w")
    >>> conn = db.connect()

    >>> # 使用该连接与数据库交互
    >>> conn.execute('CREATE NODE TABLE Person(id INT64, name STRING);')
    >>> conn.execute('CREATE REL TABLE KNOWS(FROM Person TO Person, weight DOUBLE);')

    >>> # 从 CSV 文件导入数据
    >>> conn.execute('COPY Person FROM "person.csv"')
    >>> conn.execute('COPY KNOWS FROM "knows.csv" (from="Person", to="Person");')

    >>> res = conn.execute('MATCH(n) RETURN n.id;')
    >>> for record in res:
    >>>     print(record)

```

<a id="neug.database.Database.__init__"></a>

### `__init__`

```python
def __init__(db_path: str = None,
             mode: str = "read-write",
             max_thread_num: int = 0,
             checkpoint_on_close: bool = True,
             buffer_strategy: str = "M_FULL")
```

打开一个数据库。

- **参数：**
  - `db_path`（字符串）
    数据库文件的路径，必填。若设为空字符串，则以内存模式打开数据库。
    注意：在内存模式下，数据库不会持久化到磁盘，程序退出时所有数据都将丢失。此时，`db_path` 不应包含任何非法字符。
  - `mode`（字符串）
    打开数据库的模式，可选值为 `'r'`、`'read'`、`'readwrite'`、`'w'`、`'rw'` 或 `'write'`。默认为 `'read-write'`。
  - `max_thread_num`（整数）
    数据库查询并发能力；设为 `0` 时将自动选用硬件支持的最大并发线程数（若无法获取则回退为 `1`）；若设置值超过硬件并发数，系统将发出警告并限制为硬件并发数。

    当前嵌入式（AP）查询为单线程；利用此参数实现查询内部并行化属于未来工作。

    在 TP 模式下，该参数用于设定槽位池大小并限制服务线程数量。查询将并发执行，每个查询占用一个槽位/线程。
  - `checkpoint_on_close`（布尔值）
    关闭数据库时是否自动创建检查点（checkpoint）。默认为 `True`。
    若设为 `False`，则关闭数据库时不会自动创建检查点。
  - `buffer_strategy`（字符串）
    数据库所用的缓冲区策略，可选值为 `'InMemory'`（或 `'M_FULL'`）、`'SyncToFile'`（或 `'M_LAZY'`）或 `'HugePagePreferred'`（或 `'M_HUGE'`）。默认为 `'M_FULL'`。该设置控制图数据如何加载进内存，**不影响数据持久性**。
    - `'InMemory'` / `'M_FULL'`：将整个数据库完全加载至内存中。
    - `'SyncToFile'` / `'M_LAZY'`：按需加载数据库页，适用于无法全部装入内存的大型数据库。
    - `'HugePagePreferred'` / `'M_HUGE'`：与 `'InMemory'` 类似，但在系统支持时优先使用大页（Huge Pages）。

- **异常：**
  - **RuntimeError**
    若数据库文件不存在，或指定的 `mode` 无效，则抛出此异常。
  - **ValueError**
    若 `mode` 不是 `'r'`、`'read'`、`'w'`、`'rw'` 或 `'write'` 中的任一值，则抛出此异常。
    若查询规划器（planner）不是 `'gopt'`，则抛出此异常。

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
该方法用于启动数据库服务器，以支持远程客户端连接。
调用 `db.serve()` 后，数据库将切换至 TP 模式，并关闭所有已存在的本地数据库连接；此后，将禁止建立任何新的本地数据库连接。
该方法会启动一个监听指定端口的服务器，客户端可通过该端口连接服务器并与数据库交互。用户可使用 `Session` 连接到该服务器。具体用法请参阅 `Session` 的文档。

- **参数：**
  - `port`（int）
    服务器监听的端口号。默认为 `10000`。
  - `host`（str）
    服务器监听的主机地址。默认为 `'localhost'`。
  - `blocking`（bool）
    启动数据库服务器后是否阻塞当前进程。
  - `thread_num`（int）
    服务线程数量。若设为 `0`，则自动选用最大线程数（`max_thread_num`）；显式指定的值不可超过该上限。

    服务线程用于并发执行 TP 查询，但每个查询独占一个执行上下文和一个线程。
  - `auto_compaction`（bool）
    是否在服务期间启用后台自动压缩（compaction）。默认为 `True`。
  - `explicit_transaction_timeout_ms`（int）
    显式事务的绝对生命周期（毫秒）。默认为 `60000`。

- **返回值：**
  - `uri`（str）
    服务器的 URI，格式为 `'http://host:port'`。

- **异常：**
  - **ValueError**
    若 `thread_num` 为负数、大于可用 CPU 核心数，或大于数据库的 `max_thread_num`，则抛出此异常。
  - **RuntimeError**
    若存在尚未关闭的本地数据库连接，则抛出此异常。
    若数据库已处于服务状态（即已调用 `serve()`），则抛出此异常。

- **注意事项：**
  - **启动服务器前，请确保已关闭所有本地数据库连接。**
  - **服务器启动后，将禁止建立任何新的本地数据库连接。**
  - **`thread_num` 控制服务端的服务线程数量；客户端侧的 `Session(..., num_threads=...)` 则控制该客户端所使用的 HTTP 连接池大小。**
  - **`auto_compaction` 控制服务期间后台压缩（compaction）的行为。**

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
def close()
```

关闭数据库及其所有连接。

对于启用了 `checkpoint_on_close=True` 的读写数据库，此方法会在关闭前创建一个检查点（checkpoint）。如果检查点创建失败，`close()` 将抛出异常。具体而言，根据失败发生的时机，数据库可能仍保持打开状态以供再次尝试，也可能已经关闭。在成功关闭后再次调用此方法不会产生任何效果。

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
