# 检查点

检查点会将可恢复的数据库快照写入磁盘，并减少 NeuG 启动时需要重放的预写日志（WAL）。

大多数应用无需手动创建检查点：

- 在嵌入式模式和服务模式下，常规提交写入都已通过 WAL 保证持久性；
- 嵌入式模式下，持久化的 `COPY ... FROM` 会在返回成功之前创建所需的检查点；
- 服务模式不支持 `LOAD FROM` 或任何 `COPY` 语句。

## 何时创建检查点

以下场景可以手动创建检查点：

- 减少重启后需要重放的 WAL；
- 在重要运维节点前整合持久化状态；
- 明确确认检查点维护操作已成功完成。

无需在每个事务之后创建检查点。过于频繁地创建检查点会带来不必要的维护开销。

## 执行检查点

```cypher
CHECKPOINT;
```

`CHECKPOINT` 不接受参数，必须作为使用 `update` 访问模式的自动提交语句运行。

如果省略 `access_mode`，NeuG 会推断为 `update`。如果显式指定，请使用 `"update"`
或 `"u"`；其他模式会被拒绝。只读数据库无法创建检查点，显式事务内也不能执行
`CHECKPOINT`。

```python
conn.execute("CHECKPOINT")
conn.execute("CHECKPOINT", access_mode="update")
```

`CHECKPOINT` 也支持 [`EXPLAIN` 和 `PROFILE`](../cypher_manual/explain_profile.md)：

- `EXPLAIN CHECKPOINT` 返回执行计划，但不创建检查点；
- `PROFILE CHECKPOINT` 创建检查点并报告执行时间。

## 应用可观察到的行为

检查点维护会等待正在进行的工作结束，并暂时阻止新事务启动。因此，长时间运行的查询
可能延迟检查点，检查点也可能短暂延迟新工作。

检查点成功完成后：

- 现有的服务模式会话仍然有效；
- 后续事务照常运行；
- 重启恢复从新检查点开始，只重放此后产生的 WAL 记录。

如果业务对延迟的可预测性有要求，请将运维检查点安排在负载较低的时段。

## 嵌入式模式

常规写入不需要手动创建检查点：

```python
import neug

db = neug.Database("/path/to/database", checkpoint_on_close=False)
conn = db.connect()

conn.execute("CREATE (p:Person {id: 42})")  # durable after commit
conn.close()
db.close()
```

持久化批量导入也会自动处理检查点：

```python
conn.execute("COPY Person FROM 'people.csv'")
# Success means the import has been published in a checkpoint.
```

导入具有原子性。如果读取、校验或检查点发布失败，导入的数据都不会变为可见，数据库会
保持在之前已经发布的状态。

`COPY TEMP` 不同：它只更新当前连接的内存临时图，连接或数据库关闭后数据即丢失。

## 服务模式

服务模式的写入在提交时即具备持久性。手动检查点只是一项可选的维护操作：

```python
from neug import Session

session = Session("http://localhost:10000/")
session.execute(
    "CREATE (p:Person {name: 'Alice'})",
    access_mode="insert",
)
session.execute("CHECKPOINT")  # optional
session.close()
```

关闭客户端 `Session` 只会断开该客户端，不会关闭服务端数据库，也不会触发检查点。

请注意，服务模式不支持 `LOAD FROM`、`COPY FROM`、`COPY TEMP` 和 `COPY TO`。
请先在嵌入式模式下完成文件 I/O，再启动服务。

## 关闭数据库时自动创建检查点

持久化的读写数据库默认设置为 `checkpoint_on_close=True`，因此关闭数据库时会尝试创建
最后一个检查点。

该设置在数据库所有者关闭数据库时生效；关闭远程客户端会话不会触发检查点。

如果自动检查点失败，`close()` 会报告错误。根据失败发生的时机，数据库可能仍处于打开状态，
可再次尝试；也可能已经关闭。如果应用需要在关闭前确认维护结果，请显式执行 `CHECKPOINT`。

即使设置为 `checkpoint_on_close=False`，常规提交写入仍可通过 WAL 恢复。

## 恢复与失败处理

启动时，NeuG 会恢复最近发布的检查点，并重放其后已经提交的 WAL 记录。未完成的检查点
工作会被忽略。

手动检查点可能以两种方式失败：

- 如果 NeuG 无法开始创建检查点，语句会返回错误，但数据库仍可继续使用；
- 如果替换当前状态已经开始后发生失败，NeuG 会停止运行，不会继续使用不安全的内存状态。
  重启时会从最近发布的检查点和后续已经提交的 WAL 记录恢复。

读写数据库打开时，可通过 `checkpoint_on_recovery` 请求在 WAL 恢复后创建一个新检查点。
该选项默认关闭。如果检查点失败，打开操作会返回错误，应用可以修正原因后重试。

有关磁盘布局、AP/TP 协调、检查点发布、垃圾回收以及旧格式迁移，请参阅
[事务模型](transaction_model.md)。
