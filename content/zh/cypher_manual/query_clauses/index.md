# 查询子句
在本章中，我们主要介绍 NeuG 查询相关的子句操作。下表总结了这些操作的类型和一般用途：

子句 | 描述
-------|------------
[MATCH](match_clause) | 查找图模式
[WHERE](where_clause) | 基于属性进行过滤
[WITH](with_clause) | 基于属性进行投影或聚合
[RETURN](return_clause) | 输出投影或聚合结果
[ORDER](order_clause) | 进一步排序中间结果或输出结果
[SKIP](limit_clause) | 跳过结果的顶部部分，确定输出结果的下界
[LIMIT](limit_clause) | 截断结果，确定输出结果的上界
[MERGE](merge_clause) | 确保模式存在；匹配或创建
[UNION](union_clause) | 合并具有相同模式的多个分支结果
<!-- [UNWIND](unwind_clause) | 展开列表结果 -->

我们将使用 [modern 图](https://tinkerpop.apache.org/docs/current/reference/#graph-computing) 作为示例来介绍每个子句的具体作用。
<!-- 下面是与 modern 图对应的模式和数据图。 -->