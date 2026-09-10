# DML 语句

DML（数据操作语言）提供图数据库中数据插入、删除和修改的操作。NeuG 支持批量数据操作（如 COPY FROM）和单独数据操作（如 CREATE、SET 和 DELETE）。本文档为每种操作类型提供示例和说明。

## COPY FROM

COPY FROM 命令允许从外部数据源批量加载数据，并在图存储中构建节点和边。
更多详情请参阅 [导入数据](../../data_io/import_data)。

### 加载节点数据

从 CSV 文件加载 person 节点数据。CSV 中的每行映射为一个节点，列对应 person schema 中定义的节点属性。

**person.csv:**
```
name,age
marko,39
vadas,27
josh,32
peter,35
```

**命令:**
```cypher
COPY person FROM "person.csv"
```

### 加载边数据

从 CSV 文件加载 knows 边数据。前两列指定源节点和目标节点的主键，额外列定义边属性。

**knows.csv:**
```
src_name,dst_name,weight
marko,josh,1.0
marko,vadas,0.5
josh,peter,0.8
```

**命令:**
```cypher
COPY knows FROM "knows.csv"
```

## CREATE

CREATE 子句用于向图中插入新节点和边。

### 创建节点

创建具有指定属性的新节点。如果已存在相同主键的节点，将报错。

```cypher
CREATE (a:person {name: 'taylor', age: 25}), (b:person {name: 'julie', age: 30})
```

### 创建节点和边

在单个语句中创建节点和边。这在需要同时创建节点及其之间的边时很有用。

```cypher
CREATE (a:person {name: 'mars', age: 28})-[:knows {weight: 16.0}]->(b:person {name: 'jennie', age: 26})
```

### 创建数组属性

固定大小的数组属性使用方括号字面量表示。值的长度必须与模式声明相匹配。

```cypher
CREATE NODE TABLE Sensor(id INT64, readings INT32[3], PRIMARY KEY(id));

CREATE (s:Sensor {id: 1, readings: [10, 20, 30]});
```

### 在现有节点之间创建边

首先匹配现有节点，然后在它们之间创建边。

```cypher
MATCH (a:person {name: 'taylor'}), (b:person {name: 'julie'})
CREATE (a)-[:knows {weight: 20.0}]->(b)
```

## SET

SET 子句用于更新现有节点和边的属性。

### 更新节点属性

更新特定节点的属性。

```cypher
MATCH (a:Person)
WHERE a.name = 'marko'
SET a.age = 37, a.city = 'New York'
RETURN a.*
```

数组类型的属性可使用另一个固定大小的数组值进行更新：

```cypher
MATCH (s:Sensor)
WHERE s.id = 1
SET s.readings = [30, 40, 50]
RETURN s.readings
```

### 更新边属性

更新特定边的属性。

```cypher
MATCH (a:Person)-[k:KNOWS]->(b:Person)
WHERE a.name = 'marko' AND b.name = 'josh'
SET k.weight = 10.0, k.since = '2023-01-01'
RETURN k.*
```

## DELETE

DELETE 子句用于从图中删除节点和边。

### 删除节点

从图中删除一个节点。默认情况下，只能删除没有关联边的节点，以避免产生悬空边。

```cypher
MATCH (a:Person)
WHERE a.name = 'marko'
DELETE a
```

### 删除带有边的节点 (DETACH DELETE)

使用 DETACH DELETE 可强制删除节点及其所有关联的边。这可以避免在删除存在关联边的节点时引发错误。

```cypher
MATCH (a:Person)
WHERE a.name = 'marko'
DETACH DELETE a
```

### 删除边

删除节点间的特定边，同时保留节点。

```cypher
MATCH (a:Person)-[k:KNOWS]->(b:Person)
WHERE a.name = 'marko' AND b.name = 'josh'
DELETE k
```
