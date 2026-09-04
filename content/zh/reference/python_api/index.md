# Python API 参考

NeuG Python API 提供高级、Pythonic 的接口与 NeuG 图数据库交互。专为易用性和快速开发设计。

## 概述

Python API 提供简单而强大的方式：

- **连接数据库**：建立到本地或远程 NeuG 实例的连接
- **执行查询**：运行 Cypher 查询并自动解析结果
- **管理事务**：处理 ACID 事务确保数据一致性
- **处理结果**：使用熟悉的 Python 模式处理图数据

## 核心类

- **[Database](database)** - NeuG 数据库的入口
- **[Connection](connection)** - Connection 表示到数据库的逻辑连接
- **[Session](session)** - Session 是连接到 NeuG 服务器的类
- **[QueryResult](query_result)** - QueryResult 表示 Cypher 查询的结果

## 快速开始

### 安装

```bash
pip install neug
```

### 基本用法

```python
import neug

# 连接到数据库
db = neug.Database("/path/to/database")
conn = db.connect()

# 执行简单查询
result = conn.execute("MATCH (n) RETURN n LIMIT 10")

# 处理结果
for record in result:
    node = record['n']
    print(f"Node ID: {node.id}, Labels: {node.labels}")

# 关闭连接
conn.close()
```

### 上下文管理器用法

```python
import neug

# 使用上下文管理器自动清理
with neug.Database("/path/to/database").connect() as conn:
    result = conn.execute("MATCH (n:Person) RETURN n.name")
    names = [record['n.name'] for record in result]
    print(names)
```

## 事务管理

```python
conn.begin_transaction()
try:
    conn.execute(
        "CREATE (p:Person {name: $name})",
        parameters={"name": "Alice"},
    )
    conn.execute(
        "CREATE (p:Person {name: $name})",
        parameters={"name": "Bob"},
    )
    conn.commit()
except Exception:
    conn.rollback()
    raise
```

## 高级功能

### 参数化查询

```python

# 安全的参数传递
result = conn.execute(
    "MATCH (p:Person) WHERE p.age > $min_age RETURN p",
    min_age=25
)
```

### 批量操作

```python

# 高效执行多条语句
statements = [
    ("CREATE (p:Person {name: $name})", {"name": "Alice"}),
    ("CREATE (p:Person {name: $name})", {"name": "Bob"}),
]
conn.execute_batch(statements)
```

## 错误处理

```python
try:
    result = conn.execute("INVALID CYPHER QUERY")
except neug.CypherError as e:
    print(f"Query error: {e}")
except neug.ConnectionError as e:
    print(f"Connection error: {e}")
```

## 类型提示支持

Python API 包含全面的类型提示以提供更好的 IDE 支持：

```python
from neug import Database, Connection, QueryResult
from typing import Iterator, Dict, Any

db: Database = Database("path/to/database")
conn: Connection = db.connect()
result: QueryResult = conn.execute("MATCH (n) RETURN n")
records: Iterator[Dict[str, Any]] = iter(result)
```
