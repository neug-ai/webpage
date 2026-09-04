# ResultSet

`ResultSet` 提供对查询结果的前向访问。

## 常用访问模式

```java
try (Session session = driver.session()) {
    try (ResultSet rs = session.run("MATCH (n:Person) RETURN n.name AS name, n.age AS age")) {
        while (rs.next()) {
            String name = rs.getString("name");
            long age = rs.getLong("age");
            System.out.println(name + ", " + age);
        }
    }
}
```

## 类型化 Getter

Java 驱动公开常见值类型的类型化访问器：

- `getString(...)`
- `getInt(...)`
- `getLong(...)`
- `getBoolean(...)`
- `getDate(...)`
- `getTimestamp(...)`
- `getObject(...)`

## 按列索引访问

```java
try (ResultSet rs = session.run("RETURN 1 AS value")) {
    if (rs.next()) {
        long value = rs.getLong(0);
        Object raw = rs.getObject(0);
    }
}
```

## NULL 处理

```java
Object value = rs.getObject(0);
boolean wasNull = rs.wasNull();
```

## 元数据

每个结果集都会公开列名和列类型的元数据：

```java
ResultSetMetaData metaData = rs.getMetaData();
```

## PROFILE 和 EXPLAIN

Java 驱动程序还通过以下方式公开 PROFILE 或 EXPLAIN 元数据：

- `getProfileMetrics()`

### getProfileMetrics

返回详细的 PROFILE 或 EXPLAIN 指标，以 `Map<String, Object>` 形式表示：

```java
{
    "total_elapsed_ms" -> Double,
    "total_output_rows" -> Long,
    "operators" -> List<Map<String, Object>>
}
```

`operators` 中每个算子条目具有如下结构：

```java
{
    "operator_id" -> Long,
    "parent_id" -> Long,
    "operator_name" -> String,
    "elapsed_ms" -> Double,
    "output_rows" -> Long,
    "child_ids" -> List<Long>
}
```

另请参阅：[ResultSetMetaData](result_set_metadata)、[Session](session)
