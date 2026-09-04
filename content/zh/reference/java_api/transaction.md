# 事务

`Transaction` 表示由 [Session](session) 创建的一个显式事务。它将多个 Cypher 语句保留在同一个服务端事务中，直至应用程序提交或回滚该事务。

## 启动事务

`beginTransaction()` 默认启动一个读写事务：

```java
try (Session session = driver.session();
        Transaction txn = session.beginTransaction()) {
    txn.run("CREATE (:Person {id: 1, name: 'Alice'})").close();
    txn.commit();
}
```

当事务必须为只读时，请选择相应的访问模式：

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

事务的访问模式在其整个生命周期内是固定的：

- `Transaction.Mode.READ_WRITE` 允许执行读取和写入操作，为默认模式。
- `Transaction.Mode.READ_ONLY` 仅允许执行读取操作。

## 执行语句

对于无参数的语句，使用 `run(String)`；对于带参数的语句，则使用 `run(String, Map<String, Object>)`：

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

在消费完每个返回的 `ResultSet` 后，务必将其关闭。当事务处于活动状态时，应通过 `Transaction.run(...)` 执行其语句；此时所属的 `Session` 将拒绝直接调用 `Session.run(...)`，也无法启动另一个事务。

## 提交与回滚

调用 `commit()` 方法可将所有更改永久保存。如果应用程序工作失败，则应在传播错误之前调用 `rollback()`：

```java
try (Session session = driver.session();
        Transaction txn = session.beginTransaction()) {
    txn.run("CREATE (:Person {id: 1})").close();
    txn.run("CREATE (:Person {id: 2})").close();
    txn.commit();
}
```

`close()` 方法会自动回滚处于活动状态或已标记为仅回滚（rollback-only）的事务。因此，使用 try-with-resources 语句可提供一种安全的备用机制；但应用程序在成功路径上仍应显式调用 `commit()`。

## 事务状态

| 状态 | `run(...)` | `commit()` | `rollback()` | `isOpen()` |
|---|---|---|---|---|
| 活跃（Active） | 允许 | 允许 | 允许 | `true` |
| 仅回滚（Rollback-only） | 拒绝 | 拒绝 | 允许 | `true` |
| HTTP 409 后进入仅回滚状态 | 拒绝 | 拒绝 | 允许 | `true` |
| HTTP 410 后关闭 | 拒绝 | 拒绝 | 拒绝 | `false` |
| 提交/回滚后关闭 | 拒绝 | 拒绝 | 拒绝 | `false` |
| 提交或回滚结果未知 | 拒绝 | 拒绝 | 拒绝 | `false` |

执行失败的语句会使事务进入“仅回滚”状态。在重用会话前，必须先执行回滚操作。

若 `commit()` 或 `rollback()` 返回 HTTP 409，则可能仍有操作正在运行，且服务器仍保留该事务。此时事务将变为“仅回滚”状态，以便可重试回滚操作。HTTP 410 则表明该事务已过期或不再存在，因此事务被关闭，其所属会话可被重用。其他类型的 HTTP 错误则导致最终结果未知。

若在提交或回滚过程中连接失败，则服务端最终结果可能无法确定。驱动程序不会自动透明地重试请求，因为对响应已丢失的操作进行重放可能导致该操作被执行两次。此时应关闭所属会话并创建新会话；服务端事务的截止时间（deadline）将确保资源最终被回收。

## API 概述

- `ResultSet run(String statement)`：在此事务中执行一条语句。
- `ResultSet run(String statement, Map<String, Object> parameters)`：执行一条带参数的语句。
- `void commit()`：提交一个处于活动状态的事务。
- `void rollback()`：回滚一个处于活动状态或仅可回滚（rollback-only）的事务。
- `boolean isOpen()`：报告该事务是否仍可被回滚。
- `void close()`：若事务仍处于打开状态，则自动执行回滚。

`Transaction` 及其所属的 `Session` 均**不是线程安全的**。请勿通过同一个事务并发执行多个请求。

另请参阅：[Session](session)、[ResultSet](result_set)
