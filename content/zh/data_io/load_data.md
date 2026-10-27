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

JSON 和 JSONL 是内置格式。格式根据文件扩展名推断：

| 扩展名 | 格式 | 描述 |
| --------- | ------ | ----------- |
| `.json` | JSON 数组 | 一个包含所有行（作为对象）的 JSON 数组 |
| `.jsonl` | JSON Lines | 每行一个 JSON 对象 |

例如，JSON 数组包含多个对象：

```json
[
  {"id": 1, "name": "Alice", "age": 30},
  {"id": 2, "name": "Bob", "age": 25}
]
```

JSONL 文件每行存储一个对象：

```jsonl
{"id": 1, "name": "Alice", "age": 30}
{"id": 2, "name": "Bob", "age": 25}
```

无需安装或加载扩展，即可对这两种格式使用 `LOAD FROM`：

```cypher
LOAD FROM "person.json"
RETURN *;

LOAD FROM "person.jsonl"
RETURN *;
```

下面描述的所有关系运算（包括投影、别名、过滤、聚合、排序和限制）都适用于这两种格式。

### Parquet

通过 PARQUET 扩展支持 Parquet。一次性安装并加载后，您可以使用 `LOAD FROM` 直接读取 `.parquet` 文件：

```cypher
INSTALL PARQUET;
LOAD PARQUET;

LOAD FROM "person.parquet"
RETURN *;
```

请参阅 [Parquet 扩展](../extensions/load_parquet) 页面，了解格式特定选项（`batch_size`、`buffered_stream`、`pre_buffer`、`enable_io_coalescing`、`batch_rows`）和示例，包括如何通过 `COPY TO` 将查询结果导出为 Parquet。

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

仅返回谓词求值结果为 `true` 的行。与 `NULL` 的比较会产生未知结果；请使用 `IS NULL` 或 `IS NOT NULL` 来测试缺失值。布尔表达式会保留该未知结果，除非另一个操作数决定了最终答案：`NULL AND false` 的结果是 `false`，而 `NULL OR true` 的结果是 `true`。

谓词可以包含算术运算、类型转换和参数。例如：

```cypher
LOAD FROM "person.jsonl"
WHERE CAST(age, 'DOUBLE') + 1 > 30
RETURN name;
```

每个文件读取器都会接收完整的谓词。如果其后端支持该表达式，它可以在 IO 期间进行过滤；否则，它会在返回请求的列之前，使用 NeuG 的查询表达式对解码后的数据求值谓词。即使谓词使用了从 `RETURN` 中省略的列，过滤仍然适用。参数使用每次查询执行时提供的值。

此选择权属于读取器：更改文件格式不需要更改查询或丢弃不支持的过滤器。与原生下推相比，对解码数据进行过滤可能会读取更多的行。

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

对于大文件，以下选项可以提升读取性能：

| 选项       | 类型  | 默认值        | 描述 |
| ------------ | ----- | -------------- | ----------- |
| `parallel`   | bool  | `false` | 启用使用多个线程（最多为核心数）的并行读取。对 Parquet 文件启用时，行组将被并发扫描，且**不保证**行顺序。 |

> **注意：**批量读取选项（`batch_read`、`batch_rows`）目前仅在 [`COPY FROM`](import_data#performance-options) 中受支持，在 `LOAD FROM` 中不受支持。 

示例：

```cypher
LOAD FROM "large_person.csv" (
    delim = ',',
    header = true,
    parallel = true
)
RETURN name, age;
```
