# 会话

`Session` 是 NeuG Java 驱动程序中的主要查询执行接口。它可以
执行单条语句或拥有一个显式的 `Transaction` 跨越
多个 HTTP 请求。

## 职责

- 执行 Cypher 语句
- 发送查询参数
- 在需要时选择访问模式
- 返回 `ResultSet` 对象，以支持逐行读取结果
- 在多个 HTTP 请求间维护一个显式事务

## 基本查询执行

```java
try (Session session = driver.session();
        ResultSet rs = session.run("RETURN 1 AS value")) {
    while (rs.next()) {
        System.out.println(rs.getLong("value"));
    }
}
```

## 参数化查询

```java
import java.util.Map;

try (Session session = driver.session()) {
    try (ResultSet rs = session.run(
            "MATCH (n) WHERE n.name = $name RETURN n.age AS age",
            Map.of("name", "marko"))) {
        while (rs.next()) {
            System.out.println(rs.getLong("age"));
        }
    }
}
```

## 访问模式

```java
import com.alibaba.neug.driver.utils.AccessMode;
import java.util.Map;

try (Session session = driver.session();
        ResultSet rs = session.run(
                "MATCH (n) WHERE n.age > $age RETURN n",
                Map.of("age", 30),
                AccessMode.READ)) {
    while (rs.next()) {
        System.out.println(rs.getObject("n"));
    }
}
```

## 交易

```java
try (Session session = driver.session();
        Transaction txn = session.beginTransaction()) {
    try {
        txn.run("CREATE (:Person {id: 1, name: 'Alice'})").close();
        try (ResultSet rs = txn.run(
                "MATCH (n:Person {id: 1}) RETURN n.name AS name")) {
            while (rs.next()) {
                System.out.println(rs.getString("name"));
            }
        }
        txn.commit();
    } catch (RuntimeException e) {
        if (txn.isOpen()) {
            txn.rollback();
        }
        throw e;
    }
}
```

### 只读事务

`beginTransaction()` 默认启动读写事务。当整个事务必须为只读时，请选择一种
访问模式：

```java
try (Session session = driver.session();
        Transaction txn =
                session.beginTransaction(Transaction.Mode.READ_ONLY);
        ResultSet result = txn.run("MATCH (n:Person) RETURN count(n) AS count")) {
    if (result.next()) {
        System.out.println(result.getLong("count"));
    }
    txn.commit();
}
```

该模式在事务的整个生命周期内保持不变：

- `Transaction.Mode.READ_WRITE` 允许读写，且为默认设置。
- `Transaction.Mode.READ_ONLY` 仅允许读操作。

### 参数化事务语句

使用 `Transaction.run(String)` 用于无参数语句，或
`Transaction.run(String, Map<String, Object>)` 用于参数化语句：

```java
try (Session session = driver.session();
        Transaction txn = session.beginTransaction()) {
    txn.run(
            "CREATE (:Person {id: $id, name: $name})",
            Map.of("id", 1, "name", "Alice"))
        .close();

    try (ResultSet result = txn.run(
            "MATCH (n:Person {id: $id}) RETURN n.name AS name",
            Map.of("id", 1))) {
        while (result.next()) {
            System.out.println(result.getString("name"));
        }
    }

    txn.commit();
}
```

关闭每个返回的 `ResultSet` 使用后。当事务处于
活动状态时，通过 `Transaction.run(...)`；所属的
`Session` 拒绝直接 `Session.run(...)` 调用，且无法启动另一个
事务。

### 提交、回滚和状态

调用 `commit()` 以使所有更改永久生效。调用 `rollback()` 当
应用程序工作失败时。关闭活动或仅可回滚的事务会自动
将其回滚，因此 try-with-resources 提供了安全的后备方案。

| 状态 | `run(...)` | `commit()` | `rollback()` | `isOpen()` |
|---|---|---|---|---|
| 活动 | 允许 | 允许 | 允许 | `true` |
| 仅可回滚 | 拒绝 | 拒绝 | 允许 | `true` |
| HTTP 409 后仅可回滚 | 拒绝 | 拒绝 | 允许 | `true` |
| HTTP 410 后关闭 | 拒绝 | 拒绝 | 拒绝 | `false` |
| 提交/回滚后关闭 | 拒绝 | 拒绝 | 拒绝 | `false` |
| 提交或回滚结果未知 | 拒绝 | 拒绝 | 拒绝 | `false` |

语句失败会使事务变为仅可回滚状态。在
重用会话之前将其回滚。如果提交或回滚返回 HTTP 409，则操作可能
仍在运行，可以重试回滚。HTTP 410 确认
事务已过期或不再存在。

驱动程序在连接失败后不会透明地重试，因为
重放响应丢失的操作可能会执行两次。如果
提交结果未知，请关闭所属会话并创建一个新会话。服务器端
事务截止时间提供最终的资源回收。

### 事务 API

- `ResultSet run(String statement)` 在此事务中执行一条语句。
- `ResultSet run(String statement, Map<String, Object> parameters)` 执行参数化语句。
- `void commit()` 提交活动事务。
- `void rollback()` 回滚活动或仅可回滚的事务。
- `boolean isOpen()` 报告事务是否仍可回滚。
- `void close()` 在事务仍处于打开状态时自动回滚。

## 使用说明

- `Session` 是轻量级的，适用于短期使用
- 会话不是线程安全的，且最多拥有一个显式事务
- 使用 try-with-resources 以确保其妥善关闭
- 每个 `run(...)` 调用会返回一个 `ResultSet` ，它也应被关闭

另请参阅：[Driver](driver.md), [ResultSet](result_set.md)
