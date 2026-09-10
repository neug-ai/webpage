export const databaseTerminologyGuide = `Use established database and property-graph terminology consistently:
- schema = 模式; graph schema = 图模式; table schema = 表模式; schema change/modification = 模式变更/模式修改. Never translate schema as 架构; use 架构 only for architecture.
- serializable isolation = 可串行化隔离; serialized execution/update path = 串行执行/串行更新路径. Use 序列化 only for data serialization.
- referential integrity = 参照完整性; transaction = 事务; autocommit = 自动提交; explicit transaction = 显式事务; savepoint = 保存点.
- checkpoint = 检查点; write-ahead log/WAL = 预写日志/WAL; snapshot = 快照; copy-on-write/COW = 写时复制/COW; MVCC remains MVCC.
- node = 节点; edge = 边; node table = 节点表; edge table = 边表; label = 标签; property = 属性; primary key = 主键.
- connection = 连接; session = 会话; embedded mode = 嵌入式模式; service mode = 服务模式.
Keep code identifiers, API names, enum/control values, command names, and string literals in code examples unchanged. In TypeScript metadata, translate only user-facing labels and preserve framework control values.`;

export function validateDatabaseTerminology(source, translated) {
  const violations = [];
  if (/\bschemas?\b/i.test(source) && !/\barchitectur(?:e|al)\b/i.test(source) && /架构/.test(translated)) {
    violations.push('translate "schema" as "模式", not "架构"');
  }
  if (/\bserializable(?:\s+isolation)?\b/i.test(source) && /可序列化/.test(translated)) {
    violations.push('translate "serializable" as "可串行化", not "可序列化"');
  }
  if (/\breferential integrity\b/i.test(source) && /引用完整性/.test(translated)) {
    violations.push('translate "referential integrity" as "参照完整性"');
  }
  if (/\bembedded mode\b/i.test(source) && /嵌入模式/.test(translated)) {
    violations.push('translate "embedded mode" as "嵌入式模式"');
  }
  if (/\bwrite-ahead (?:log|logging)\b/i.test(source) && /预写式日志/.test(translated)) {
    violations.push('translate "write-ahead log" as "预写日志"');
  }
  if (violations.length > 0) throw new Error(violations.join("; "));
}
