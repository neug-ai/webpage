# 导出数据

`COPY TO` 命令可将查询结果直接导出为 CSV、JSON 或 JSONL 文件。通过 [扩展](../extensions/index) 框架，还支持其他格式。

## 导出至 CSV

COPY TO 子句可将查询结果导出为 CSV 文件，用法如下：
```cypher
COPY (MATCH (p:Person) RETURN p.*) TO 'person.csv' (header=true);
```

该 CSV 文件包含以下字段：
```csv
p.id|p.name|p.age
1|marko|29
2|vadas|27
4|josh|32
6|peter|35
```
点、边等复杂类型将以 JSON 格式的字符串形式输出。

可用参数如下：
|参数|描述|默认值|
|---|---|---|
|`HEADER`|是否输出表头行。|`true`|
|`DELIM` 或 `DELIMITER`|CSV 中用于分隔字段的字符。|`\|`|
|`BATCH_SIZE`|单次批量写入的最大行数。|`1024`|

另一个示例如下所示。
```cypher
COPY (MATCH (:Person)-[e:KNOWS]->(:Person) RETURN e) TO 'person_knows_person.csv' (header=true);
```
这会将以下结果输出到 `person_knows_person.csv`：
```csv
e
{"_SRC":"0:0","_DST":"0:1","_SRC_LABEL":"Person","_DST_LABEL":"Person","_LABEL":"KNOWS","weight":0.5}
{"_SRC":"0:0","_DST":"0:2","_SRC_LABEL":"Person","_DST_LABEL":"Person","_LABEL":"KNOWS","weight":1.0}
```

## 复制到 JSON

内置 JSON 导出功能。您可以将查询结果导出为 JSON 或 JSONL 格式：

```cypher
COPY (MATCH (p:Person) RETURN p.*) TO 'person.json';
COPY (MATCH (p:Person) RETURN p.*) TO 'person.jsonl';
```

输出格式由文件扩展名决定：
- `.json` — JSON 数组格式（所有行位于单个数组中）
- `.jsonl` — JSON Lines 格式（每行一个 JSON 对象）

JSON 输出如下所示：

```json
[{"id": 1, "name": "marko", "age": 29},{"id": 2, "name": "vadas", "age": 27}]
```

等效的 JSONL 输出每行包含一个对象：

```jsonl
{"id": 1, "name": "marko", "age": 29}
{"id": 2, "name": "vadas", "age": 27}
```

上述常见的 `BATCH_SIZE` 选项也适用于 JSON 和 JSONL 导出。

## 其他导出格式

NeuG 正通过 [扩展](../extensions/index) 框架扩展导出功能。计划支持的导出格式包括：

- **Parquet 导出**：用于分析和数据科学工作流的高性能列式格式
- **DataFrame 集成**：直接导出到 pandas DataFrame 和其他数据科学工具

请查看 [扩展](../extensions/index) 页面了解最新的支持格式。

## 导出最佳实践

- **大型结果集**：在导出大型数据集时使用 LIMIT 子句以避免内存问题
- **数据类型**：复杂的图对象（节点/边）以 JSON 字符串形式导出以确保最大兼容性
- **文件路径**：在运行导出命令前确保目标目录存在且可写
