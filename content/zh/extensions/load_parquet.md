# Parquet 扩展

Apache Parquet 是一种列式存储格式，在数据工程和分析工作负载中被广泛使用。NeuG 通过扩展框架支持 Parquet 文件的导入和导出功能。

- **导入**：使用 `LOAD FROM` 语法加载外部 Parquet 文件
- **导出**：使用 `COPY TO` 语法将查询结果导出到 Parquet 文件

## 安装扩展

```cypher
INSTALL PARQUET;
```

## 加载扩展

```cypher
LOAD PARQUET;
```

## 使用 Parquet 扩展

`LOAD FROM` 读取 Parquet 文件并将其列暴露以供查询。默认情况下，模式会从 Parquet 文件元数据中自动推断。

### Parquet 格式选项

以下选项用于控制 Parquet 文件的读取方式：

| 选项                     | 类型   | 默认值  | 描述                                                                                                                                 |
| ------------------------ | ------ | ------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `buffered_stream`        | bool   | `true`  | 启用缓冲 I/O 流以提升顺序读取性能。缓冲区大小（单位：字节）由通用选项 `batch_size` 控制（默认为 1 MiB）。                             |
| `pre_buffer`             | bool   | `false` | 在解码前预先缓冲列数据。建议在高延迟文件系统（例如 S3）上启用。                                                                      |
| `enable_io_coalescing`   | bool   | `true`  | 启用 Arrow I/O 的读取合并（即“空洞填充缓存”），以减少读取非连续字节范围时的 I/O 开销。设为 `true` 时采用惰性合并；设为 `false` 时采用急切合并。 |
| `parquet_batch_rows`     | int64  | `65536` | 将 Parquet 行组转换为内存中批次时，每个 Arrow 记录批次所含的行数。                                                                     |

### 查询示例

#### 基本 Parquet 加载

从 Parquet 文件中加载所有列：

```cypher
LOAD FROM "person.parquet"
RETURN *;
```

#### 指定批次大小

通过调整每批次读取的行数来调节内存使用：

```cypher
LOAD FROM "person.parquet" (parquet_batch_rows=8192)
RETURN *;
```

#### 启用 I/O 聚合

为能从预取连续数据中受益的工作负载启用急切 I/O 聚合：

```cypher
LOAD FROM "person.parquet" (enable_io_coalescing=false)
RETURN *;
```

#### 列投影

仅返回 Parquet 数据中的特定列：

```cypher
LOAD FROM "person.parquet"
RETURN fName, age;
```

#### 列别名

使用 `AS` 为列分配别名：

```cypher
LOAD FROM "person.parquet"
RETURN fName AS name, age AS years;
```

> **注意：** `LOAD FROM` 支持的所有关系操作 — 包括类型转换、WHERE 过滤、聚合、排序和限制 — 在 Parquet 文件上同样适用。完整的操作列表请参见 [LOAD FROM 参考文档](../data_io/load_data)。

## 导出到 Parquet

NeuG 支持使用 `COPY TO` 命令将查询结果导出到 Parquet 文件。这在以下场景中非常有用：
- **数据归档**：以高效的列式格式存储查询结果
- **数据共享**：与其他分析工具（如 Spark、Pandas、DuckDB 等）交换数据
- **性能**：Parquet 的列式格式提供了出色的压缩率和查询性能

### 基本导出语法

将查询结果导出到 Parquet 文件：

```cypher
COPY (
    MATCH (p:person)
    RETURN p.ID, p.fName, p.age
) TO 'output.parquet';
```

### 导出选项

以下选项控制如何写入 Parquet 文件：

| 选项                   | 类型   | 默认值   | 描述                                                                                                             |
| ---------------------- | ------ | -------- | ---------------------------------------------------------------------------------------------------------------- |
| `compression`          | 字符串 | `snappy` | 压缩编解码器：`snappy`、`gzip`、`zstd` 或 `none`                                                                |
| `row_group_size`       | int64  | `1048576`| 每个行组的行数（1,048,576 = 100 万行）。较大的值可提高压缩率，但会使用更多内存。                                |
| `dictionary_encoding`  | 布尔值 | `true`   | 对字符串列启用字典编码。对于包含重复值的列，可以减少文件大小。                                                   |

### 导出示例

#### 使用 ZSTD 压缩导出

```cypher
COPY (
    MATCH (p:person)
    RETURN p.*
) TO 'person.parquet' (compression='zstd');
```

#### 使用自定义行组大小导出

```cypher
COPY (
    MATCH (v:node)
    RETURN v.*
) TO 'nodes.parquet' (row_group_size=500000);
```

#### 无压缩导出

```cypher
COPY (
    MATCH (p:Person)-[k:KNOWS]->(p2:Person)
    RETURN p.fName, p2.fName, k.since
) TO 'relationships.parquet' (compression='none');
```

#### 禁用字典编码导出

```cypher
COPY (
    MATCH (p:Person)
    RETURN p.fName, p.email
) TO 'contacts.parquet' (dictionary_encoding=false);
```

### 支持的数据类型

Parquet 导出支持所有 NeuG 数据类型：

**基本类型：**
- INT32, INT64, UINT32, UINT64
- FLOAT, DOUBLE, BOOLEAN
- STRING, DATE, TIMESTAMP, INTERVAL

**复杂类型：**
- **List<T>**: 变长数组（例如，`list<string>`、`list<int64>`）
- **Struct**: 具有命名字段的嵌套结构
- **Vertex**: 图顶点导出为 JSON 字符串（由于混合类型模式冲突）
- **Edge**: 图边导出为 JSON 字符串（由于混合类型模式冲突）
- **Path**: 图路径导出为 JSON 字符串（由于混合类型模式冲突）

> **关于 Vertex/Edge/Path 导出的说明：** 这些图类型被导出为 JSON 字符串而不是 Parquet StructArray。此设计选择是必要的，因为 Parquet StructArray 要求所有行具有相同的模式，但混合类型的顶点/边（例如，person 与 organisation）具有不同的属性，这将导致模式冲突和稀疏数据。

### 导出顶点和边数据

导出完整的顶点对象：

```cypher
COPY (
    MATCH (p:person)
    RETURN p
) TO 'vertices.parquet';
```

这将创建一个 Parquet 文件，其中包含一个 JSON 字符串列，用于存储序列化的顶点数据：
```
p: string (JSON)
  例如 {"_ID": 1, "_LABEL": "person", "fName": "Alice", "age": 30, ...}
```

导出完整的边对象：

```cypher
COPY (
    MATCH (p:Person)-[k:KNOWS]->(p2:Person)
    RETURN k
) TO 'edges.parquet';
```

这将创建一个 Parquet 文件，其中包含一个 JSON 字符串列，用于存储序列化的边数据：
```
k: string (JSON)
  例如 {"_ID": 100, "_LABEL": "knows", "_SRC_ID": 1, "_DST_ID": 2, "since": "2020-01-01", ...}
```

### 性能提示

1. **选择适当的压缩方式**：
   - `snappy`：速度和压缩率的良好平衡（默认）
   - `zstd`：最佳压缩率，但稍慢一些
   - `none`：最快，但文件更大

2. **根据你的用例调整行组大小**：
   - 大数据集（>10M 行）：使用默认的每组合 1M 行
   - 中等数据集（100K-10M 行）：使用每组合 500K 行
   - 小数据集（<100K 行）：使用每组合 100K 行

3. **对具有重复值的字符串列启用字典编码**（例如，类别、状态码）

4. **仅导出所需列**以减少文件大小：
   ```cypher
   COPY (
       MATCH (p:person)
       RETURN p.ID, p.fName  -- 不是 p.*
   ) TO 'subset.parquet';
   ```

### 端到端示例

导出数据并通过重新加载来验证：

```cypher
-- 步骤 1: 导出为 Parquet 格式
COPY (
    MATCH (p:person)
    RETURN p.ID, p.fName, p.age
) TO 'export.parquet';

-- 步骤 2: 重新加载以验证
LOAD FROM "export.parquet"
RETURN *;
```
