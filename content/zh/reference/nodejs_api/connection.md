<a id="neug.connection"></a>

# 模块 neug.connection

Neug 连接模块。

<a id="neug.connection.Connection"></a>

## 连接对象

```javascript
class Connection
```

Connection 表示与 NeuG 数据库的逻辑连接。用户应使用此类与数据库进行交互，例如执行查询和管理事务。
连接通过 `Database.connect` 方法创建，不再需要时应调用 `close` 方法将其关闭。如果数据库被关闭，所有指向该数据库的连接都将自动关闭。

<a id="neug.connection.Connection.constructor"></a>

### 构造函数

```javascript
constructor(nativeConnection)
```

初始化一个 Connection 对象。该方法由 `Database.connect()` 在内部调用。
- **参数：**
  - `nativeConnection` (对象)
    提供实际数据库连接的底层原生连接对象。

<a id="neug.connection.Connection.isOpen"></a>

### isOpen

```javascript
get isOpen() -> boolean
```

检查连接是否已打开。
- **返回值：**
  - **boolean**
    如果连接已打开，则为 `true`；否则为 `false`。

<a id="neug.connection.Connection.hasActiveTransaction"></a>

### hasActiveTransaction

```javascript
get hasActiveTransaction() -> boolean
```

此连接是否具有一个活跃的或仅回滚的显式事务。

<a id="neug.connection.Connection.beginTransaction"></a>

### beginTransaction

```javascript
beginTransaction(options = {})
```

开始一个显式的嵌入式事务。默认情况下，该事务使用私有的写时复制（copy-on-write）视图。传入 `{ readOnly: true }` 可固定为只读视图。不支持嵌套事务和从只读升级为读写。

<a id="neug.connection.Connection.commit"></a>

### commit

```javascript
commit()
```

提交当前活动的事务。仅可回滚的事务必须执行回滚操作。

<a id="neug.connection.Connection.rollback"></a>

### rollback

```javascript
rollback()
```

回滚当前活跃的事务或仅回滚状态的事务，并返回到自动提交模式。

<a id="neug.connection.Connection.close"></a>

### close

```javascript
close()
```

关闭连接。

<a id="neug.connection.Connection.execute"></a>

### execute

```javascript
execute(query, accessMode = '', parameters = null) -> QueryResult
```

在数据库上执行 Cypher 查询。用户可在单个字符串中指定多个查询，各查询之间以分号（`;`）分隔。这些查询将按其在字符串中出现的顺序依次执行。若其中任一查询执行失败，则整个执行过程将回滚。

若查询为 DDL（数据定义语言）语句，例如 `CREATE NODE TABLE`、`CREATE REL TABLE`、`DROP TABLE` 等，数据库结构将相应地被修改。

有关查询语法的详细信息，请参阅 Cypher 手册文档。查询结果将以 `QueryResult` 对象形式返回，该对象包含查询结果本身及其元数据。`QueryResult` 对象支持 JavaScript 迭代器协议（`for...of`），并提供用于遍历结果的方法，例如 `hasNext()` 和 `getNext()`。

若查询为 DDL 或 DML（数据操作语言）语句，则返回的 `QueryResult` 对象为空。

部分 Cypher 查询会改变数据库状态，例如 `CREATE NODE TABLE`、`INSERT`、`UPDATE`、`DELETE` 等；而其他查询（如 `MATCH(n) RETURN n.id`）则不会改变数据库状态，仅返回查询结果。

若数据库以只读模式打开，则任何 DDL 或 DML 查询均会抛出错误。
若数据库以读写模式打开，则所有查询均可执行，且数据库状态将随之更新。

```javascript

    const { Database } = require('neug');
    const db = new Database({ databasePath: '/tmp/test.db', mode: 'w' });
    const conn = db.connect();
    conn.execute('CREATE NODE TABLE Person(id INT64, name STRING, PRIMARY KEY(id));');
    conn.execute('CREATE REL TABLE KNOWS(FROM Person TO Person, weight DOUBLE);');
    conn.execute('COPY Person FROM "person.csv"');
    conn.execute('COPY KNOWS FROM "knows.csv" (from="Person", to="Person");');
    const res = conn.execute('MATCH(n) RETURN n.id');
    for (const row of res) {
        console.log(row);
    }
    const res2 = conn.execute('MATCH(p:Person)-[:KNOWS]->(q:Person) RETURN p.id, q.id LIMIT 10;');
    // 提交带参数的查询
    const res3 = conn.execute(
        'MATCH (n:Person) WHERE n.id = $id RETURN n.name', 'read', { id: 12345 });

```

- **参数：**
  - `query`（字符串）
    待执行的查询语句。
  - `accessMode`（字符串）
    查询的访问模式。可取值为 `read(r)`（只读）、`insert(i)`（仅插入）、`update(u)`（更新，含删除）或 `schema(s)`（模式修改）。用户应为查询指定正确的访问模式，以确保数据库操作的正确性。若未显式指定访问模式，NeuG 将根据查询文本自动推断。支持的访问模式如下：
    - `read`、`r`、`READ`、`R`：用于只读查询；
    - `insert`、`i`、`INSERT`、`I`：用于仅插入查询；
    - `update`、`u`、`UPDATE`、`U`：用于更新查询（含删除）；
    - `schema`、`s`、`SCHEMA`、`S`：用于模式修改操作。
  - `parameters`（对象 | null）
    查询中使用的参数。该参数应为一个对象，其键为参数名，值为对应参数值。若无需参数，可设为 `null`。

- **返回值：**
  - `query_result`（QueryResult）
    查询执行结果。

- **异常：**
  - **Error**
    若连接已关闭、访问模式无效，或查询执行失败，则抛出此错误。

<a id="neug.connection.Connection.getSchema"></a>

### getSchema

```javascript
getSchema() -> string
```

获取 NeuG 数据库的模式。

**返回**：

以字符串形式返回 NeuG 数据库的模式。
