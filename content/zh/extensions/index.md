# 概述

数据库系统中的扩展框架是一种机制，允许在不修改核心引擎代码的情况下动态添加新功能。NeuG 也提供了一个扩展框架，使外部用户能够灵活加载新功能，具有以下主要优势：

- **核心引擎保持精简**：提供查询解析、优化和执行的基本功能
- **新功能作为插件开发**：提供丰富的外部扩展能力，例如外部数据导入、图算法分析等
- **降低维护复杂性**：避免核心代码膨胀，提高可读性和稳定性

## 可用扩展

以下扩展当前已支持，或计划在 NeuG 中支持：

| 类别            | 扩展                             | 描述                                                                 | 起始版本   |
| --------------- | -------------------------------- | -------------------------------------------------------------------- | ---------- |
| 数据源          | [JSON](load_json.md)                | 从 JSON 文件格式导入与导出数据（自 v0.1.2 起内置）                   | v0.1       |
| 数据源          | [PARQUET](load_parquet.md)          | 从 PARQUET 格式文件导入与导出数据                                    | v0.1.1     |
| 文件系统        | [HTTP/HTTPS/S3/OSS](load_httpfs.md) | 基于 HTTP/HTTPS/S3/OSS 协议提供数据源                                | v0.1.2     |
| 图算法          | [GDS](load_gds.md)               | 图数据科学算法（PageRank、BFS、SSSP、WCC、LCC、K-Core、标签传播、Louvain、Leiden） | v0.1.3     |
| 图查询          | [模式匹配](pattern_match.md)        | 子图模式匹配，支持精确 DAF 匹配及采样 FaSTest 匹配                    | v0.2.0     |
| 向量搜索        | [向量搜索](vector_search.md)      | 向量距离函数及基于 HNSW 的近似最近邻搜索                             | v0.2.0     |
| 搜索            | [全文搜索](fts_search.md)         | 基于 SQLite FTS5 索引的字符串属性 BM25 排序全文搜索                  | v0.2.0     |

如需在 NeuG 项目树外部（将 NeuG 作为子模块）开发自定义扩展，请参阅[开发树外扩展](develop_extension.md)。

## 使用扩展

以下部分详细介绍了如何安装和使用上面列出的扩展。

### 安装扩展

`INSTALL` 命令从 NeuG 官方仓库下载官方扩展到你的本地机器。NeuG 会根据你当前的操作系统自动下载相应的平台特定动态库。

关于本地下载路径，请注意以下几点：

- 默认情况下，扩展被下载到 `<python_wheel_install_home>/extension/<extension_name>`。
- 你可以设置 `EXTENSION_HOME` 环境变量来指定自定义下载目录。设置后，扩展将被下载到 `$EXTENSION_HOME/extension/<extension_name>`。

NeuG 会对下载的内容自动执行校验和验证，以检测可能因网络中断导致的使扩展无法使用的问题。如果校验和验证失败，下载的文件将被自动删除并返回错误。

```cypher
INSTALL <extension_name>;
```

示例：下载 PARQUET 扩展

```cypher
INSTALL PARQUET;
```

### 加载扩展

`LOAD` 命令从 `$EXTENSION_HOME/extension/<extension_name>`（如果未设置 `EXTENSION_HOME`，则从 `<python_wheel_install_home>/extension/<extension_name>`）加载动态库到当前数据库中，以便在后续查询中使用。

```cypher
LOAD <extension_name>;
```

示例：加载 PARQUET 扩展

```cypher
LOAD PARQUET;
```

### 列出扩展

使用 `CALL` 命令查看当前已加载的扩展。此命令输出扩展名称和描述。

```cypher
CALL SHOW_LOADED_EXTENSIONS() RETURN *;
```

示例输出：

| 扩展名称       | 描述                                                   |
| -------------- | ------------------------------------------------------ |
| PARQUET        | 提供读写 PARQUET 文件的函数。                          |

### 卸载扩展

`UNINSTALL` 命令从本地安装目录中删除已下载的动态库。这将从您的系统中永久删除扩展文件。

```cypher
UNINSTALL <extension_name>;
```

示例：卸载 PARQUET 扩展

```cypher
UNINSTALL PARQUET;
```

## 扩展生命周期

扩展的典型生命周期包含以下步骤：

1. **安装**：将扩展从官方仓库下载到本地系统
2. **加载**：将扩展加载到当前数据库中以供使用
3. **使用**：执行利用该扩展功能的查询
4. **卸载**：不再需要时，从本地系统中移除扩展文件
