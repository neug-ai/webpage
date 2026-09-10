# 使用 NeuG 探索社交网络

欢迎阅读这份使用 **TinySNB**（小型社交网络基准）数据集的综合教程！本 Python 教程将指导您探索一个小型社交网络图数据库，展示图查询在社交网络分析中的强大功能。

## 什么是 TinySNB？

TinySNB 由 [Kuzu](https://kuzudb.com/) 提供用于测试目的，是一个小型社交网络数据集，模拟人、组织和电影之间的关系。它非常适合学习图数据库概念和针对合成的真实用例测试查询。

该数据集包含：
- **人物**：具有个人信息的个人（姓名、年龄、工作状态等）
- **组织**：人们学习或工作的大学和公司
- **电影**：带有评分和描述的电影
- **关系**：社交连接、工作关系、学术关联等

## 开始使用

让我们开始加载 TinySNB 数据集并探索其结构。
如果尚未安装，请先 [安装 NeuG](../../installation/installation)。

### 加载数据集

```python
import neug
import os

db_path = '/path/to/database'

if not os.path.exists(db_path):
    # 首先，将内置 TinySNB 数据集加载到新数据库
    db = neug.Database(db_path)
    db.load_builtin_dataset('tinysnb')
else:
    # 如果路径存在，直接打开数据库，无需额外加载
    db = neug.Database(db_path)

conn = db.connect()

print("TinySNB 数据集加载成功！")
```

### 探索 Schema

让我们了解社交网络中存在哪些类型的节点和关系：

```python

# 获取图的基本统计信息
result = list(conn.execute("MATCH (n) RETURN count(n) as total_nodes"))
total_nodes = result[0][0]
print(f"图中的节点总数: {total_nodes}")

# 按类型统计节点数
result = list(conn.execute("MATCH (p:Person) RETURN count(p) as people_count"))
people_count = result[0][0]
print(f"Number of people: {people_count}")

result = list(conn.execute("MATCH (o:Organisation) RETURN count(o) as org_count"))
org_count = result[0][0]
print(f"Number of organizations: {org_count}")

result = list(conn.execute("MATCH (m:Movies) RETURN count(m) as movie_count"))
movie_count = result[0][0]
print(f"Number of movies: {movie_count}")
```

## 探索社交网络中的人物

### 基本人物查询

让我们开始探索社交网络中的人物：

```python

# 获取所有人员及其基本信息
print("=== 社交网络中的人员 ===")
result = conn.execute("""
    MATCH (p:Person) 
    RETURN p.fName, p.age, p.isStudent, p.isWorker 
    ORDER BY p.age
""")

for record in result:
    name, age, is_student, is_worker = record
    status = []
    if is_student:
        status.append("学生")
    if is_worker:
        status.append("职员")
    status_str = " & ".join(status) if status else "既非学生也非职员"
    print(f"{name} (年龄 {age}): {status_str}")
```

### 过滤和条件查询

```python

# 查找所有学生
print("\n=== 我们网络中的学生 ===")
result = conn.execute("""
    MATCH (p:Person) 
    WHERE p.isStudent = true
    RETURN p.fName, p.age
    ORDER BY p.age
""")

for record in result:
    print(f"{record[0]} (年龄 {record[1]})")

# 查找在职成年人（非学生身份的在职人员）
print("\n=== 在职成年人（非学生） ===")
result = conn.execute("""
    MATCH (p:Person) 
    WHERE p.isWorker = true AND p.isStudent = false
    RETURN p.fName, p.age
    ORDER BY p.age DESC
""")

for record in result:
    print(f"{record[0]} (年龄 {record[1]})")

# 查找三十多岁的人
print("\n=== 三十多岁的人 ===")
result = conn.execute("""
    MATCH (p:Person) 
    WHERE p.age >= 30 AND p.age < 40
    RETURN p.fName, p.age
    ORDER BY p.age
""")

for record in result:
    print(f"{record[0]} 今年 {record[1]} 岁")
```

## 社交网络分析：关系

现在让我们探索人物之间的关系——这是图数据库真正发挥作用的地方！

### 谁认识谁？

```python

# 探索“认识”关系
print("=== 社交关系（谁认识谁） ===")
result = conn.execute("""
    MATCH (p1:Person)-[k:KNOWS]->(p2:Person)
    RETURN p1.fName, p2.fName, k.date
    ORDER BY p1.fName, p2.fName
""")

for record in result:
    print(f"{record[0]} 认识 {record[1]}（自 {record[2]} 起）")
```

### 查找热门人物

```python

# 谁的连接数最多？
print("\n=== 连接数最多的人 ===")
result = conn.execute("""
    MATCH (p:Person)-[k:KNOWS]->(friend:Person)
    RETURN p.fName, count(friend) as friend_count
    ORDER BY friend_count DESC
    LIMIT 5
""")

for record in result:
    print(f"{record[0]} 认识 {record[1]} 个人")

# 谁被最多人认识？
print("\n=== 最知名人物（被他人认识） ===")
result = conn.execute("""
    MATCH (p:Person)<-[k:KNOWS]-(friend:Person)
    RETURN p.fName, count(friend) as known_by_count
    ORDER BY known_by_count DESC
    LIMIT 5
""")

for record in result:
    print(f"{record[0]} 被 {record[1]} 个人认识")
```

### 相互连接

```python
print("\n=== 互为好友 ===")
result = conn.execute("""
    MATCH (p1:Person)-[k1:KNOWS]->(p2:Person),
          (p2:Person)-[k2:KNOWS]->(p1:Person)
    WHERE p1.id < p2.id  // 避免重复
    RETURN p1.fName, p2.fName
    ORDER BY p1.fName
""")

for record in result:
    print(f"{record[0]} 和 {record[1]} 互相认识")
```

## 职业网络：工作和教育

### 学术连接

```python

# 谁在哪里就读？
print("=== 学术背景 ===")
result = conn.execute("""
    MATCH (p:Person)-[s:STUDY_AT]->(o:Organisation)
    RETURN p.fName, o.name, s.year
    ORDER BY s.year DESC
""")

for record in result:
    print(f"{record[0]} 于 {record[2]} 年就读于 {record[1]}")

# 哪些机构的学生最多？
print("\n=== 最受欢迎的教育机构 ===")
result = conn.execute("""
    MATCH (p:Person)-[s:STUDY_AT]->(o:Organisation)
    RETURN o.name, count(p) as student_count
    ORDER BY student_count DESC
""")

for record in result:
    print(f"{record[0]}: {record[1]} 名学生")
```

### 职业连接

```python

# 谁在哪里工作？
print("\n=== 职业履历 ===")
result = conn.execute("""
    MATCH (p:Person)-[w:WORK_AT]->(o:Organisation)
    RETURN p.fName, o.name, w.year, w.rating
    ORDER BY w.year DESC
""")

for record in result:
    rating = record[3] if record[3] else "N/A"
    print(f"{record[0]} 就职于 {record[1]}（自 {record[2]} 年起，评分：{rating}）")
```

## 高级模式匹配

### 多跳关系

```python

# 查找朋友的朋友（2度连接）
print("=== 朋友的朋友（2度连接） ===")
result = conn.execute("""
    MATCH (p1:Person)-[:KNOWS]->(mutual:Person)-[:KNOWS]->(p2:Person)
    WHERE p1.id <> p2.id  // 不同的人
    AND NOT (p1)-[:KNOWS]-(p2)  // 非直接朋友
    RETURN p1.fName, p2.fName, mutual.fName
    ORDER BY p1.fName
""")

for record in result:
    print(f"{record[0]} 可以通过 {record[2]} 结识 {record[1]}")
```

### 同事和同学

```python

# 查找在同一组织工作的人员
print("\n=== 同事（在同一组织工作的人员） ===")
result = conn.execute("""
    MATCH (p1:Person)-[:WORK_AT]->(o:Organisation)<-[:WORK_AT]-(p2:Person)
    WHERE p1.id < p2.id  // 避免重复
    RETURN p1.fName, p2.fName, o.name
    ORDER BY o.name
""")

for record in result:
    print(f"{record[0]} 和 {record[1]} 共同在 {record[2]} 工作")

# 查找在同一机构学习过的人
print("\n=== 校友/同学（在同一机构学习过的人） ===")
result = conn.execute("""
    MATCH (p1:Person)-[s1:STUDY_AT]->(o:Organisation)<-[s2:STUDY_AT]-(p2:Person)
    WHERE p1.id < p2.id
    RETURN p1.fName, p2.fName, o.name, s1.year, s2.year
    ORDER BY o.name
""")

for record in result:
    if record[3] == record[4]:
        print(f"{record[0]} 和 {record[1]} 是 {record[2]} {record[3]} 年的同学")
    else:
        print(f"{record[0]} 和 {record[1]} 都曾在 {record[2]} 就读（分别在 {record[3]} 年和 {record[4]} 年）")
```

## 社交网络分析

### 网络密度和连通性

```python

# 计算基本网络指标
print("=== 网络统计 ===")

# 总可能连接数与实际连接数
result = list(conn.execute("MATCH (p:Person) RETURN count(p) as person_count"))
person_count = result[0][0]

result = list(conn.execute("MATCH ()-[k:KNOWS]->() RETURN count(k) as connections"))
actual_connections = result[0][0]

max_possible = person_count * (person_count - 1)  # 有向图
density = (actual_connections / max_possible) * 100 if max_possible > 0 else 0

print(f"网络中的人数: {person_count}")
print(f"实际连接数: {actual_connections}")
print(f"最大可能连接数: {max_possible}")
print(f"网络密度: {density:.2f}%")
```

### 识别网络枢纽

```python

# 查找连接最广泛的个体（网络枢纽）
print("\n=== 网络枢纽（连接最广泛的个体） ===")
result = conn.execute("""
    MATCH (p:Person)
    OPTIONAL MATCH (p)-[out:KNOWS]->()
    OPTIONAL MATCH (p)<-[i:KNOWS]-()
    RETURN p.fName, 
           count(DISTINCT out) as outgoing,
           count(DISTINCT i) as incoming,
           count(DISTINCT out) + count(DISTINCT i) as total_connections
    ORDER BY total_connections DESC
    LIMIT 5
""")

for record in result:
    print(f"{record[0]}: 共 {record[3]} 个连接（{record[1]} 个出向，{record[2]} 个入向）")
```

### 基于年龄的社交分析

```python

# 按年龄段分析社交关系
print("\n=== 各年龄段的社交关系 ===")
result = conn.execute("""
    MATCH (p1:Person)-[:KNOWS]->(p2:Person)
    WITH p1, p2,
         CASE 
             WHEN p1.age < 25 THEN "青年 (< 25)"
             WHEN p1.age < 35 THEN "成年 (25-34)" 
             WHEN p1.age < 50 THEN "中年 (35-49)"
             ELSE "老年 (50+)"
         END as age_group1,
         CASE 
             WHEN p2.age < 25 THEN "青年 (< 25)"
             WHEN p2.age < 35 THEN "成年 (25-34)"
             WHEN p2.age < 50 THEN "中年 (35-49)" 
             ELSE "老年 (50+)"
         END as age_group2
    RETURN age_group1, age_group2, count(*) as connection_count
    ORDER BY connection_count DESC
""")

for record in result:
    print(f"{record[0]} → {record[1]}: {record[2]} 个连接")
```

## 总结

在本教程中，您学会了如何：

1. **加载内置数据集** 使用 NeuG 的数据集功能
2. **探索图 schema** 并理解数据结构
3. **执行基本查询** 查找和过滤节点
4. **分析关系** 图中的实体之间的关系
5. **使用模式匹配** 查找复杂的关系和路径
6. **计算网络指标** 理解社交网络属性
7. **组合多种关系类型** 从相互连接的数据中获取洞察

### 关键要点

- **图数据库擅长关系查询**：查找"朋友的朋友"或"既是同事又是朋友"这类模式既自然又高效
- **模式匹配很强大**：SQL 中需要多次连接的复杂查询在图中变得直观
- **社交网络分析**：图数据库为分析网络结构、连通性和影响力提供内置支持

### 下一步

继续您的 NeuG 之旅：

1. **尝试加载自己的数据**：使用您学到的 schema 模式建模自己的关系
2. **探索更大的数据集**：在更大的社交网络上测试查询
3. **学习高级 Cypher**：深入了解聚合、路径算法和图分析
4. **性能优化**：了解更大图的索引和查询优化

### 清理

别忘了清理资源：

```python

# 关闭连接和数据库
conn.close()
db.close()
```

祝您使用 NeuG 愉快！🚀
