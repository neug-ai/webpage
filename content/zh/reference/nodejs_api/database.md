<a id="neug.database"></a>

# 模块 neug.database

Neug 数据库模块。

<a id="neug.database.Database"></a>

## 数据库对象

```javascript
class Database
```

NeuG 数据库的入口类。（仅支持 AP 模式。）

该类用于打开数据库连接并管理数据库。用户应使用此类打开数据库连接，然后调用 `connect` 方法获取一个 `Connection` 对象，以与数据库进行交互。

若将空字符串作为数据库路径传入，则数据库将以内存模式打开。

数据库可采用不同模式（只读或读写）及不同缓冲策略打开。

当数据库以只读模式打开时，其他数据库实例（无论在同一进程内还是不同进程中）也可同时以只读模式打开同一数据库目录。
当数据库以读写模式打开时，其他任何数据库实例（无论在同一进程内还是不同进程中）均无法以只读或读写模式打开同一数据库目录。

请注意：即使以只读模式打开数据库，仍需提供一个可写的数据库数据目录。锁文件会在需要时按需创建；只读进程则会在其自身的 `runtime/open-<epoch>/` 目录中创建临时工作文件。因此，只读模式无法在只读文件系统或挂载点上使用。

当数据库被关闭时，所有指向该数据库的连接将自动关闭。

```javascript

    const { Database } = require('neug');
    const db = new Database({ databasePath: '/tmp/test.db', mode: 'w' });
    const conn = db.connect();

    // 使用连接对象与数据库交互
    conn.execute('CREATE NODE TABLE Person(id INT64, name STRING, PRIMARY KEY(id));');
    conn.execute('CREATE REL TABLE KNOWS(FROM Person TO Person, weight DOUBLE);');

    // 从 CSV 文件导入数据
    conn.execute('COPY Person FROM "person.csv"');
    conn.execute('COPY KNOWS FROM "knows.csv" (from="Person", to="Person");');

    const res = conn.execute('MATCH(n) RETURN n.id;');
    for (const row of res) {
        console.log(row);
    }

```

<a id="neug.database.Database.constructor"></a>

### constructor

```javascript
constructor(options = {}) {
  const {
    databasePath = null,
    mode = 'read-write',
    maxThreadNum = 0,
    checkpointOnClose = true,
    bufferStrategy = 'M_FULL',
  } = options;
}
```

打开数据库。

- **参数：**
  - `options` (Object)
    数据库配置选项。
  - `options.databasePath` (string | null)
    数据库文件的路径。默认为 `null`.`''`) 或 `null`，数据库将以内存模式打开。
    请注意，在内存模式下，数据库不会持久化到磁盘，并且所有数据将在
    程序退出时丢失。
    **注意**：`null` 不能与只读模式结合使用；`''`（空字符串）可以。
  - `options.mode` (string)
    打开数据库的模式。支持的值：'r', 'read', 'read-only', 'read_only', 'w', 'rw', 'write', 'readwrite', 'read-write', 'read_write'。默认为 'read-write'。
  - `options.maxThreadNum` (number)
    数据库查询容量；`0` 选择硬件并发数（回退值为 `1`），而更高的输入会发出警告并截断至该值。

    嵌入式（AP）查询当前为单线程；将此设置用于查询内并行是未来的工作。

    在 TP 模式下，它是默认的服务执行槽容量。显式
    设置较小的服务并发数会减少服务本地池。
  - `options.checkpointOnClose` (boolean)
    关闭数据库时是否自动创建检查点。默认为 true。
    如果为 false，关闭数据库时不会自动创建检查点。
  - `options.bufferStrategy` (string)
    数据库使用的缓冲策略，可以是 'InMemory'（或 'M_FULL'）、'SyncToFile'（或 'M_LAZY'）
    或 'HugePagePreferred'（或 'M_HUGE'）。默认为 'M_FULL'。
    - 'InMemory' / 'M_FULL'：数据库将完全在内存中打开，并且更改不会
    持久化到磁盘，直到创建检查点。
    - 'SyncToFile' / 'M_LAZY'：数据库将按需加载到内存中，适用于无法
    放入内存的大型数据库。同样，更改不会持久化到磁盘，直到创建检查点。
    - 'HugePagePreferred' / 'M_HUGE'：类似于 'InMemory'，但会尝试使用大页进行内存
    分配，这可能会提高大型数据库的性能。

- **抛出：**
  - **Error** (ERR_INVALID_PATH)
    如果数据库路径包含非法字符。
  - **Error** (ERR_INVALID_ARGUMENT)
    如果模式不是受支持的模式之一。
    如果 maxThreadNum 超过 CPU 核心数。
    如果在内存模式下以只读模式打开。
  - **Error** (ERR_CONFIG_INVALID)
    如果 maxThreadNum 为负数。

<a id="neug.database.Database.version"></a>

### 版本

```javascript
get version() -> string
```

获取数据库版本。

<a id="neug.database.Database.mode"></a>

### mode

```javascript
get mode() -> string
```

获取数据库的模式。

- **返回：**
  - **string**
    数据库的模式，可以是 'r'、'read'、'w'、'rw'、'write'、'readwrite'、'read-write' 或 'read-only'。

<a id="neug.database.Database.connect"></a>

### connect

```javascript
connect() -> Connection
```

连接到数据库。

- **返回：**
  - **Connection**
    用于与数据库交互的 Connection 对象。
- **抛出：**
  - **Error**
    如果数据库已关闭。

<a id="neug.database.Database.asyncConnect"></a>

### asyncConnect

```javascript
asyncConnect() -> AsyncConnection
```

异步连接到数据库。

- **返回：**
  - **AsyncConnection**
    用于与数据库进行异步交互的 AsyncConnection 对象。
- **抛出：**
  - **Error**
    如果数据库已关闭。

<a id="neug.database.Database.close"></a>

### close

```javascript
close()
```

关闭数据库并释放所有资源。
所有已打开的连接（包括异步连接）将自动关闭。

对于启用了 `checkpointOnClose: true` 的读写数据库，此方法会在释放数据库资源之前创建一个检查点（checkpoint）。自动检查点创建为尽力而为（best effort）：若创建失败，仅记录错误日志，不会向调用方抛出异常。
