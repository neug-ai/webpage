# Parquet

Apache Parquet 是一种列式存储格式，广泛应用于数据工程和分析工作负载。NeuG 通过扩展框架支持 Parquet 文件的导入和导出功能。

- **导入**：使用 `LOAD FROM` 语法
- **导出**：使用 `COPY TO` 语法

当前活跃的导入/导出后端基于 Apache Arrow。有关正在开发的下一代基于 Carquet 的后端，请参阅
[Carquet 后端说明](https://github.com/alibaba/neug/blob/main/extension/parquet/carquet_parquet_backend.md)
（位于源代码树中）。

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

以下选项控制 Parquet 文件的读取方式：

| 选项                   | 类型  | 默认值 | 描述                                                                                                                                 |
| ------------------------ | ----- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `buffered_stream`        | bool  | `true`  | 启用缓冲 I/O 流以提高顺序读取性能。缓冲区大小（以字节为单位）由 `batch_size` 下方控制。         |
| `batch_size`             | int64 | `1048576` (1 MiB) | 缓冲流的 I/O 批处理大小（以 **字节** 为单位）。只有 Parquet 读取器使用此选项。 |
| `pre_buffer`             | bool  | `false` | 在解码前预缓冲列数据。建议用于 S3 等高延迟文件系统。                                                |
| `enable_io_coalescing`   | bool  | `true`  | 启用 Arrow I/O 读取合并（填洞缓存）以减少读取非连续字节范围时的 I/O 开销。当 `true`，使用延迟合并；当 `false`，使用即时合并。 |
| `batch_rows`             | int64 | `65536` | 将 Parquet 行组转换为内存批次时，每个 Arrow 记录批次的行数。 `PARQUET_BATCH_ROWS` 仍作为已弃用的别名被接受。 |

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
LOAD FROM "person.parquet" (batch_rows=8192)
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

> **注意：** 支持 `LOAD FROM` 的所有关系操作 ——包括类型转换、WHERE 过滤、聚合、排序和限制——在处理 Parquet 文件时的工作方式相同。有关完整操作列表，请参阅 [LOAD FROM 参考](../data_io/load_data)。

当 `WHERE` 表达式在解码后需要过滤时，读取器仍会
裁剪列：它会读取请求的输出列以及过滤器引用的
所有列，包括嵌套表达式内的引用。仅用于过滤的列
会在过滤后从结果中移除。这适用于批量和全量
读取。在此回退路径中，谓词不会裁剪 Parquet 行组。

### 支持的数据类型

`LOAD FROM` 将 Parquet 值映射到 NeuG 类型，如下所示：

| Parquet 值 | NeuG 表示 |
| -------------- | ------------------- |
| 布尔值、有符号/无符号整数、浮点数和双精度浮点数 | 对应的标量类型；窄整数扩展为 INT32/UINT32 |
| UTF-8 字符串，包括大字符串 | VARCHAR |
| 日期和时间戳 | DATE 和毫秒级 TIMESTAMP，包含单位和溢出检查 |
| LIST 和 LARGE_LIST | LIST，保留 NULL 列表、空列表和 NULL 元素 |
| 带有 Arrow 模式元数据的固定大小列表 | 具有记录长度的 ARRAY |
| 相互嵌套的支持的列表和数组 | 嵌套的 LIST/ARRAY 值 |

可以检查 MAP 模式，但不支持 MAP 和常规 STRUCT 值列。INTERVAL 值保留其文本存储形式以供下游
转换。不支持的模式或无效的布局会报告错误。

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

Parquet 导出支持所有 NeuG 数据类型，其 Parquet 表示形式如下：

| NeuG 类型 | Parquet 表示形式 |
| --------- | ---------------------- |
| INT32, INT64, UINT32, UINT64 | INT32/INT64，必要时带有无符号逻辑注解 |
| FLOAT, DOUBLE, BOOL | FLOAT, DOUBLE, BOOLEAN |
| STRING | UTF-8 BYTE_ARRAY |
| DATE | 自 Unix 纪元起的天数表示的 DATE；毫秒级数据会归一化至其所属的 UTC 日 |
| TIMESTAMP | 以毫秒为单位的 UTC TIMESTAMP，与 NeuG 的内部单位匹配 |
| List\<T\>（可变长度）和固定 ARRAY | 标准 LIST，保留任意层级的空列表和 NULL；固定数组会根据模式维度进行验证 |
| Struct | 带有命名字段的嵌套组 |
| INTERVAL | 字符串值 |
| 节点, 边, 路径 | JSON 字符串（见下方注释） |

> **关于节点/边/路径导出的注释：** 这些图类型被导出为 JSON 字符串，而不是 Parquet StructArrays。这种设计选择是必要的，因为 Parquet StructArrays 要求所有行具有相同的模式，但混合类型的节点/边（例如，人员与组织）具有不同的属性，这会导致模式冲突和数据稀疏。

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
