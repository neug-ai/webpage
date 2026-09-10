# UNION 子句

NeuG 中的 UNION 操作符用于将多个子查询的结果合并为一个结果集。所有参与的子查询必须产生一致的输出 schema——即相同的列数，以及匹配的名称和数据类型。

目前，NeuG 支持 `UNION ALL` 变体，它连接结果而不执行去重。有两种语法形式可用：
- **标准 Union**：类似于 [Kùzu](https://docs.kuzudb.com/cypher/query-clauses/union/) 中的标准语法。
- **Call Union**：一种受 [Neo4j](https://neo4j.com/docs/cypher-manual/current/subqueries/call-subquery/#call-post-union) 启发的扩展形式，支持更灵活的查询组合。

## 标准 Union

在标准用法中，`UNION ALL` 用于合并多个子查询的输出。union 必须作为终端操作符，合并所有前面分支的输出。

```cypher
MATCH (n {name: 'marko'}) RETURN n.age
UNION ALL
MATCH (n {name: 'josh'}) RETURN n.age;
```

## Call Union

受 [Neo4j](https://neo4j.com/docs/cypher-manual/current/subqueries/call-subquery/#call-post-union) 启发，NeuG 通过带有参数化输入的 `CALL {}` 块扩展了 union 语义，从而实现更具表达力且模块化的查询组合。该结构允许：
- 在 union 之后执行额外的逻辑。
- 在 union 分支之间共享预计算的上下文（例如，绑定变量）。

示例：
```cypher
MATCH (person:Person {id: 123})
WITH person
CALL (person) {
  MATCH (person)-[k:KNOWS]->(friend)
  WHERE k.weight > 1.0
  RETURN friend

  UNION ALL

  MATCH (person)-[k:KNOWS]->(friend)
  WHERE k.weight < 1.0
  RETURN friend
}
RETURN friend.id, friend.name

```

该查询可分解为三个阶段：
- **PreQuery**：在 `CALL {}` 块之前执行（例如，MATCH (person)），生成将在 union 子查询间共享的预计算上下文。
- **Union Subqueries**：在 `CALL {}` 块内定义。每个分支都可以访问共享上下文（例如，person）。
- **PostQuery**：在 `CALL {}` 之后执行，消费统一的结果集（例如，RETURN friend.id, friend.name）。

`CALL (person)` 语法将外部变量注入到 union 作用域中，使每个子查询都能访问并操作共享上下文。当对同一输入实体应用多种过滤或遍历策略时，这种模式尤为有用。
