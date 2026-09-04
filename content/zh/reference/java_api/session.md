# Session

`Session` 是 NeuG Java 驱动中的主要查询执行接口。

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

## 显式事务

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

语句执行失败会使事务进入“仅回滚”（rollback-only）状态。驱动程序在连接失败后不会自动透明地重试请求，因为重放一个响应已丢失的操作可能导致该操作被执行两次。如果提交响应丢失，则会话将结果视为未知；此时应关闭该会话并新建一个会话。`close()` 方法会对处于活动状态的事务尽力执行回滚，而服务端的绝对事务截止时间则负责最终的资源回收。

## 使用说明

- `Session` 是轻量级的，适用于短期使用
- `Session` 不是线程安全的，且最多只拥有一个显式事务
- 请使用 try-with-resources 确保其被正确关闭
- 每次调用 `run(...)` 都会返回一个 `ResultSet`，该结果集也应被关闭

另请参阅：[驱动程序（Driver）](driver)、[事务（Transaction）](transaction)、[结果集（ResultSet）](result_set)
