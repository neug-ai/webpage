# 加载数据

`LOAD FROM` 是 NeuG 数据摄取管道的基础。它读取外部文件，**自动推断模式**（列名和类型），并生成一个仅在查询执行期间存在的临时结果集。无需预先定义模式。

您可以直接在加载的数据上应用标准关系操作——投影、过滤、类型转换、聚合、排序。这使得 `LOAD FROM` 成为数据探索、验证和即席分析的理想选择。

> **提示：** 要将加载的数据物化为持久图或临时图，请使用 [`COPY FROM` / `COPY TEMP`](import_data)。`LOAD FROM` 可用作 `COPY` 内部的子查询，以便在导入前对数据进行预处理。

---

## 基本语法

```cypher
LOAD FROM "<file_path>" (<options>)
[WHERE <condition>]
RETURN <column_list>
[ORDER BY <column> [ASC|DESC]]
[LIMIT <n>];
```

### 参数

- **`<file_path>`** — 外部数据源的路径。目前仅支持本地文件系统路径。
- **`<options>`** — 特定格式和性能相关选项（见下文）。
- **`RETURN <column_list>`** — 要返回的列。使用 `*` 返回所有列。

## 格式选项

### CSV

CSV 是内置格式。以下选项用于控制 CSV 文件的解析方式：

| 选项       | 类型   | 默认值 | 描述 |
| ---------- | ------ | ------ | ---- |
| `delim`    | 字符   | `\|`   | 字段分隔符。可以是单个字符（例如 `','`），也可以是转义字符（例如 `'\t'`） |
| `header`   | 布尔值 | `true` | 第一行是否包含列名 |
| `quote`    | 字符   | `"`    | 用于包围字段值的引号字符 |
| `escape`   | 字符   | `\`    | 用于转义特殊字符的转义字符 |
| `quoting`  | 布尔值 | `true` | 是否启用引号处理 |
| `escaping` | 布尔值 | `true` | 是否启用转义字符处理 |

示例：

```cypher
LOAD FROM "person.csv" (delim=',', header=true)
RETURN name, age;
```

NeuG 支持从 CSV、JSON 和 Parquet 文件中读取 `ARRAY` 类型数据。NeuG 不会对输入值进行隐式转换为 `ARRAY`；需在 `RETURN` 子句中显式地将列强制转换为固定大小的 `ARRAY` 类型。

例如，给定一个包含数组列的 `person_array.csv` 文件：

```csv
id,name,address
1,Alice,"[Beijing,Hangzhou,Shanghai]"
2,Bob,"[London,Paris,Berlin]"
```

```cypher
LOAD FROM "person_array.csv" (delim=',')
RETURN id, name, CAST(address, 'STRING[3]') AS addresses;
```

### JSON / JSONL

从 NeuG v0.1.2 开始，JSON/JSONL 是内置格式——无需安装扩展。你可以直接使用 `LOAD FROM` 来读取 `.json` 和 `.jsonl` 文件：

```cypher
LOAD FROM "person.json"
RETURN *;
```

> **版本说明：** 从 v0.1.2 版本开始，我们将 JSON 支持作为内置功能，因此在使用前无需安装 JSON 扩展。对于 NeuG 版本 < 0.1.2，JSON 支持通过 JSON 扩展提供，使用前需要执行 `INSTALL json; LOAD json;`。

查看 [JSON 扩展](../extensions/load_json) 页面了解特定于格式的选项和示例。

### Parquet

Parquet 通过 PARQUET 扩展（自 v0.1.1 起可用）支持。在一次性安装和加载后，你可以直接使用 `LOAD FROM` 来读取 `.parquet` 文件：

```cypher
INSTALL PARQUET;
LOAD PARQUET;

LOAD FROM "person.parquet"
RETURN *;
```

有关格式特定选项（`buffered_stream`、`pre_buffer`、`enable_io_coalescing`、`parquet_batch_rows`）和示例，请参见[Parquet 扩展](../extensions/load_parquet)页面，包括如何通过 `COPY TO` 将查询结果导出到 Parquet。

## 关系操作

`LOAD FROM` 支持对加载的数据进行丰富的关系操作。以下所有示例都使用 [Modern 数据集](../cypher_manual/dml_clause.md#loading-node-data)。

### 列投影和重新排序

列可以按任意顺序返回，与其在源文件中的顺序无关：

```cypher
LOAD FROM "knows.csv" (delim=',')
RETURN weight, dst_name, src_name;
```

### 列别名

使用 `AS` 为列分配别名：

```cypher
LOAD FROM "knows.csv" (delim=',')
RETURN src_name AS src, dst_name AS dst, weight AS score;
```

### 去重值

使用 `RETURN DISTINCT` 从结果中移除重复行：

```cypher
LOAD FROM "person.csv" (delim=',')
RETURN DISTINCT name;
```

你也可以在多个列上使用 `DISTINCT`：

```cypher
LOAD FROM "person.csv" (delim=',')
RETURN DISTINCT name, age;
```

### 类型转换

使用 `CAST` 函数将列值转换为特定类型：

```cypher
LOAD FROM "person.csv" (delim=',')
RETURN name, CAST(age, 'DOUBLE') AS double_age;
```

### WHERE 过滤

使用 `WHERE` 子句过滤行。可以使用 `AND`、`OR` 和 `NOT` 组合多个条件：

```cypher
LOAD FROM "person.csv" (delim=',')
WHERE age > 25 AND age < 40
RETURN name, age;
```

### 聚合

`LOAD FROM` 支持常见的聚合函数（`COUNT`、`SUM`、`AVG`、`MIN`、`MAX`）和分组聚合：

```cypher
LOAD FROM "person.csv" (delim=',')
RETURN
    COUNT(*) AS total,
    AVG(age) AS avg_age,
    MIN(age) AS min_age,
    MAX(age) AS max_age;
```

```cypher
LOAD FROM "person.csv" (delim=',')
RETURN name, AVG(age) AS avg_age;
```

### 排序和限制

```cypher
LOAD FROM "person.csv" (delim=',')
RETURN name, age
ORDER BY age DESC, name ASC
LIMIT 10;
```

## 性能选项

对于大型文件，以下选项可提升读取性能：

| 选项         | 类型   | 默认值        | 描述 |
| ------------ | ------ | -------------- | ---- |
| `parallel`   | bool   | `false` | 启用多线程并行读取（最多使用核心数）。对 Parquet 文件启用该选项时，行组将并发扫描，但**不保证**行的原始顺序。 |

> **注意：** 批量读取选项（`batch_read`、`batch_size`）当前仅在 [`COPY FROM`](import_data#performance-options) 中支持，`LOAD FROM` 尚不支持。

示例：

```cypher
LOAD FROM "large_person.csv" (
    delim = ',',
    header = true,
    parallel = true
)
RETURN name, age;
```
