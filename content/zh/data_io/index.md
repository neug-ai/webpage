# 概述

NeuG 提供了一套工具，用于在图数据库中导入和导出数据。

## 架构

NeuG 中的数据摄取管道采用分层设计：

```
External Files (CSV, JSON, Parquet, ...)
        │
        ▼
   ┌───────────┐    Schema inference, relational operations
   │ LOAD FROM │    (projection, filtering, type casting, aggregation, ...)
   └────┬──────┘
        │  Unified internal format
        ▼
   ┌───────────┐    Persist or temporarily import into graph storage
   │ COPY FROM │    (auto_detect=true by default)
   │ COPY TEMP │    (always auto-infers schema, session-scoped)
   └───────────┘
```

**`LOAD FROM`** 是数据摄取的基础。它读取外部文件，自动推断模式，并生成临时结果集。你可以直接在加载的数据上应用关系运算，例如列投影、类型转换、过滤和聚合。

**`COPY FROM`** 构建在 `LOAD FROM` 之上。它获取 `LOAD FROM` 操作的结果并将其持久化到图存储中。由于 `COPY FROM` 在内部使用 `LOAD FROM`，因此 **`LOAD FROM` 支持的任何文件格式也自动适用于 `COPY FROM`**。

**`COPY TO`** 则执行相反的操作——它将查询结果导出为外部文件格式。

## 仅嵌入式模式

> **重要：** `LOAD FROM`、`COPY FROM`、`COPY TEMP` 和 `COPY TO` **仅在嵌入式模式下**受支持。当 NeuG 以服务（HTTP/TP 模式）运行时，这些功能不可用。

批量文件 I/O 操作（`LOAD FROM`、`COPY FROM`、`COPY TO`）涉及读取或写入大型文件，这类操作耗时较长且 I/O 密集，会阻塞事务处理流水线。因此，它们仅限于嵌入式模式。服务运行后，您仍然可以通过 `CREATE` 语句插入单条记录，使用 `MERGE`/`SET`/`DELETE` 修改数据，并通过 `CREATE/DROP/ALTER TABLE` 管理模式。

## 支持的格式

| 格式 | 支持情况 | 可用性 |
| ------------ | --------- | ----------------------------------------------- |
| CSV | ✅ | 内置 |
| JSON / JSONL | ✅ | 内置 |
| Parquet | ✅ | 通过[Parquet 扩展](../extensions/load_parquet) |

> **注意：** 随着新格式扩展的开发，`LOAD FROM` 和 `COPY FROM` 会自动获得支持。详见[扩展](../extensions/index)页面。

## 下一步

**[LOAD FROM](load_data)** — 通过关系操作将外部文件读取到临时表中

* **[COPY FROM / COPY TEMP](import_data)** — 将外部数据持久化或临时导入图存储中

**[COPY TO](export_data)** — 将查询结果导出到外部文件
