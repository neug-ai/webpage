# ResultSetMetaData

`ResultSetMetaData` 描述查询返回的列。

与面向 JDBC 的 API 不同，NeuG 返回原生驱动 `Types` 而非 SQL 类型代码。

## 示例

```java
ResultSetMetaData metaData = rs.getMetaData();
String columnName = metaData.getColumnName(0);
Types columnType = metaData.getColumnType(0);
String typeName = metaData.getColumnTypeName(0);
```

## 常用方法

- `getColumnCount(int)`
- `getColumnName(int)`
- `getColumnType(int)`
- `getColumnTypeName(int)`
- `isNullable(int)`
- `isSigned(int)`

## 为什么使用原生类型

NeuG Java 驱动不是作为 JDBC 包装器设计的。返回原生 `Types` 使得：

- 保留 NeuG 特定的类型信息
- 避免有损的 JDBC 映射
- 在元数据之上构建驱动原生抽象

## 示例分发

```java
Types type = rs.getMetaData().getColumnType(0);
if (type == Types.INT64) {
    long value = rs.getLong(0);
}
```

另请参阅：[ResultSet](result_set)