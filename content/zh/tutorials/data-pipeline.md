# 数据管道教程：云存储 → 图查询 → Parquet 导出

本教程将引导您使用 NeuG v0.1.3 或更高版本完成一个完整的数据管道：

1. 直接从云存储读取 Parquet 文件（无需下载）
2. 自动创建图结构表，无需编写 DDL
3. 执行图查询
4. 将查询结果导出为 Parquet 格式（本地或云存储）

**耗时**：约 10 分钟
**前提条件**：`pip install neug==0.2.0`，并确保网络连接正常

## 步骤 1：安装和加载扩展

NeuG 使用扩展来支持远程文件访问和 Parquet 格式。第一次运行 `install` 时，NeuG 会下载扩展二进制文件。之后，你只需要使用 `load` 来激活它。

```python
from neug import Database
import tempfile

db = Database(db_path=tempfile.mkdtemp(), mode="w")
conn = db.connect()

conn.execute("install httpfs")
conn.execute("install parquet")
conn.execute("load httpfs")
conn.execute("load parquet")
```

> **注意**: `install` 下载扩展（一次性操作）。`load` 在当前会话中激活它。

---

## 步骤 2：预览远程数据

在导入之前，让我们直接从公共 OSS 端点查看数据——无需下载任何内容：

```python
result = conn.execute('''
    LOAD FROM "https://graphscope.oss-cn-beijing.aliyuncs.com/neug/vPerson.parquet"
    RETURN ID, fName, age, isStudent
    LIMIT 5
''')
for row in result:
    print(row)
```

预期输出：

```
[0, 'Alice', 35, True]
[2, 'Bob', 30, True]
[3, 'Carol', 45, False]
[5, 'Dan', 20, False]
[7, 'Elizabeth', 20, True]
```

可以通过 OSS 方案访问同一个文件（在需要基于凭证的访问时很有用）：

```python
result = conn.execute('''
    LOAD FROM "oss://graphscope/neug/vPerson.parquet" (
        CREDENTIALS_KIND='Anonymous',
        ENDPOINT_OVERRIDE='oss-cn-beijing.aliyuncs.com'
    )
    RETURN ID, fName
    LIMIT 3
''')
```

---

## 步骤 3：导入节点 — 一行代码，无需 DDL

> **注意：** `COPY FROM` 仅在[嵌入模式](../data_io/index.md#embedded-mode-only)下受支持，服务模式下不可用。

传统上，将数据导入图数据库需要首先使用 `CREATE NODE TABLE` 语句定义模式（列名、类型、主键）。在 NeuG v0.1.3 中，您可以跳过所有这些步骤：

```python
conn.execute('''
    COPY Person FROM (
        LOAD FROM "https://graphscope.oss-cn-beijing.aliyuncs.com/neug/vPerson.parquet"
        RETURN *
    )
''')
```

NeuG 会自动执行以下操作：

- 从 Parquet 文件模式中推断所有列名和类型
- 将第一列作为主键
- 一步完成节点表创建和数据导入

验证：

```python
result = conn.execute("MATCH (p:Person) RETURN count(p)")
print(list(result))  # [[8]]
```

该文件包含 16 列（INT64、STRING、BOOL、DOUBLE、DATE）——所有类型均已正确推断。

---

## 第 4 步：导入边

边表的操作方式与此相同，但增加了一项要求：需要指定该边连接的是哪些节点表：

```python
conn.execute('''
    COPY MEETS FROM (
        LOAD FROM "https://graphscope.oss-cn-beijing.aliyuncs.com/neug/eMeets.parquet"
        RETURN *
    ) (from="Person", to="Person")
''')
```

验证：

```python
result = conn.execute("MATCH ()-[e:MEETS]->() RETURN count(e)")
print(list(result))  # [[7]]
```

---

## 第 5 步：图查询

现在你已经拥有了一个图。对其进行查询：

```python
result = conn.execute('''
    MATCH (a:Person)-[m:MEETS]->(b:Person)
    WHERE a.age > 30
    RETURN a.fName, b.fName, m.location
''')
for row in result:
    print(row)
```

---

## 第 6 步：将查询结果导出为 Parquet

导出过滤后的图查询结果：

```python
conn.execute('''
    COPY (
        MATCH (a:Person)-[m:MEETS]->(b:Person)
        WHERE a.age < 35
        RETURN a.fName AS name, a.age AS age, b.fName AS met_person, m.location
    ) TO '/tmp/young_social.parquet'
''')
```

此操作仅导出年轻（年龄小于 35 岁）人群的社交关系。结果将生成一个标准的 Parquet 文件，任何下游工具（Spark、pandas、DuckDB）均可直接读取。

### 导出到云存储

在生产环境中，您可以直接写入 OSS 或 S3，无需使用本地磁盘：

```python
conn.execute('''
    COPY (
        MATCH (a:Person)-[m:MEETS]->(b:Person)
        WHERE a.age < 35
        RETURN a.fName AS name, a.age AS age, b.fName AS met_person, m.location
    ) TO "oss://my-bucket/output/young_social.parquet" (
        CREDENTIALS_KIND='Explicit',
        OSS_ACCESS_KEY_ID='<your-access-key-id>',
        OSS_ACCESS_KEY_SECRET='<your-access-key-secret>',
        ENDPOINT_OVERRIDE='oss-cn-hangzhou.aliyuncs.com'
    )
''')
```

---

## 第 7 步：转换为 PyArrow 表

如果您希望在 Python（pandas、polars、DuckDB）中继续进行分析，可以直接将查询结果转换为 PyArrow 表：

```python
result = conn.execute('''
    MATCH (p:Person)
    RETURN p.ID, p.fName, p.age
    ORDER BY p.ID
''')
table = result.to_arrow()
print(table.schema)
print(table.to_pandas())
```

---

## 凭据配置参考

### OSS

| 参数                      | 描述                                                                                                   |
| ------------------------- | ------------------------------------------------------------------------------------------------------ |
| `CREDENTIALS_KIND`      | `'Explicit'`（提供 AK/SK）、`'Anonymous'`（公共数据）、`'Default'`（环境凭证）                  |
| `OSS_ACCESS_KEY_ID`     | 你的 AccessKey ID                                                                                      |
| `OSS_ACCESS_KEY_SECRET` | 你的 AccessKey Secret                                                                                  |
| `ENDPOINT_OVERRIDE`     | OSS 端点，例如 `'oss-cn-hangzhou.aliyuncs.com'`                                                      |

### S3

| 参数                     | 描述                                           |
| ------------------------ | ---------------------------------------------- |
| `CREDENTIALS_KIND`     | `'Explicit'`, `'Anonymous'`, `'Default'` |
| `S3_ACCESS_KEY_ID`     | 你的 AWS 访问密钥 ID                           |
| `S3_SECRET_ACCESS_KEY` | 你的 AWS 私有访问密钥                          |
| `S3_REGION`            | AWS 区域，例如 `'us-east-1'`                 |
| `ENDPOINT_OVERRIDE`    | 自定义端点（用于兼容 S3 的服务）               |

### URL 方案

| 方案   | 示例                                          |
| ------ | --------------------------------------------- |
| HTTPS  | `https://bucket.endpoint/path/file.parquet` |
| OSS    | `oss://bucket/path/file.parquet`            |
| S3     | `s3://bucket/path/file.parquet`             |

---

## 常见陷阱

### 1. 扩展加载顺序很重要

始终先 `install` 再 `load`。如果出现"Extension not found"错误，先运行 `install`：

```cypher
install httpfs;    -- 下载（一次性）
install parquet;   -- 下载（一次性）
load httpfs;       -- 激活
load parquet;      -- 激活
```

### 2. LOAD FROM 与 COPY FROM 的区别

- `LOAD FROM` = 扫描/预览远程数据而不导入到图中
- `COPY ... FROM (LOAD FROM ...)` = 导入到图中（如果表不存在则创建表）

### 3. 节点表：第一列是主键

对于节点表，文件的第一列会自动成为主键。确保你的数据文件在第一个位置有一个 ID 列。

### 4. 边表：前两列是源/目标 ID

边表需要 `(from="<node_table>", to="<node_table>")` 来指定边连接的是哪个节点表。边文件的前两列被视为源和目标顶点 ID（引用所连接节点表的主键）。

---

## 完整可运行脚本

```python
from neug import Database
import tempfile
import os

db = Database(db_path=tempfile.mkdtemp(), mode="w")
conn = db.connect()

# 扩展
conn.execute("install httpfs")
conn.execute("install parquet")
conn.execute("load httpfs")
conn.execute("load parquet")

# 预览
result = conn.execute('''
    LOAD FROM "https://graphscope.oss-cn-beijing.aliyuncs.com/neug/vPerson.parquet"
    RETURN ID, fName, age, isStudent LIMIT 3
''')
print("预览:", list(result))

# 导入节点（无 DDL）
conn.execute('''
    COPY Person FROM (
        LOAD FROM "https://graphscope.oss-cn-beijing.aliyuncs.com/neug/vPerson.parquet"
        RETURN *
    )
''')

# 导入边（无 DDL）
conn.execute('''
    COPY MEETS FROM (
        LOAD FROM "https://graphscope.oss-cn-beijing.aliyuncs.com/neug/eMeets.parquet"
        RETURN *
    ) (from="Person", to="Person")
''')

# 查询
result = conn.execute('''
    MATCH (a:Person)-[m:MEETS]->(b:Person)
    WHERE a.age > 30
    RETURN a.fName, b.fName, m.location
''')
print("查询结果:", list(result))

# 导出为 Parquet
out = os.path.join(tempfile.mkdtemp(), "young_social.parquet")
conn.execute(f'''
    COPY (
        MATCH (a:Person)-[m:MEETS]->(b:Person)
        WHERE a.age < 35
        RETURN a.fName AS name, a.age AS age, b.fName AS met_person, m.location
    ) TO '{out}'
''')
print(f"已导出至：{out}（{os.path.getsize(out)} 字节）")

# to_arrow()
result = conn.execute("MATCH (p:Person) RETURN p.ID, p.fName, p.age ORDER BY p.ID")
table = result.to_arrow()
print(f"Arrow 表：{table.num_rows} 行，列：{table.column_names}")

conn.close()
db.close()
```
