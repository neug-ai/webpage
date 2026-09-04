# NodeJS API 参考

NeuG NodeJS API 提供了高性能的原生 JavaScript 接口，用于与 NeuG 图数据库进行交互。该接口基于 N-API 构建，可实现与 Node.js 应用的无缝集成。

## 概述

NodeJS API 提供了一种简单而强大的方式，用于：

- **连接数据库**：打开本地或内存中的 NeuG 数据库
- **执行查询**：运行 Cypher 查询并自动解析结果
- **管理事务**：处理 ACID 事务以确保数据一致性
- **处理结果**：使用熟悉的 JavaScript 模式处理图数据

> **注意：** Node.js 绑定目前仅支持[**嵌入模式**](../../overview/introduction)。服务模式（HTTP 服务器）不可用——它需要 C++ HTTP 服务器组件，而该组件未通过 N-API 绑定暴露。如果您需要服务模式，请使用 [Python 绑定](../python_api) 或 [C++ API](../cpp_api)。

## 核心类

- **[Database](database)** - NeuG 数据库的主入口
- **[Connection](connection)** - 表示与数据库的逻辑连接
- **[QueryResult](query_result)** - 表示 Cypher 查询的结果

## 快速入门

### 安装

```bash
npm install @graphscope-neug/neug
```

### 基本用法

```javascript
const { Database } = require('@graphscope-neug/neug');

// 连接数据库
const db = new Database({ databasePath: '/path/to/database', mode: 'w' });
const conn = db.connect();

// 执行简单查询
const result = conn.execute('MATCH (n) RETURN n LIMIT 10');

// 处理结果
for (const record of result) {
  const node = record['n'];
  console.log(`Node ID: ${node.id}, Labels: ${node.labels}`);
}

// 关闭连接
conn.close();
db.close();
```

### 内存数据库

```javascript
const { Database } = require('@graphscope-neug/neug');

// 打开一个内存数据库
const db = new Database({ databasePath: '', mode: 'w' });
const conn = db.connect();

conn.execute('CREATE NODE TABLE Person(id INT64, name STRING, age INT32, PRIMARY KEY(id));');
conn.execute("CREATE (p:Person {id: 1, name: 'Alice', age: 30});");

const result = conn.execute('MATCH (p:Person) RETURN p.id, p.name, p.age;');
for (const row of result) {
  console.log(`id=${row[0]}, name=${row[1]}, age=${row[2]}`);
}

conn.close();
db.close();
```

## 高级功能

### 访问模式

`execute` 方法接受一个可选的访问模式，用于提示查询类型：

```javascript
// 指定查询的访问模式
const result = conn.execute(
  'MATCH (p:Person) RETURN p.name, p.age',
  'read'
);
```

支持的模式：`'read'`/`'r'`、`'insert'`/`'i'`、`'update'`/`'u'`、`'schema'`/`'s'`。

### 参数化查询

```javascript
// 安全的参数传递
const result = conn.execute(
  'MATCH (p:Person) WHERE p.age > $min_age RETURN p.name, p.age',
  'read',
  { min_age: 25 }
);
```

## 错误处理

```javascript
try {
  const result = conn.execute('INVALID CYPHER QUERY');
} catch (e) {
  console.error(`Query error: ${e.message}`);
}
```
