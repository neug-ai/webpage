# COPY FROM

`COPY FROM` 将外部数据持久化到 NeuG 的图存储中。它构建于 [`LOAD FROM`](load_data) 之上——在内部，`COPY FROM` 使用 `LOAD FROM` 来读取和解析外部文件，然后将结果写入节点表或关系表。

其变体 **`COPY TEMP`** 将外部数据作为**临时图**导入，其生命周期与当前连接绑定。连接关闭时，临时表会被自动清除，这使得 `COPY TEMP` 非常适合用于即席分析，且不会污染持久化 Schema。

## 模式要求

您可以创建**预定义模式**——即在导入数据前定义节点/关系表，且外部文件中的列必须与表属性相匹配。

自 v0.1.2 起，NeuG 支持灵活模式的持久化导入——允许 `COPY FROM` 利用 `LOAD FROM` 的类型推断能力，而无需预定义模式。这将使快速接入新数据集变得更加轻松。更多用法请参阅[无需预定义模式的导入](#import-without-a-predefined-schema)。

> **COPY TEMP** 始终自动推断模式。第一列将作为节点的主键；对于关系，前两列则作为源/目标键。

---

## 快速开始

以下是从 CSV 导入社交网络数据集的完整示例。

### 步骤 1：准备数据文件

**users.csv：**

```csv
id,name,age,email
1,Alice Johnson,30,alice@example.com
2,Bob Smith,25,bob@example.com
3,Carol Davis,28,carol@example.com
```

**friendships.csv：**

```csv
from_user_id,to_user_id,since_year
1,2,2020
2,3,2019
1,3,2021
```

### 第 2 步：创建模式

```cypher
CREATE NODE TABLE User(
    id INT64 PRIMARY KEY,
    name STRING,
    age INT64,
    email STRING
);

CREATE REL TABLE FRIENDS(
    FROM User TO User,
    since_year INT64
);
```

### 第 3 步：导入数据

```cypher
// 首先导入节点（顺序很重要——节点必须在关系之前存在）
COPY User FROM "users.csv" (header=true, delimiter=",");

// 然后导入关系
COPY FRIENDS FROM "friendships.csv" (
    from="User",
    to="User",
    header=true,
    delimiter=","
);
```

### 第 4 步：验证

```cypher
MATCH (u:User) RETURN count(u) AS user_count;

MATCH (u1:User)-[f:FRIENDS]->(u2:User)
RETURN u1.name, u2.name, f.since_year
LIMIT 5;
```

### 临时图

若要将相同数据作为**临时**图导入（无 DDL，无持久化）：

```cypher
// 临时节点表（自动推断模式，第一列 = 主键）
COPY TEMP TempUser FROM "users.csv" (header=true, delimiter=",");

// 临时关系表（from/to 指定端点标签）
COPY TEMP TEMP_FRIENDS FROM "friendships.csv" (
  header=true,
  delimiter=",",
  from='TempUser',
  to='TempUser'
);

// 查询方式相同
MATCH (u1:TempUser)-[f:TEMP_FRIENDS]->(u2:TempUser)
RETURN u1.name, u2.name, f.since_year;

// 临时表会在连接关闭时自动删除。
// 或者在此之前手动删除：
DROP TABLE TEMP_FRIENDS;
DROP TABLE TempUser;
```

---

## 导入节点表

创建节点表并导入数据：

```cypher
CREATE NODE TABLE Person(id INT64, name STRING, age INT64, PRIMARY KEY(id));
```

```cypher
COPY Person FROM "person.csv" (header=true);
```

如果数据分布在多个文件中，请使用通配符：

```cypher
COPY Person FROM "person*.csv" (header=true);
```

> **注意：** CSV 文件中的列数和列顺序必须与节点表中定义的属性完全匹配。

**临时节点表** — 无需 DDL，自动推断模式：

```cypher
COPY TEMP TempPerson FROM "person.csv" (header=true);

// With filter/projection via LOAD FROM subquery:
COPY TEMP TempAdults FROM (
    LOAD FROM "person.csv" (header=true)
    WHERE age >= 18
    RETURN id, name
);
```

## 导入关系表

创建关系表并导入数据：

```cypher
CREATE REL TABLE KNOWS(FROM Person TO Person, weight DOUBLE);
```

```cypher
COPY KNOWS FROM "person_knows_person.csv" (from="Person", to="Person", header=true);
```

> **注意：** NeuG 假定前两列分别是 `FROM` 和 `TO` 节点的主键。其余列对应关系属性。必须指定 `from` 和 `to` 参数以标识端点节点表。

**临时关系表：**

```cypher
// 简单模式：前两列为源/目标键
COPY TEMP TEMP_KNOWS FROM "edges.csv" (
    header=true,
    from='Person',
    to='Person'
);

// 列重排序（当键不在 [0/1] 位置时）：
COPY TEMP TEMP_KNOWS FROM (
    LOAD FROM "edges_shuffled.csv" (header=true)
    RETURN src_id, dst_id, weight
) (from='Person', to='Person');
```

> **注意：** `from`/`to` 必须引用现有的顶点标签——可以是持久化表，也可以是先前创建的临时标签。

## 无预定义模式导入

启用 **`auto_detect`**（默认设置）后，将数据通过 `COPY ... FROM` 导入**新**标签时，会跳过为该标签手动执行 `CREATE NODE TABLE` / `CREATE REL TABLE` 的操作。编译器会构建一个执行计划，先应用推断类型的 DDL，然后运行与普通 `COPY` 相同的批量插入路径。

| 选项          | 类型 | 默认值  | 描述                                                                                                                                         |
| --------------- | ---- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `auto_detect` | bool | `true` | 如果目标表不存在，则根据扫描/探测结果推断模式并在插入前创建该表。如果为 `false`，则表缺失会报错。 |

必要时可以显式设置该选项：

```cypher
COPY User FROM "users.csv" (header=true, auto_detect=true);
COPY User FROM "users.csv" (header=true, auto_detect=false);  -- 要求表必须存在
```

> **注意：**
> 1. 对于 CSV 格式，如果 CSV 没有表头行，属性名将默认使用文件读取器自动生成的列名（例如 `f0`、`f1`、`f2` 等）。
> 2. **COPY TEMP** 始终以自动检测模式运行——它总是推断模式并创建临时表，因此 `auto_detect` 选项对 `COPY TEMP` 无效。

### 节点（新标签）

```cypher
// 文件包含表头：id,name,age
// id 成为主键
COPY Person FROM "person.csv" (header=true);
```

- 源数据的**第一列**将用作**主键**属性。如果文件列顺序导致推断错误，请使用 `LOAD FROM` 子查询重新排序（返回的第一列 = 主键），详情请参考[使用 load from 进行列重映射](#column-remapping-with-load-from)。
- **其他列**将成为节点属性；数据类型根据对文件或子查询输出的类型推断得出。
- **COPY 目标**（`COPY <Label> FROM ...`）即为新的**顶点标签**名称。

### 关系（新边类型）

```cypher
// 文件包含表头：src,dst,weight
// src 成为源列
// dst 成为目标列
// 其他列为边属性
COPY KNOWS FROM "person_knows_person.csv" (
    from="Person",
    to="Person",
    header=true,
    delimiter=","
);
```

- 输入文件中的**前两列**必须是**源**顶点和**目标**顶点的主键。如果不是，请在加载前使用[通过 load from 进行列重映射](#column-remapping-with-load-from)。
- **其余列**将作为关系属性加载。
- 对于**新**的关系标签，必须提供 **`from`** 和 **`to`** 来指定端点节点表。这两个表必须已经存在（请先创建或 `COPY` 它们）。`COPY <Label> FROM ...` 中的 `COPY` 目标名称将成为这两种节点类型之间的新边标签。

除了 CSV，一旦相应的读取器可用（需要时可通过扩展提供），同样的灵活模式导入与自动类型推断功能也适用于 **JSON**、**JSONL** 和 **Parquet**。有关更多用法，请参阅 [JSON/JSONL](#jsonjsonl) 和 [Parquet](#parquet)。

## 格式选项

### CSV

以下选项用于控制 `COPY FROM` 操作期间对 CSV 文件的解析。这些选项与 [`LOAD FROM`](load_data#csv) 所支持的选项相同：

| 选项       | 类型 | 默认值  | 描述                                   |
| ------------ | ---- | -------- | --------------------------------------------- |
| `delim`    | 字符 | `\|`    | 字段分隔符                               |
| `header`   | 布尔值 | `true` | 第一行是否包含列名   |
| `quote`    | 字符 | `"`    | 引号字符                               |
| `escape`   | 字符 | `\`    | 转义字符                              |
| `quoting`  | 布尔值 | `true` | 是否启用引号处理            |
| `escaping` | 布尔值 | `true` | 是否启用转义字符处理 |

`COPY FROM` 支持从 CSV、JSON 和 Parquet 文件中加载 `ARRAY` 类型数据。NeuG 不会对输入值进行隐式转换以生成 `ARRAY`；请使用 `LOAD FROM` 并显式将对应列强制转换为固定大小的 `ARRAY` 类型。

例如，假设有 `person_array.csv` 文件，其中一列为数组类型：

```csv
id,name,address
1,Alice,"[Beijing,Hangzhou,Shanghai]"
2,Bob,"[London,Paris,Berlin]"
```

```cypher
COPY Person FROM (
    LOAD FROM "person_array.csv" (delim=',')
    RETURN id, name, CAST(address, 'STRING[3]') AS addresses
);
```

### JSON/JSONL

自 NeuG v0.1.2 起，JSON/JSONL 已成为内置功能。您可以使用 `COPY FROM` 将 JSON 或 JSONL 文件直接导入图中，而无需预先创建表。NeuG 会根据文件内容自动推断模式。

```cypher
// JSON 数组文件 — 自动检测模式，
// 第一列作为主键
COPY Person FROM "person.json";

// JSONL 文件 — 同样自动检测
COPY Person FROM "person.jsonl";
```

> **版本说明：** 自 v0.1.2 版本起，我们将 JSON 支持设为内置功能，因此您在使用前无需安装 JSON 扩展。对于 NeuG < 0.1.2 版本，JSON 支持通过 [JSON 扩展](../extensions/load_json) 提供，使用前需要执行 `INSTALL json; LOAD json;`。

### Parquet

Parquet 支持通过 [Parquet 扩展](../extensions/load_parquet) 提供。安装并加载该扩展后，`COPY FROM` 可以直接导入 Parquet 文件——无需预先创建表。NeuG 会根据 Parquet 文件的元数据推断表结构。

```cypher
INSTALL parquet;
LOAD parquet;
```

```cypher
// 从 Parquet 元数据自动推断表结构
// 第一列作为主键
COPY Person FROM "person.parquet";
```

## 使用 LOAD FROM 进行列映射

由于 `COPY FROM` 基于 `LOAD FROM` 构建，你可以使用 `LOAD FROM` 子查询来**在持久化之前预处理数据**——包括列重新排序、重命名、类型转换和过滤。

### 重新排列列

当文件中的列顺序与表架构不一致时：

**person_remap.csv:**

```
age,name,id
39,marko,1
27,vadas,2
32,josh,3
35,peter,4
```

```cypher
COPY Person FROM (
    LOAD FROM "person_remap.csv"
    RETURN id, name, age
);
```

### 重新映射关系端点

**knows_remap.csv：**

```
dst_name,src_name,weight
josh,marko,1.0
vadas,marko,0.5
peter,josh,0.8
```

```cypher
COPY KNOWS FROM (
    LOAD FROM "knows_remap.csv"
    RETURN src_name AS src, dst_name AS dst, weight
);
```

### 导入时过滤

您可以在数据持久化之前对行进行过滤，从而无需清理源文件：

```cypher
COPY Person FROM (
    LOAD FROM "person.csv" (delim=',')
    WHERE age >= 18
    RETURN *
);
```

有关 `LOAD FROM` 子查询中可用的所有关系运算，请参阅 [LOAD FROM](load_data) 参考文档。

---

## 性能选项

| 选项           | 类型   | 默认值             | 描述                                                                 |
| -------------- | ------ | ------------------ | -------------------------------------------------------------------- |
| `batch_read`   | bool   | `false`            | 以批处理方式增量读取数据。                                           |
| `batch_size`   | int64  | `1048576`（1 MB）  | 启用 `batch_read` 时，每批次的字节数。                               |
| `parallel`     | bool   | `false`            | 启用多线程并行读取（最多使用 CPU 核心数）。对 Parquet 文件启用时，将并发扫描行组，但**不保证**行的原始顺序。 |

```cypher
COPY User FROM "large_users.csv" (header=true, parallel=true);
```

### 导入顺序

始终**先导入节点，再导入关系**，因为关系端点必须引用已存在的节点：

```cypher
COPY User FROM "users.csv" (header=true);
COPY Company FROM "companies.csv" (header=true);
-- 只有在所有节点加载完成后：
COPY WORKS_FOR FROM "works_for.csv" (header=true);
```

### 大数据集

对于大于 1GB 的文件，考虑将其拆分：

```bash

# 将大 CSV 拆分为较小的块
split -l 100000 large_users.csv users_chunk_

# 然后从每个分块文件中复制用户。

# 注意：仅对第一个分块使用 `header=true`
```

---

## 故障排除

### "表不存在" 错误

- **如果 `auto_detect` 为 `true`（默认值）** 对于一个 **新** 标签，NeuG 应该推断模式并创建表；如果你仍然看到此错误，请检查数据源是否正确绑定（例如文件路径、`header`、分隔符），以便发现列。对于边，**`from` 和 `to`** 必须命名 **现有** 节点类型 — 先创建或 `COPY` 这些节点。
- **如果 `auto_detect` 为 `false`**，目标表必须已存在：

```cypher
-- 使用 auto_detect=false 时，表必须存在
COPY User FROM "users.csv" (header=true, auto_detect=false);

-- 或者先创建 DDL：
CREATE NODE TABLE User(id INT64 PRIMARY KEY, name STRING);
COPY User FROM "users.csv" (header=true, auto_detect=false);
```

### "列数不匹配" 错误

CSV 文件的列数必须与表结构相同：

```csv
-- 错误：缺少 'age' 列
id,name,email
1,Alice,alice@example.com

-- 正确：所有列都存在
id,name,age,email
1,Alice,30,alice@example.com
```

### "主键冲突" 错误

检查源文件中是否有重复的 ID：

```bash
cut -d',' -f1 users.csv | sort | uniq -d
```
