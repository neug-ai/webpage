# 检查点

检查点将当前数据库状态保存到磁盘。自 v0.2 起，嵌入式和服务模式下的常规
已提交写入已通过 WAL 实现持久化，因此不需要手动检查点。持久化 `COPY ... FROM` 和
批量插入在报告成功之前会创建一个检查点。 `COPY TEMP` 保留
在内存中，并在数据库关闭时丢失。

| 问题 | 常规写入，包括索引更改 | 持久化 COPY/批量插入 |
|---|---|---|
| 是否需要手动 `CHECKPOINT` 来实现持久化？ | 否；已提交的更改已保存在 WAL 中 | 否；在语句报告成功之前会创建一个检查点 |
| 为什么要创建？ | 为了减少恢复期间重放的 WAL 数量 | 为了使导入的数据持久化 |
| 重启后恢复什么？ | 最新的检查点及之后已提交的更改 | 来自最新检查点的导入数据 |

有关检查点操作之外的事务边界和并发，请参阅
[事务管理](transaction.mdx)。有关检查点在内部如何存储和
应用，请参阅[工作原理](how_it_works.md)。

## 运行检查点

```cypher
CHECKPOINT;
```

`CHECKPOINT` 不接受任何参数，并且必须在 `update` 访问
模式下运行。

如果 `access_mode` 被省略，NeuG 会推断出 `update`。如果明确
指定了它，则必须是 `"update"` 或 `"u"`。任何其他访问模式
（`"read"`/`"r"`, `"insert"`/`"i"`，或 `"schema"`/`"s"`）将被拒绝，并且
以只读方式打开的数据库无法创建检查点。

使用示例：

```python
conn.execute("CHECKPOINT")  # NeuG infers `update`
conn.execute("CHECKPOINT", access_mode="update")  # or "u"; all other modes are rejected
```

`CHECKPOINT` 还可以与
[`EXPLAIN`/`PROFILE` 子句](../cypher_manual/explain_profile.md) 一起使用：

- `EXPLAIN CHECKPOINT` 返回执行计划而不创建
  检查点。
- `PROFILE CHECKPOINT` 创建检查点并将其执行时间报告
  为单个 `CHECKPOINT` 运算符。

### 嵌入模式示例

```python
import neug

# 当关闭时检查点功能（checkpoint-on-close）被禁用时，普通写操作仍可从 WAL 中恢复。
db = neug.Database("/path/to/database", checkpoint_on_close=False)
conn = db.connect()

conn.execute("COPY Person FROM 'people.csv'")

# COPY 操作仅在发布其私有批量检查点后返回。
conn.execute("CREATE (p:Person {id: 42})")  # 通过逻辑 WAL 实现持久化。

conn.close()
db.close()
```

### 服务模式示例

本示例假设 NeuG 服务已处于运行状态。如需启动服务，请参阅
[服务模式](../getting_started/getting_started.md#service-mode)（`db.serve()`）。

```python
from neug import Session

session = Session("http://localhost:10000/")

# 此插入操作一旦提交即为持久化；无需执行 CHECKPOINT。
session.execute(
    "CREATE (p:Person {name: 'Alice'})",
    access_mode="insert",
)

# 可选的维护操作：发布一个检查点，以限制后续 WAL 重放的范围。
session.execute("CHECKPOINT")
session.close()
```

关闭客户端的 `Session` 仅会断开该客户端的连接；它既不会关闭服务器端的数据库，也不会触发服务器端数据库的检查点操作。当稍后通过设置 `checkpoint_on_close=True` 关闭服务器端数据库时，所有尚未处理的 WAL 记录将被合并到最终的检查点中；如果禁用了检查点功能，则 WAL 文件将保留在磁盘上，并在下次启动时进行重放。

## 并发

- **嵌入模式：** 检查点获取排他性查询锁。它会等待
  运行中的操作完成，并阻塞新操作，直到其
  完成。
- **服务模式：** 检查点等待进行中的读写操作
  完成而不中断它们，在运行期间暂缓新事务，
  然后在无并发事务的情况下执行。等待时间
  是无界的：单个长时间运行的查询可能会延迟整个检查点。
  成功执行检查点后，现有会话保持有效，且 NeuG
  会启动一个新的空 WAL。

对于服务模式，请尽可能在空闲时段安排检查点。

## 关闭时自动执行检查点（checkpoint）

在 Python API 中，持久化读写数据库默认启用 `checkpoint_on_close=True`，因此关闭数据库时会尝试执行一次最终的检查点操作。若该操作失败，`close()` 将抛出异常。具体行为取决于失败发生的时机：数据库可能仍保持打开状态以供后续重试，也可能已实际关闭。

当应用程序必须明确知晓维护操作（如检查点）是否成功时，请显式执行 `CHECKPOINT` 命令。若设置 `checkpoint_on_close=False`，则在嵌入式模式和服务模式下，所有已提交的常规写操作仍可通过 WAL（预写式日志）进行恢复。而成功的持久化批量写操作均已自行创建检查点。

## 故障与恢复

启动时，NeuG 会加载由 `CURRENT`。当 `CURRENT`
存在时，NeuG 不会回退到较旧的数据库目录。来自中断操作的不完整
检查点将被忽略。如果 `CURRENT` 缺失，则
读写打开可能会执行一次性的 v1 迁移；请参阅
[工作原理](how_it_works.md#upgrading-legacy-checkpoint-directories)。
然后，持久化嵌入式和服务数据库将重放在所选检查点
之后创建的已提交 WAL 记录。

**手动** `CHECKPOINT` 可能会以两种方式失败：

- 如果 NeuG 无法启动检查点，该语句将返回错误，并且
  数据库保持可用。
- 如果在 NeuG 开始替换当前状态后失败，NeuG 将终止
  进程以避免使用不安全的状态。重新启动将从由 `CURRENT` 选择的检查点以及后续的已提交写入中恢复。

`checkpoint_on_recovery` 在打开读写数据库时，会在 WAL 恢复后
可选地创建检查点。默认情况下禁用此功能。如果失败，
打开操作将返回错误而不会终止进程。修复根本
原因（例如，磁盘空间或权限），然后重试。

### 持久化批量加载失败

持久化的 `COPY` 和批量插入操作是原子性的。如果导入过程或其检查点（checkpoint）失败，则所有新数据均不会对外可见，且数据库将保持先前的有效状态。

```python
import neug

db = neug.Database("/path/to/database", checkpoint_on_close=False)
conn = db.connect()

try:
    conn.execute("COPY Person FROM 'large_batch.csv'")
except Exception:
    # 此时数据库仍维持先前的状态，且可正常使用。
    pass
```

每次成功的持久化 `COPY` 操作都会创建一个检查点。例外情况是 `COPY TEMP`：它仅更新内存中的数据库。建议尽可能在应用层执行批量输入，并预留充足的临时磁盘空间以支持检查点创建及后续清理工作。
