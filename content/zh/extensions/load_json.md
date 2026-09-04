# JSON 扩展

> **版本说明：** 自 v0.1.2 版本起，我们将 JSON 支持作为内置功能，因此在使用前无需安装 JSON 扩展。对于 NeuG 版本 < 0.1.2，JSON 支持通过扩展提供，需要在使用前执行 `INSTALL json; LOAD json;`。详情请参见 [LOAD FROM 参考](../data_io/load_data)。

JSON（JavaScript 对象表示法）是一种广泛使用的数据格式，用于 Web API 和数据交换。NeuG 通过扩展框架支持 JSON 文件导入功能。加载 JSON 扩展后，用户可以直接使用 `LOAD FROM` 语法加载外部 JSON 文件，或使用 `COPY TO` 语法将查询结果导出到 JSON 文件。

## 安装扩展

```cypher
INSTALL JSON;
```

## 加载扩展

```cypher
LOAD JSON;
```

## 使用 JSON 扩展

### 支持的格式

导入（`LOAD FROM`）和导出（`COPY TO`）都支持两种 JSON 格式：**JSON 数组**和 **JSONL**（JSON 行）。格式会根据文件扩展名自动推断，因此无需显式配置。

| 扩展名    | 格式       | 描述 |
| --------- | ---------- | ---- |
| `.json`   | JSON 数组  | 一个包含所有结果行对象的 JSON 数组。 |
| `.jsonl`  | JSON 行    | 每行一个 JSON 对象（与 JSONL 导入格式相同）。 |

#### JSON 数组格式

JSON 数组在单个数组结构中包含多个对象：

```json
[
  {"id": 1, "name": "Alice", "age": 30},
  {"id": 2, "name": "Bob", "age": 25}
]
```

对于具有 `.json` 扩展名的路径（例如 `person.json`），NeuG 会自动将文件视为 JSON 数组进行导入和导出。

#### JSONL 格式 (JSON Lines)

JSONL 格式每行包含一个 JSON 对象：

```jsonl
{"id": 1, "name": "Alice", "age": 30}
{"id": 2, "name": "Bob", "age": 25}
```

对于扩展名为 `.jsonl` 的路径（例如 `person.jsonl`），NeuG 在导入和导出时会自动将文件视为 JSONL 格式（每行一个 JSON 对象）。

### 从 JSON 加载

#### 基本 JSON 数组加载

从 JSON 数组文件中加载所有列：

```cypher
LOAD FROM "person.json"
RETURN *;
```

#### JSONL 格式加载

从 JSONL 文件加载数据。当路径具有 `.jsonl` 扩展名时，格式会被自动检测；

```cypher
LOAD FROM "person.jsonl"
RETURN *;
```

#### 列投影

从 JSON 数据中仅返回特定列：

```cypher
LOAD FROM "person.jsonl"
RETURN fName, age;
```

#### 列别名

使用 `AS` 为列分配别名：

```cypher
LOAD FROM "person.jsonl"
RETURN fName AS name, age AS years;
```

> **注意：** `LOAD FROM` 支持的所有关系操作 — 包括类型转换、WHERE 过滤、聚合、排序和限制 — 在 JSON 文件中都以相同方式工作。完整的操作列表请参见 [LOAD FROM 参考文档](../data_io/load_data)。

### 导出为 JSON

加载 JSON 扩展后，你可以使用 `COPY TO` 语法将查询结果导出为 JSON 或 JSONL 格式。

#### 导出为 JSON 数组

将查询结果导出为单个 JSON 数组文件：

```cypher
COPY (MATCH (p:person) RETURN p.*) TO 'person.json';
```

这会产生如下文件：

```json
[{"id": 1, "name": "marko", "age": 29},{"id": 2, "name": "vadas", "age": 27}]
```

#### 导出为 JSONL

通过使用 `.jsonl` 路径导出为 JSONL（每行一个对象）：

```cypher
COPY (MATCH (p:person) RETURN p.*) TO 'person.jsonl';
```

示例输出：

```jsonl
{"id": 1, "name": "marko", "age": 29}
{"id": 2, "name": "vadas", "age": 27}
```

JSONL 非常适合大型结果集和流式处理。你可以使用 `BATCH_SIZE` 参数控制每个批次写入的行数：

| 参数         | 描述                                                     | 默认值  |
| ----------- | --------------------------------------------------------- | ------- |
| `BATCH_SIZE` | 单个批次中写入的最大行数。                                | `1024`  |

有关导出选项和最佳实践的更多信息，请参见[导出数据](../data_io/export_data)。