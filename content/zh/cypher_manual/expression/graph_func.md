# 图模式函数

除了前面介绍的各种基于关系数据的函数操作外，NeuG 还特别支持一组用于操作由图模式生成的节点、边和路径数据的函数。

## 节点函数

函数 | 描述 | 示例
---------|-------------|--------
ID() | 获取节点/边的内部 ID | MATCH (a) RETURN ID(a)
LABEL()/LABELS() | 获取节点/边的标签 | MATCH (a) RETURN LABEL(a)

## 边函数

除了 ID 和 LABEL 函数外，还有以下基于边的函数操作：

| 函数 | 描述 | 示例 |
|------|------|------|
| START_NODE() | 返回边数据的起始节点 | MATCH ()-[b]->() RETURN START_NODE(b); |
| END_NODE() | 返回边数据的结束节点 | MATCH ()-[b]->() RETURN END_NODE(b); |

## 重复路径函数

函数 | 描述 | 示例
---------|-------------|--------
NODES | 返回路径中的所有节点 | MATCH (a)-[b*2..3]->() RETURN NODES(b);
RELS | 返回路径中的所有边 | MATCH (a)-[b*2..3]->() RETURN RELS(b);
PROPERTIES | 返回节点/边的指定属性 | MATCH (a)-[b*2..3]->() RETURN PROPERTIES(nodes(b), 'name'), PROPERTIES(rels(b), 'weight');
IS_TRAIL | 检查路径是否包含重复边（若无重复则返回 `true`） | MATCH (a)-[b*2..3]->() RETURN IS_TRAIL(b);
IS_ACYCLIC | 检查路径是否包含重复节点（若无重复则返回 `true`） | MATCH (a)-[b*2..3]->() RETURN IS_ACYCLIC(b);
LENGTH | 返回路径的长度 | MATCH (a)-[b*2..3]->() RETURN LENGTH(b);
