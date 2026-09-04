# 概述

NeuG 提供了一套工具，用于在图数据库中导入和导出数据。

## 架构

NeuG 的数据摄取管道采用分层设计构建：

```
外部文件 (CSV, JSON, Parquet, ...)
        │
        ▼
   ┌───────────┐    模式推断、关系运算
   │ LOAD FROM │    (投影、过滤、类型转换、聚合等)
   └────┬──────┘
        │  统一内部格式
        ▼
   ┌───────────┐    持久化或临时导入图存储
   │ COPY FROM │    (自 v0.1.2 起默认 auto_detect=true)
   │ COPY TEMP │    (始终自动推断模式，会话级作用域)
   └───────────┘
```

**`LOAD FROM`** 是数据摄取的基础。它读取外部文件，自动推断模式，并生成一个临时结果集。您可以直接在加载的数据上应用关系运算——例如列投影、类型转换、过滤和聚合。

**`COPY FROM`** 构建于 `LOAD FROM` 之上。它获取 `LOAD FROM` 操作的结果并将其持久化到图存储中。由于 `COPY FROM` 在内部使用了 `LOAD FROM`，因此 **`LOAD FROM` 支持的任何文件格式也自动适用于 `COPY FROM`**。

**`COPY TO`** 则方向相反——它将查询结果导出为外部文件格式。

## 仅限嵌入式模式

> **重要提示：**`LOAD FROM`、`COPY FROM`、`COPY TEMP` 和 `COPY TO` **仅在嵌入式模式下支持**。当 NeuG 作为服务（HTTP/TP 模式）运行时，这些操作不可用。这是当前的限制；未来版本计划在服务模式下支持批量加载。

批量文件 I/O 操作（`LOAD FROM`、`COPY FROM`、`COPY TO`）涉及读取或写入大文件，属于耗时较长且 I/O 密集型的操作，会阻塞事务处理流水线。因此，这些操作仅限于嵌入式模式。服务启动后，您仍然可以通过 `CREATE` 语句插入单条记录，使用 `MERGE`/`SET`/`DELETE` 修改数据，并使用 `CREATE/DROP/ALTER TABLE` 管理表结构。

## 支持的格式

| 格式 | 支持情况 | 可用方式 |
| ------------ | --------- | ----------------------------------------------- |
| CSV | ✅ | 内置 |
| JSON / JSONL | ✅ | 内置（自 v0.1.2 起） |
| Parquet | ✅ | 通过 [Parquet 扩展](../extensions/load_parquet) |

> **版本说明：** 在 NeuG < 0.1.2 版本中，JSON/JSONL 支持通过 [JSON 扩展](../extensions/load_json) 提供，使用前需执行 `INSTALL json; LOAD json;`。自 NeuG >= 0.1.2 起，JSON/JSONL 已成为内置功能，无需安装或加载扩展。

> **注意：** 随着新格式扩展的开发，`LOAD FROM` 和 `COPY FROM` 将自动获得相应的支持。详情请参阅[扩展](../extensions/index)页面。

## 下一步

**[LOAD FROM](load_data)** — 通过关系操作将外部文件读取到临时表中

* **[COPY FROM / COPY TEMP](import_data)** — 将外部数据持久化或临时导入图存储中

**[COPY TO](export_data)** — 将查询结果导出到外部文件
