# 导出数据

`COPY TO` 命令支持将查询结果直接导出为多种文件格式。目前，CSV 导出已完全支持，随着开发的进展，其他格式可通过 [扩展](../extensions/index) 框架获得。

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

## 复制为 JSON

自 NeuG v0.1.2 起，JSON 导出已成为内置功能。您可以将查询结果导出为 JSON 或 JSONL 格式：

```cypher
COPY (MATCH (p:Person) RETURN p.*) TO 'person.json';
COPY (MATCH (p:Person) RETURN p.*) TO 'person.jsonl';
```

输出格式由文件扩展名决定：
- `.json` — JSON 数组格式（所有行包含在单个数组中）
- `.jsonl` — JSON Lines 格式（每行一个 JSON 对象）

> **版本说明：** 自 v0.1.2 版本起，我们将 JSON 支持设为内置功能，因此使用前无需再安装 JSON 扩展。对于 NeuG v0.1.2 之前的版本，JSON 导出通过 JSON 扩展提供，使用前需执行 `INSTALL json; LOAD json;`。

## 其他导出格式

NeuG 正通过 [扩展](../extensions/index) 框架扩展导出功能。计划支持的导出格式包括：

- **Parquet 导出**：用于分析和数据科学工作流的高性能列式格式
- **DataFrame 集成**：直接导出到 pandas DataFrame 和其他数据科学工具

请查看 [扩展](../extensions/index) 页面了解最新的支持格式。

## 导出最佳实践

- **大型结果集**：在导出大型数据集时使用 LIMIT 子句以避免内存问题
- **数据类型**：复杂的图对象（节点/边）以 JSON 字符串形式导出以确保最大兼容性
- **文件路径**：在运行导出命令前确保目标目录存在且可写
