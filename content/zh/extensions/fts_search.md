# 全文搜索

`fts` 扩展提供针对节点字符串属性的全文索引和 BM25 排序搜索，并支持自动索引维护和持久化。

有关所有索引类型共有的语法和保证（包括检查、事务和恢复），请参阅 [存储索引](../storage_index/index.md)。

FTS 扩展支持：

- 在一个或多个 `STRING` 类型的节点属性上创建全文索引
- 单词、短语、前缀、布尔和排除查询
- 按 BM25 相关性排序的 Top-K 检索
- 支持标量过滤和图过滤
- 支持预过滤和后过滤，并提供精确的 Top-K 结果
- 在插入、更新和删除后自动维护
- 索引检查点和恢复

## 安装并加载扩展

在创建或查询 FTS 索引之前，请先安装并加载该扩展：

```cypher
INSTALL fts;
LOAD fts;
```

## 创建全文搜索索引

可以通过专用化通用的 [CREATE INDEX](../storage_index/index.md#create-an-index) 语法，在节点表的一个或多个 `STRING` 属性上创建全文搜索（FTS）索引：

```cypher
CREATE INDEX <index_name> [IF NOT EXISTS]
ON <node_table>
USING FTS (<string_property> [, <string_property> ...])
[WITH (
    tokenizer = '<tokenizer>',
    stopwords = 'english' | 'jieba' | 'none' | ['<stopword>', ...] | '<file_path>',
    jieba_mode = '<jieba_mode>',
    jieba_dict = '<dictionary_path>',
    prefix = '<prefix_lengths>'
)];
```

`WITH` 子句及其中的每个选项都是可选的。例如，以下语句使用默认选项创建一个节点表和一个全文搜索索引：

```cypher
CREATE NODE TABLE Article (
    id INT64 PRIMARY KEY,
    title STRING,
    category STRING
);

CREATE INDEX article_title_fts
ON Article
USING FTS (title);
```

在此语句中：

- `article_title_fts` 是索引名称。它必须以字母或下划线开头，并且仅包含字母、数字或下划线。
- `Article` 是包含被索引属性的节点表。
- `FTS` 选择全文索引类型。
- `title` 是要索引的 `STRING` 属性。

现有节点会在创建索引时被索引。后续的插入、更新和删除操作会自动更新其内容。

要检查或删除全文搜索索引，请使用通用的 [SHOW_INDEXES](../storage_index/index.md#inspect-indexes) 和 [DROP INDEX](../storage_index/index.md#drop-an-index) 操作。

删除属于全文搜索索引的属性会移除整个索引。例如，从 `(title, content)` 上的索引中删除 `title` 也会移除 `content` 上的索引；如果仍然需要该索引，请使用剩余属性重新创建索引。

### 在多个属性上创建全文搜索（FTS）索引

单个 FTS 索引可以覆盖多个 `STRING` 类型的属性。这对于其可搜索文本分散在多个字段（例如 `title` 和 `content`）中的文档非常有用。该索引会将所有列出属性的倒排数据统一维护在一个索引结构中。在查询时，您可以搜索任意一个已索引的属性，或搜索一组选定的已索引属性，并为每个选定的属性分别指定不同的 BM25 权重。参见[多属性搜索](#multi-property-search)。

在 `USING FTS` 子句中列出所需属性：

```cypher
CREATE NODE TABLE Article (
    id INT64 PRIMARY KEY,
    title STRING,
    category STRING,
    content STRING
);

CREATE INDEX article_text_fts
ON Article
USING FTS (title, content);
```

此处，`(title, content)` 指定了由 `article_text_fts` 索引所维护的两个属性。每个被索引的属性必须属于同一张节点表，且类型必须为 `STRING`。

### 索引选项

`WITH` 子句接受以下区分大小写的选项名称：

| 选项 | 描述 | 默认值 |
| --- | --- | --- |
| `tokenizer` | 用于将索引文本拆分为可搜索词条的分词策略 | `unicode61` |
| `stopwords` | 停用词列表：`english`、`jieba`、`none`、自定义字符串列表或文件路径 | `english` |
| `jieba_mode` | 结巴算法：`mp`、`hmm` 或 `mix`；仅在 `tokenizer = 'jieba'` 时有效 | `mix` |
| `jieba_dict` | 结巴用户词典的路径，用于补充内置词典；仅在 `tokenizer = 'jieba'` 时有效 | 无用户词典 |
| `prefix` | 前缀索引的空格分隔令牌长度，例如 `2 3` | 无前缀索引 |

### 停用词

全文搜索（FTS）索引默认会移除英文停用词。将 `stopwords` 设置为 `english` 可显式选择内置的 670 个英文停用词列表，设置为 `jieba` 可使用 cppjieba 的停用词列表，设置为 `none` 可禁用过滤，或设置为字符串列表以使用自定义停用词列表：

```cypher
CREATE INDEX english_item_fts ON Item USING FTS (text)
WITH (stopwords = 'english');

CREATE INDEX jieba_item_fts ON Item USING FTS (text)
WITH (tokenizer = 'jieba', stopwords = 'jieba');

CREATE INDEX item_text_fts ON Item USING FTS (text)
WITH (stopwords = 'none');

CREATE INDEX custom_item_fts ON Item USING FTS (text)
WITH (stopwords = ['a', 'custom']);

CREATE INDEX file_item_fts ON Item USING FTS (text)
WITH (stopwords = '/path/to/stop_words.txt');
```

停用词文件必须采用 UTF-8 编码，且每行包含一个单词。该文件仅在创建索引时读取。其内容会存储在索引检查点中，因此重新打开数据库时无需原始文件。

在索引文档和解析查询时，会一致地应用停用词。现有的索引检查点保持兼容，并被视为 `stopwords = 'none'`。

### 分词器

支持的分词器包括：

- `unicode61` 根据 Unicode 6.1 规则对文本进行分词。这是默认设置。
- `ascii` 应用 ASCII 分词规则。ASCII 范围（0-127）之外的字符被视为词元字符。
- `porter` 应用 Porter 词干提取算法，使相关的词形能够匹配到相同的词干。
- `trigram` 将每三个连续字符视为一个词元，从而支持子串匹配。
- `jieba` 使用 cppjieba 进行中文分词，并加载内置的小型词典和 HMM 模型。

`porter` 是一个分词器包装器，支持嵌套另一个分词器。它默认使用 `porter unicode61`。也可以将其配置为 `porter jieba`，在这种情况下，Jieba 会先对中英文文本进行分词，然后对英文词元应用 Porter 算法。

所有分词器均不区分大小写，且所有词元都会转换为小写。

Jieba 分词器支持三种模式：

- `mp` 选择基于词典的最可能分词结果。
- `hmm` 使用 HMM 模型识别没有词典指导的词语。
- `mix` 结合词典分词与 HMM 识别。这是 Jieba 的默认模式。

中文分词使用词典来识别词语并产生更准确的语义边界。词典必须是文本文件，其内容采用 UTF-8 编码，即使在以二进制模式读取文件时也是如此。其条目使用以下格式：

```text
word frequency part-of-speech
```

NeuG 包含一个小型词典，其中约有 110,000 个条目，由 cppjieba 的 `test/testdata/extra_dict/jieba.dict.small.utf8` 生成。较小的词典可能会遗漏常见或特定领域的术语，从而降低搜索召回率。为了改进分词效果，可以使用额外术语配置 `jieba_dict`，例如来自 cppjieba 完整词典 `dict/jieba.dict.utf8`（约 350,000 个条目）或其他兼容词典的术语。

例如：

```cypher
CREATE INDEX article_title_fts
ON Article
USING FTS (title)
WITH (
    tokenizer = 'jieba',
    jieba_mode = 'mix',
    jieba_dict = '/path/to/user.dict.utf8'
);
```

由 `jieba_dict` 指定的词典会被添加到内置小型词典中；它是对内置条目的补充而非替换。遵循 cppjieba 的用户词典格式，每行可以只包含一个词语，也可以同时包含其频率和词性。当重新打开索引时，词典路径必须仍然可用。相对路径在创建索引时会根据进程工作目录解析，并持久化为绝对路径。

有关词典格式和用法的更多详细信息，请参阅 [cppjieba README](https://github.com/yanyiwu/cppjieba/blob/master/README.md) 和 [jieba README](https://github.com/fxsjy/jieba/blob/master/README.md)。

例如，可以将 Porter 分词器与 `unicode61` 结合使用，并为两字符和三字符前缀创建前缀索引：

```cypher
CREATE INDEX article_title_fts
ON Article
USING FTS (title)
WITH (
    tokenizer = 'porter unicode61',
    prefix = '2 3'
);
```

无效的分词器、分词器参数（例如 `jieba_mode`）、前缀或不支持的设置会导致索引创建失败。所选设置无法就地更改；若要使用不同的设置，请删除并重新创建索引。

## 全文搜索

NeuG 提供两种形式的 `bm25` 函数：

- `bm25(indexed_property, query)`：在单个已建立索引的属性上执行搜索。
- `bm25([property1, property2, ...], [weight1, weight2, ...], query)`：在多个已建立索引的属性上执行搜索，并为每个属性指定权重。

在 Top-K 查询中使用 `bm25(indexed_property, query)`。BM25 得分越小，表示匹配相关性越高。全文搜索（FTS）索引默认按 BM25 得分升序返回匹配结果；典型的 Top-K 查询会显式声明该排序方式：

```cypher
MATCH (article:Article)
RETURN article.id,
       article.title,
       bm25(article.title, 'graph database') AS score
ORDER BY score ASC
LIMIT 10;
```

当 `Article.title` 上存在 FTS 索引时，该查询将同时返回匹配的节点及其 BM25 得分。

### 多属性搜索

对于包含多个属性的全文搜索（FTS）索引，需向 `bm25` 函数传入一个属性列表及对应的权重列表：

```cypher
MATCH (article:Article)
RETURN article.id,
       article.title,
       bm25(
           [article.title, article.content],
           [5.0, 1.0],
           'graph database'
       ) AS score
ORDER BY score ASC
LIMIT 10;
```

参数说明：

- **属性（Properties）**：第一个列表用于指定要搜索的已索引属性。
- **权重（Weights）**：第二个参数按位置为每个属性分配一个权重。权重越大，该属性对 BM25 排名的影响越强。除列表外，此参数也支持数组形式。
- **查询（Query）**：最后一个参数是全文查询字符串，其语法详见[查询语法](#query-syntax)。

在本例中，`title` 的权重为 `5.0`，`content` 的权重为 `1.0`。

搜索行为说明：

- 多属性索引可搜索单个已索引属性，也可搜索其任意已索引属性的组合。
- 仅传递给 `bm25` 的属性参与匹配与排序。
- 未传递给 `bm25` 的已索引属性的值将被忽略。
- 使用 `bm25(property, query)` 搜索单个属性。
- 使用 `bm25([properties], weights, query)` 搜索属性组合。

使用要求：

- 所有选定的属性必须属于同一节点变量，且均位于同一个 FTS 索引中。
- 属性列表与权重列表均不能为空，且长度必须相等。
- 每个权重值必须为数值型、正数、有限值，且不能为 `NULL`。
- 权重可以是字面量或动态参数；参见[动态查询参数](#dynamic-query-parameters)。
- 对于在单个属性上创建的 FTS 索引，应使用 `bm25(indexed_property, query)`；而多属性形式 `bm25([properties], weights, query)` 仅适用于在多个属性上创建的索引。

注意事项：

1. 若未指定 `ORDER BY`，结果默认按 BM25 分数升序排列；若未指定 `LIMIT`，则返回所有匹配结果。
2. BM25 分数支持使用 `ASC` 或 `DESC` 排序，并可配合可选的 `LIMIT` 子句。
3. `ORDER BY` 和 `LIMIT` 也可应用于其他返回列或表达式。

### 查询语法

`bm25` 的第二个参数包含一个全文查询。当以字符串字面量形式提供时，常见形式如下：

| 查询类型 | 查询字符串 | 含义 |
| --- | --- | --- |
| 单词 | `'database'` | 匹配词元 `database` |
| 多个词项 | `'graph database'` | 匹配同时包含这两个词项的文档 |
| 短语 | `'"graph database"'` | 按指定顺序匹配相邻的词项 |
| 前缀 | `'data*'` | 匹配以 `data` 开头的词元 |
| 布尔逻辑 | `'graph OR database'` | 匹配任一词项 |
| 排除 | `'graph NOT database'` | 匹配包含 `graph` 但不包含 `database` 的文档 |

在未加引号的查询词项中，若标点符号本身不合法，则必须将其包含在短语中。例如，应使用 `'"DLF-Legacy"'` 而非 `'DLF-Legacy'`。未闭合的引号、空查询以及无效的查询语法均会导致查询执行错误。可用的分词行为取决于创建索引时所选的 `tokenizer`。

### 动态查询参数

`bm25` 的第二个参数也可以是一个动态的 `STRING` 类型参数。这使得应用程序能够在每次执行时复用同一语句，但使用不同的全文检索查询：

```cypher
MATCH (article:Article)
RETURN article.id,
       article.title,
       bm25(article.title, $query) AS score
ORDER BY score ASC
LIMIT 10;
```

例如，Python API 通过 `Connection.execute` 方法传入参数值：

```python
statement = """
MATCH (article:Article)
RETURN article.id,
       article.title,
       bm25(article.title, $query) AS score
ORDER BY score ASC
LIMIT 10;
"""

result = connection.execute(
    statement,
    parameters={"query": "graph database"},
)
```

该参数在每次执行时单独绑定。它必须存在、类型为 `STRING`，且不能为 `NULL`。其值采用与字符串字面量相同的全文检索查询语法；若查询为空或语法无效，则会返回查询执行错误。

对于多属性搜索，权重列表也可作为动态参数提供：

```cypher
MATCH (article:Article)
RETURN article.id,
       bm25([article.title, article.content], $weights, $query) AS score
ORDER BY score ASC
LIMIT 10;
```

```python
statement = """
MATCH (article:Article)
RETURN article.id,
       bm25([article.title, article.content], $weights, $query) AS score
ORDER BY score ASC
LIMIT 10;
"""

result = connection.execute(
    statement,
    parameters={
        "weights": [5.0, 1.0],
        "query": "graph database",
    },
)
```

关于 `$weights`：

- 其值可作为列表（list）提供；数组（array）同样被接受。
- 它必须为每个属性提供一个对应值，且顺序需与属性顺序一致。
- 每个值必须为数值类型、为正数、为有限值，且不能为 `NULL`。
- `$weights` 和 `$query` 可独立绑定，也可联合使用。

### LIMIT 和 SKIP

与 HNSW 向量搜索不同，FTS 索引搜索不需要显式的 `ORDER BY ... LIMIT` 子句。FTS 索引默认按 BM25 分数升序返回匹配结果，因此 `LIMIT` 和 `SKIP` 可以独立使用，也可以与 `ORDER BY` 结合使用。

以下查询按默认的 BM25 顺序返回前十个匹配结果：

```cypher
MATCH (article:Article)
RETURN article.id,
       bm25(article.title, 'graph database') AS score
LIMIT 10;
```

使用不带 `LIMIT` 的 `SKIP` 以从结果开头省略匹配项：

```cypher
MATCH (article:Article)
RETURN article.id,
       bm25(article.title, 'graph database') AS score
SKIP 10;
```

`SKIP` 和 `LIMIT` 可以组合使用以选择有界的结果窗口。这两个子句都接受整数字面量、常量整数表达式和动态参数。有关其取值范围和参数规则，请参阅 [LIMIT 和 SKIP](../cypher_manual/query_clauses/limit_clause.md)。以下示例使用字面量偏移量和动态页面大小：

```cypher
MATCH (article:Article)
RETURN article.id,
       bm25(article.title, 'graph database') AS score
SKIP 10
LIMIT $page_size;
```

显式的 `ORDER BY score ASC` 记录了相关性顺序，并允许优化器将有限的上界下推到 FTS 索引扫描中：

```cypher
MATCH (article:Article)
RETURN article.id,
       bm25(article.title, $query) AS score
ORDER BY score ASC
LIMIT $result_limit;
```

显式排序也可以单独与 `SKIP` 结合使用：

```cypher
MATCH (article:Article)
RETURN article.id,
       bm25(article.title, 'graph database') AS score
ORDER BY score ASC
SKIP $row_offset;
```

对于分页排名搜索，请指定两个边界：

```cypher
MATCH (article:Article)
RETURN article.id,
       bm25(article.title, $query) AS score
ORDER BY score ASC
SKIP $row_offset
LIMIT $page_size;
```

对于上一个查询，可以通过 Python API 提供参数：

```python
statement = """
MATCH (article:Article)
RETURN article.id,
       bm25(article.title, $query) AS score
ORDER BY score ASC
SKIP $row_offset
LIMIT $page_size
"""

result = connection.execute(
    statement,
    parameters={
        "query": "graph database",
        "row_offset": 20,
        "page_size": 10,
    },
)
```

当显式的 BM25 排序具有有限上界时，NeuG 可以向 FTS 索引请求最多 `skip + limit` 个候选项，从而避免单独的排序操作。剩余的跳过操作仍会移除前 `skip` 个候选项。如果只有 `SKIP` 而没有 `LIMIT`，则不存在有限上界，因此在应用偏移量之前可能需要生成所有匹配的候选项。

## 过滤与混合搜索

NeuG 在选择最终的 Top-K 匹配结果之前，应用标量过滤器或图过滤器。
这确保了在符合条件的节点中，Top-K 行为保持正确。

### 标量过滤（Scalar Filtering）

添加 `WHERE` 谓词，以限制全文搜索（FTS）索引所搜索的候选节点：

```cypher
MATCH (article:Article)
WHERE article.category = 'database'
RETURN article.id,
       article.title,
       bm25(article.title, 'index') AS score
ORDER BY score ASC
LIMIT 10;
```

### 全文搜索后接图遍历

首先检索最相关的节点，然后继续在图中进行遍历：

```cypher
MATCH (article:Article)
WITH article, bm25(article.title, 'graph database') AS score
ORDER BY score ASC
LIMIT 10
MATCH (article)-[:CITES]->(cited:Article)
RETURN article.title, cited.title, score
ORDER BY score ASC;
```

### 图过滤后接全文搜索

现有的图模式也可为全文搜索（FTS）排序提供候选结果：

```cypher
MATCH (author:Author {name: 'Ada'})-[:WROTE]->(article:Article)
RETURN article.id,
       article.title,
       bm25(article.title, 'database') AS score
ORDER BY score ASC
LIMIT 10;
```

## 全文搜索（FTS）索引维护

插入、更新和删除操作均参与通用的[事务性索引维护](../storage_index/index.md#transactions)。例如：

```cypher
// 新建的文章可立即被全文搜索到。
CREATE (:Article {
    id: 1,
    title: '图数据库索引',
    category: 'database'
});

// 原有文本将被移除，新文本将被索引。
MATCH (article:Article)
WHERE article.id = 1
SET article.title = '全文检索';

// 删除该节点后，其将从搜索结果中移除。
MATCH (article:Article)
WHERE article.id = 1
DELETE article;
```

当前，持久化属性不支持 `NULL` 值。若尝试将 `NULL` 赋值给已建立索引的属性，则操作将失败，且不会修改该属性本身及其索引条目。

有关检查点（checkpoint）与重新打开（reopen）行为（包括加载 `fts` 以激活已恢复的索引），请参阅[持久化与恢复](../storage_index/index.md#persistence-and-recovery)。

## 当前限制

- 全文搜索（FTS）索引只能在类型为 `STRING` 的一个或多个节点属性上创建。
- `bm25` 查询参数必须是非空的 `STRING` 字面量或动态参数；目前不支持其他计算表达式。
- `bm25` 必须在由 FTS 索引支持的全文搜索查询中使用；它不能作为通用标量函数使用。
- 一个查询中只能包含一个 `bm25` 表达式。
- 传递给 `bm25` 的属性必须存在匹配的 FTS 索引。
- 如果同一属性上存在多个 FTS 索引，则该查询具有歧义，将返回错误。
