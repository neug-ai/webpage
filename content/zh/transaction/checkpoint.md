# 检查点（Checkpoints）

检查点将当前数据库状态保存到磁盘。自 v0.2 版本起，嵌入模式和服务模式下的常规已提交写入操作已通过 WAL（预写式日志）实现持久化，因此无需手动执行 `CHECKPOINT`。持久化的 `COPY ... FROM` 操作及批量插入操作会在报告成功前自动创建一个检查点。而 `COPY TEMP` 则始终保留在内存中，数据库关闭后即丢失。

| 问题 | 常规写入（含索引变更） | 持久化 `COPY` / 批量插入 |
|---|---|---|
| 是否需要手动执行 `CHECKPOINT` 以确保持久性？ | 否；已提交的变更已保存在 WAL 中 | 否；语句报告成功前会自动创建检查点 |
| 为何仍需创建检查点？ | 减少恢复过程中需重放的 WAL 数据量 | 确保导入的数据持久化 |
| 重启后恢复的是什么？ | 最新检查点及其之后已提交的变更 | 来自最新检查点的已导入数据 |

有关检查点操作之外的事务边界与并发控制，请参阅 [事务管理](transaction.mdx)。

## 执行检查点（Checkpoint）

```cypher
CHECKPOINT;
```

`CHECKPOINT` 不接受任何参数，且必须在 `update` 访问模式下执行。

如果未指定 `access_mode`，NeuG 将自动推断为 `update`。若显式指定，则其值必须为 `"update"` 或 `"u"`。其他任何访问模式（如 `"read"`/`"r"`、`"insert"`/`"i"` 或 `"schema"`/`"s"`）均被拒绝；此外，以只读方式打开的数据库无法创建检查点。

使用示例：

```python

# NeuG 推断出 `update` 访问模式
conn.execute("CHECKPOINT")
```

```python

# 或 “u”；其他所有访问模式均被拒绝
conn.execute("CHECKPOINT", access_mode="update")
```

`CHECKPOINT` 还可与 [`EXPLAIN`/`PROFILE` 子句](../cypher_manual/explain_profile.md) 一起使用：

- `EXPLAIN CHECKPOINT` 返回执行计划，但不创建检查点。
- `PROFILE CHECKPOINT` 创建检查点，并将其执行时间作为单个 `CHECKPOINT` 操作符进行报告。

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

## 磁盘布局

一个持久化数据库使用一个清单（manifest）选择器、多个被不同清单共享的不可变对象、每个清单 ID 对应一个预写式日志（WAL）纪元（epoch），以及每次打开数据库时分配的一个临时工作区：

```text
data_dir/
├── checkpoint/
│   ├── CURRENT                 # 十进制清单 ID + 末尾换行符
│   ├── manifests/<id>.manifest
│   └── objects/<object-id>
├── wal/<id>/                   # 清单 <id> 对应的 WAL 纪元
└── runtime/open-<id>/          # 单次数据库打开所用的临时文件；
                                # <id> 是一个不透明的唯一后缀（例如 UUID）
```

`CURRENT` 是唯一的发布选择器。其内容为所选清单的十进制 ID，后跟一个单独的换行符（例如 `3\n`），通过原子重命名方式写入；运维人员可使用普通文本编辑器手动检查或重写该文件。已发布的清单必须包含字段 `v`、`base_ts`、`schema` 和 `modules`；还可选择性地包含 `scalars`。模块描述符中持久化保存的是对象 ID，而非绝对路径。同一 ID 同时用于命名清单及其对应的 WAL 纪元。`base_ts` 表示该清单中已涵盖的最高事务时间戳，因此恢复过程将从 `base_ts + 1` 开始重放所选纪元中的 WAL 记录。完整检查点（full checkpoint）使用 `base_ts=0`，并在重新打开数据库后重置事务时间线。

检查点对象是不可变的，可被多个清单共同引用。运行时（runtime）文件不属于检查点数据：每次打开数据库都会获得独立的 `runtime/open-<id>/` 目录（其中 `<id>` 是一个不透明的唯一标识符，既非时间戳也非清单 ID），关闭该数据库时仅会清理其自身未被引用（unpinned）的工作区。

### 升级旧版检查点目录

当 `CURRENT` 文件不存在时，首次以读写模式打开数据库会自动升级最新有效的已发布 v1 版本的 `checkpoint-N` 世代。NeuG 将其不可变快照文件导入至 `checkpoint/objects/` 目录中，将其世代号保留为新的清单（manifest）和 WAL 纪元 ID（epoch ID），并发布一个 `base_ts=0` 的 v2 版本清单；随后，常规恢复流程将重放所有旧版 WAL 记录。在安全的前提下对文件执行硬链接（hardlink），否则进行复制。

在新的 `CURRENT` 文件被持久化发布之前，旧目录不会被修改。若在此前发生崩溃，则旧版检查点仍可正常使用，且下一次读写打开操作将重试升级过程。数据库成功打开并完成恢复后，常规垃圾回收机制会删除旧的 `checkpoint-N` 和 `checkpoint-N.next` 目录，从而使该升级过程变为单向不可逆操作。仅支持旧版格式的数据库无法以只读模式打开：必须至少以读写模式打开一次，以完成升级。除 v1 版本外的其他旧版 `meta` 格式均会被直接拒绝，而不会尝试猜测或兼容。

## 检查点（Checkpoint）的作用

手动执行 `CHECKPOINT` 首先获取独占的检查点维护控制权，并等待正在进行中的工作完成（参见[并发性](#concurrency)）。它保留了现有的完整检查点行为：压缩活跃图（live graph），以破坏性方式将其转储（destructively dump），发布一份完整的清单（manifest），然后重新打开图结构及内存分配器（allocators）。仅需为“脏”（dirty）的图模块和索引模块创建新的不可变对象；而“干净”（clean）的模块描述符可继续引用已有的对象。清单及其 WAL 世代（WAL epoch）在原子性地替换 `CURRENT` 引用之前，必须先确保其持久化（made durable）。

AP-direct 的 `COPY`/批量插入操作则采用一种更窄范围的私有写时复制（private-COW）协议。该语句首先在克隆出的图上准备全部变更，随后仅对该克隆图执行现有的、消耗“脏模块”的转储与重开操作，再发布暂存清单（staging manifest）并原子性地替换当前图。它**不会**对已发布的图或分配器执行压缩或重开操作。每一次成功持久化的批量语句都会推进检查点 ID，并将活跃的 WAL 写入器轮转至新世代。

手动检查点发布完成后，NeuG 将从新检查点重新打开活跃图及分配器。在服务模式（Service mode）下，每个执行槽（execution-slot）对应的 WAL 写入器随后也被轮转至新世代。最后，事务时间线被重置，新事务开始被接纳。所有这些步骤均在检查点屏障（checkpoint barrier）仍被持有期间执行。

恢复（Recovery）检查点与关闭（shutdown）检查点均采用相同的压缩式、破坏性转储流程。区别在于：恢复过程会在数据库开始提供服务**之前**重新打开图与分配器；而关闭检查点则在持久化后**不执行重开**。垃圾回收（Garbage Collection）仅在清单、WAL 世代以及相关对象既非当前使用、也未被任何活跃检查点引用所保留时，才将其删除。

在破坏性转储开始**之前**，若关闭检查点失败，则已打开的数据库仍可正常使用，且 `Close()` 方法会报告该失败，以便调用方修正问题并重试。一旦转储已消耗了活跃图的状态，对该已打开实例而言，该失败即不可重试：`Close()` 将完成资源与锁的清理工作，标记数据库为已关闭状态，并重新抛出该失败异常。后续通过全新的 `Open()` 调用，仍可使用此前已发布的检查点。

“完整”（Full）一词描述的是运行时生命周期的边界，**并不意味着必须重写每一个干净的不可变对象**。因此，检查点引起的磁盘空间增长，取决于被重写的模块数量，以及被活跃引用所保留的对象数量。应根据崩溃后可接受的重放工作量（replay work）和 WAL 增长情况来调度检查点，而非采用固定且过于紧密的时间间隔。

### 磁盘空间回收

已弃用的清单（manifests）、WAL 世代（epochs）、不可变对象（immutable objects）以及被遗弃的 `runtime/open-<id>/` 运行时工作区，均由垃圾回收（garbage collection）机制清除。该机制仅在以下三个时机运行：以读写模式打开数据库、成功执行手动 `CHECKPOINT` 命令，以及数据库关闭时。因此，在未到达上述任一时机前，删除行或删除表均不会减少磁盘占用。

只读模式打开数据库时**永远不会**触发垃圾回收。纯只读部署中，因只读进程崩溃而遗留的陈旧 `runtime/open-<id>/` 工作区会持续累积；下一次以读写模式打开数据库时，这些工作区将被回收。

### 并发性

- **嵌入模式（Embedded mode）：** 检查点（checkpoint）会获取独占查询锁。它会等待正在运行的操作完成，并在自身完成前阻止所有新操作的执行。
- **服务模式（Service mode）：** 检查点会等待正在进行的读写操作自然完成（不主动中断它们），同时暂停新事务的发起；待所有在途操作结束后，检查点在无任何并发事务的情况下执行。该等待时间无上限：单个长时间运行的查询可能导致整个检查点被延迟。检查点成功完成后，现有会话保持有效，NeuG 将启动一个新的空 WAL（Write-Ahead Log）。

对于服务模式，建议尽可能在系统负载较低的“安静期”安排检查点。

## 关闭时自动执行检查点（checkpoint）

在 Python API 中，持久化读写数据库默认启用 `checkpoint_on_close=True`，因此关闭数据库时会尝试执行一次最终的检查点操作。若该操作失败，`close()` 将抛出异常。具体行为取决于失败发生的时机：数据库可能仍保持打开状态以供后续重试，也可能已实际关闭。

当应用程序必须明确知晓维护操作（如检查点）是否成功时，请显式执行 `CHECKPOINT` 命令。若设置 `checkpoint_on_close=False`，则在嵌入式模式和服务模式下，所有已提交的常规写操作仍可通过 WAL（预写式日志）进行恢复。而成功的持久化批量写操作均已自行创建检查点。

## 故障与恢复

启动时，NeuG 会加载由 `CURRENT` 指定的检查点。当 `CURRENT` 存在时，NeuG 不会回退至更早的数据库目录。因操作中断而产生的不完整检查点将被忽略。若 `CURRENT` 不存在，则以读写模式打开数据库时，可能执行上述一次性 v1 迁移。随后，持久化的嵌入式数据库和服务型数据库将重放所选检查点之后已提交的 WAL 记录。

**手动**执行的 `CHECKPOINT` 可能以两种方式失败：

- 若 NeuG 无法启动检查点操作，该语句将返回错误，但数据库仍可正常使用；
- 若 NeuG 在开始替换当前状态后发生失败，则进程将被强制终止，以避免使用不安全的状态。重启后，系统将从 `CURRENT` 所指定的检查点及后续已提交的写入操作中恢复。

`checkpoint_on_recovery` 是一个可选配置项，用于在以读写模式打开数据库并完成 WAL 恢复后，自动创建一个检查点。该选项默认处于禁用状态。若此操作失败，数据库打开操作将返回错误，但不会终止进程。请先解决根本原因（例如磁盘空间不足或权限问题），然后重试。

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
