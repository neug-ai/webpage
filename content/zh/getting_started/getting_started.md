# 快速入门

本指南将引导您创建第一个图数据库、查询关系、添加 NeuG v0.2 引入的索引，并探索嵌入式和服务两种模式。示例采用 **Python** 编写。

> **使用其他语言？** 请参阅 [Node.js API 参考](../../reference/nodejs_api/index) 或 [C++ API 参考](../../reference/cpp_api/index)，获取对应语言的等效示例。

## 前提条件

在开始之前，请确保你已安装了 NeuG。如果尚未安装，请按照[安装指南](../../installation/installation)进行操作。

## 数据库存储模式

### 持久化数据库
- **使用场景**：生产应用、数据分析、长期存储
- **持久性**：数据在应用程序重启后仍然存在

```python

# 持久化模式示例

# 确保数据库目录存在且用户可写。
db_persistent = neug.Database("/path/to/database")
```

### 内存数据库
- **使用场景**：临时计算、测试、原型开发
- **持久性**：数据库关闭后，数据将丢失

```python

# 内存模式示例
db_memory = neug.Database("")
```

> **注意：** 目前，NeuG 的内存模式会创建一个临时数据库目录，该目录会在数据库关闭时自动清理。

## 连接模式

NeuG 提供两种访问数据库的模式：

### 嵌入式模式
直接进程内访问 - 最适合单用户场景：

```python
import neug

# 创建数据库并直接连接
db = neug.Database("/path/to/database")  # 或使用 "" 表示内存模式
conn = db.connect()

print("以嵌入式模式连接到 NeuG")

conn.close()
db.close()
```

### 服务模式
基于网络的访问 - 适合多用户应用程序：

**启动服务：**
```python
import neug

# 以服务形式启动 NeuG
db = neug.Database("/path/to/database")
service = db.serve(host="localhost", port=10000, blocking=False, thread_num=0)
```

`thread_num` 控制服务线程的数量。
默认值 `0` 会根据数据库的 `max_thread_num` 自动选择。在默认数据库线程配置下，`max_thread_num` 将依据硬件并发能力自动推导；若运行时无法检测到硬件并发数，则回退为 `1`。
服务线程可并发执行 TP 查询，但每个查询仅使用一个执行上下文和一个线程。

嵌入式（AP）查询目前为单线程；利用 `max_thread_num` 实现查询内部并行化属于后续工作。

**从客户端连接：**
```python
from neug import Session

# 连接到服务
session = Session("http://localhost:10000/")

session.close()
```

## 基本操作

以下操作在你选择的数据库模式（内存或持久化）和连接模式（嵌入式或服务）下都以相同的方式工作。在此示例中，我们假设使用嵌入模式下的持久化数据库。

```python
import neug

# 创建数据库并建立连接
db = neug.Database("/path/to/database")
conn = db.connect()
```

### 创建节点和边

在插入数据之前，你需要使用节点和边类型定义图模式：

```python

# 创建节点表
conn.execute("""
    CREATE NODE TABLE Person(
        id INT64,
        name STRING,
        age INT64,
        email STRING,
        bio STRING,
        embedding FLOAT[4],
        PRIMARY KEY (id)
    )
""")

conn.execute("""
    CREATE NODE TABLE Company(
        id INT64,
        name STRING,
        industry STRING,
        founded_year INT64,
        PRIMARY KEY (id)
    )
""")

# 创建边表
conn.execute("""
    CREATE REL TABLE WORKS_FOR(
        FROM Person TO Company,
        position STRING,
        start_date DATE,
        salary DOUBLE
    )
""")

conn.execute("""
    CREATE REL TABLE KNOWS(
        FROM Person TO Person,
        since_year INT64,
        relationship_type STRING
    )
""")

print("图模式创建成功！")
```

### 插入数据

现在让我们向图中添加一些数据：

```python

# 插入节点
conn.execute("""
    CREATE (p:Person {
        id: 1,
        name: 'Alice Johnson',
        age: 30,
        email: 'alice@example.com',
        bio: 'Graph databases and distributed systems',
        embedding: [0.1, 0.2, 0.3, 0.4]
    })
""")

conn.execute("""
    CREATE (p:Person {
        id: 2,
        name: 'Bob Smith',
        age: 35,
        email: 'bob@example.com',
        bio: 'Machine learning and semantic search',
        embedding: [0.2, 0.1, 0.1, 0.1]
    })
""")

conn.execute("""
    CREATE (c:Company {id: 1, name: 'TechCorp', industry: 'Technology', founded_year: 2010})
""")

# 插入关系
conn.execute("""
    MATCH (p:Person), (c:Company) WHERE p.id = 1 AND c.id = 1
    CREATE (p)-[:WORKS_FOR {position: 'Software Engineer', start_date: date('2020-01-15'), salary: 75000.0}]->(c)
""")

conn.execute("""
    MATCH (p1:Person {id: 2}), (p2:Person {id: 1})
    CREATE (p1)-[:KNOWS {since_year: 2018, relationship_type: 'colleague'}]->(p2)
""")

print("数据插入成功！")
```

### 查询数据

让我们通过一些查询来探索你的图：

```python

# 简单的节点查询
result = conn.execute("MATCH (p:Person) RETURN p.name, p.age")
for record in result:
    print(record)
    # ['Alice Johnson', 30]
    # ['Bob Smith', 35]

# 关系查询
result = conn.execute("""
    MATCH (p:Person)-[w:WORKS_FOR]->(c:Company)
    RETURN p.name, w.position, c.name
""")
for record in result:
    print(f"{record[0]} works as {record[1]} at {record[2]}")
    # Alice Johnson works as Software Engineer at TechCorp

# 复杂模式查询
result = conn.execute("""
    MATCH (p1:Person)-[:KNOWS]->(p2:Person)-[:WORKS_FOR]->(c:Company)
    RETURN p1.name as person1, p2.name as person2, c.name as company
""")
for record in result:
    print(f"{record[0]} knows {record[1]} who works at {record[2]}")
    # Bob Smith knows Alice Johnson who works at TechCorp
```

### 对相同数据建立索引（NeuG v0.2+）

NeuG v0.2 引入了存储索引、HNSW 向量搜索以及 BM25 全文搜索功能。这些能力在 NeuG v0.1.x 中不可用。以下示例将语义索引和关键词索引添加到上文图查询所使用的相同 `Person` 节点上。

```python
# 加载索引扩展
conn.execute("LOAD vector_search;")
conn.execute("LOAD fts;")

# 使用 HNSW 为语义嵌入建立索引
conn.execute("""
    CREATE INDEX person_embedding_idx IF NOT EXISTS
    ON Person
    USING HNSW (embedding)
    WITH (metric = 'l2')
""")

# 为人物简介建立 BM25 全文索引
conn.execute("""
    CREATE INDEX person_bio_idx IF NOT EXISTS
    ON Person
    USING FTS (bio)
""")

# 查询语义相似性
semantic_results = conn.execute("""
    MATCH (p:Person)
    RETURN p.name,
           vector_distance_l2(p.embedding, [0.1, 0.2, 0.3, 0.4]) AS distance
    ORDER BY distance ASC
    LIMIT 5
""")

# 查询精确关键词并使用 BM25 排序
keyword_results = conn.execute("""
    MATCH (p:Person)
    RETURN p.name, bm25(p.bio, 'graph databases') AS score
    ORDER BY score ASC
    LIMIT 5
""")

print(list(semantic_results))
print(list(keyword_results))
print(list(conn.execute("CALL SHOW_INDEXES() RETURN *;")))
```

图结构与两种存储索引均基于同一份数据进行维护。插入、更新和删除操作均会在同一事务中同步更新这些索引。有关索引生命周期及恢复保障的详细信息，请参阅[存储索引](../../storage_index/index)。有关完整的搜索选项，请参阅[向量搜索](../../extensions/vector_search)和[全文搜索](../../extensions/fts_search)。

### 转换结果为 Apache Arrow

NeuG 支持通过 `to_arrow()` 方法将查询结果直接转换为 [Apache Arrow](https://arrow.apache.org/) 表格。这使得与 PyData 生态系统（pandas、Polars、DuckDB 以及任何理解 Arrow 的其他库）实现零拷贝互操作。

```python
import neug

db = neug.Database("/path/to/database")
conn = db.connect()

# 运行查询并转换为 Arrow 表格
result = conn.execute("""
    MATCH (p:Person)-[w:WORKS_FOR]->(c:Company)
    RETURN p.name AS name, p.age AS age, w.salary AS salary, c.name AS company
""")
arrow_table = result.to_arrow()
print(arrow_table)

# pyarrow.Table

# name: string

# age: int64

# salary: double

# company: string

# 转换为 pandas DataFrame
df = arrow_table.to_pandas()
print(df)

#             name  age   salary   company

# 0  Alice Johnson   30  75000.0  TechCorp
```

> **注意：** `to_arrow()` 需要安装 [PyArrow](https://pypi.org/project/pyarrow/)（`pip install pyarrow`）。返回的 `pyarrow.Table` 会保留 Cypher 查询中 `RETURN` 子句的列名。

### 关闭连接和数据库

```python
conn.close()
db.close()
```

### 使用内置数据集

NeuG 提供了几个内置数据集，你可以用它们快速开始图分析、学习或测试。这些数据集即开即用，无需设置。

#### 可用数据集

你可以列出所有可用的内置数据集：

```python
from neug.datasets import get_available_datasets

# 列出所有可用数据集
datasets = get_available_datasets()
for dataset in datasets:
    print(f"{dataset.name}: {dataset.description}")
```

#### 加载内置数据集

```python
import neug

# 打开/创建一个数据库
db = neug.Database("/path/to/database")

# 将内置数据集加载到其中
db.load_builtin_dataset(dataset_name="modern_graph")
```

> **注意：** 如果存在模式冲突（例如，具有相同名称的现有节点/边类型），将内置数据集加载到现有数据库中会失败。

## 下一步

恭喜！您已经掌握了 NeuG 的基础知识。接下来，您可以探索以下内容：

1. **[存储索引](../../storage_index/index)**：了解索引的生命周期、事务处理及恢复机制
2. **[向量搜索](../../extensions/vector_search)**：配置 HNSW 索引并执行相似性查询
3. **[全文搜索](../../extensions/fts_search)**：使用 BM25、短语、前缀及布尔查询
4. **[图算法](../../extensions/load_gds)**：在投影图上运行分析任务
5. **[事务管理](../../transaction/transaction)**：学习 NeuG 的事务模型与隔离级别
6. **[数据导入/导出](../../data_io/import_data)** 和 **[Cypher 手册](../../cypher_manual/index)**：加载生产数据并编写高级查询
