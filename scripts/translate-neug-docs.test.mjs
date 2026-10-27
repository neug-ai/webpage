import assert from "node:assert/strict";
import test from "node:test";

import {
  createMarkdownTranslationPlan,
  restoreMetaControlValues,
  restoreMarkdownTranslation,
  validateDatabaseTerminology,
  validateMarkdownTokens,
  segmentMarkdownSections,
} from "./translate-neug-docs.mjs";

test("protected Markdown is excluded from translation and restored byte-for-byte", () => {
  const source = `## Usage

Run \`session.run(query)\` and see [the API](https://neug.io/docs/reference/java_api/session).
See [formats](../extensions/load_parquet "Formats") and [local](#local-anchor).

\`\`\`java
try (Session session = driver.session()) {
    session.run("RETURN 1");
}
\`\`\`

<Callout type="info">Close the result after use.</Callout>`;

  const plan = createMarkdownTranslationPlan(source);
  const submittedText = Object.values(plan.fragments).join("\n");

  assert.doesNotMatch(submittedText, /session\.run\(query\)/);
  assert.doesNotMatch(submittedText, /https:\/\/neug\.io/);
  assert.doesNotMatch(submittedText, /try \(Session session/);
  assert.doesNotMatch(submittedText, /<\/?Callout/);
  assert.doesNotMatch(submittedText, /\.\.\/extensions\/load_parquet|#local-anchor/);

  const translated = Object.fromEntries(
    Object.entries(plan.fragments).map(([key, value]) => [key, value.replace(/Usage|Run|and see|the API|See|formats|and|local|Close the result after use/g, "译文")]),
  );
  const restored = restoreMarkdownTranslation(plan, translated);

  assert.match(restored, /`session\.run\(query\)`/);
  assert.match(restored, /https:\/\/neug\.io\/docs\/reference\/java_api\/session/);
  assert.match(restored, /```java[\s\S]*session\.run\("RETURN 1"\);[\s\S]*```/);
  assert.match(restored, /<Callout type="info">[\s\S]*<\/Callout>/);
  assert.ok(restored.includes('](../extensions/load_parquet "Formats")'));
  assert.ok(restored.includes("](#local-anchor)"));
});

test("Python and shell comments inside fenced code never become documentation sections", () => {
  const source = '# API\n\n```python\n# Python comment\nconn.execute("RETURN 1")\n```\n\n## Usage\n\n~~~sh\n## Shell comment\nprintf hello\n~~~\n';
  const sections = segmentMarkdownSections(source);
  assert.equal(sections.length, 2);
  assert.ok(sections[0].includes('# Python comment\nconn.execute'));
  assert.ok(sections[1].includes('## Shell comment\nprintf hello'));
});

test("context tokens avoid source collisions, stay whole at chunk boundaries, and validate markup structure", () => {
  const source = 'Literal ⟦N0⟧. See [the API](../api#open) and <b>use `true`</b>. ' + 'Long context '.repeat(30);
  const plan = createMarkdownTranslationPlan(source, 37);
  assert.equal(restoreMarkdownTranslation(plan, plan.fragments), source);
  assert.ok(Object.values(plan.fragments).every(value => value.length <= 37));
  assert.ok(Object.keys(plan.tokens).every(token => token.startsWith('⟦NN')));
  for (const token of Object.keys(plan.tokens)) {
    assert.equal(Object.values(plan.fragments).filter(value => value.includes(token)).length, 1);
  }
  const markupPlan = createMarkdownTranslationPlan('Read [API](../api) and <b>use `true`</b>.');
  assert.throws(() => validateMarkdownTokens(markupPlan, markupPlan.fragments.t0,
    '阅读 [API] ⟦N0⟧ 和 ⟦N1⟧使用 ⟦N2⟧⟦N3⟧。'), /detached/);
  assert.throws(() => validateMarkdownTokens(markupPlan, markupPlan.fragments.t0,
    '阅读 [API]⟦N0⟧ 和 ⟦N3⟧使用 ⟦N2⟧⟦N1⟧。'), /HTML tag order/);
});

test("Nextra metadata control values are restored after translation", () => {
  const source = `export default {
  docs: { type: "doc", display: "normal" },
  archived: { display: "hidden" },
  landing: { theme: { layout: "full" } },
};`;
  const translated = `export default {
  docs: { type: "文档", display: "正常" },
  archived: { display: "隐藏" },
  landing: { theme: { layout: "完整" } },
};`;

  assert.equal(restoreMetaControlValues(source, translated), source);
});

test("database terminology rejects common mistranslations", () => {
  assert.throws(
    () => validateDatabaseTerminology("Schema modifications", "架构修改"),
    /schema.*模式.*架构/i,
  );
  assert.throws(
    () => validateDatabaseTerminology("Serializable isolation", "可序列化隔离"),
    /serializable.*可串行化.*可序列化/i,
  );
  assert.throws(
    () => validateDatabaseTerminology("Referential integrity", "引用完整性"),
    /referential integrity.*参照完整性/i,
  );
  assert.throws(
    () => validateDatabaseTerminology("Embedded mode", "嵌入模式"),
    /embedded mode.*嵌入式模式/i,
  );
  assert.throws(
    () => validateDatabaseTerminology("Serialized update path", "串行化更新路径"),
    /serialized.*串行更新路径/i,
  );
  assert.throws(
    () => validateDatabaseTerminology("WAL epochs", "WAL 时期"),
    /WAL epoch.*WAL 纪元/i,
  );
  assert.throws(
    () => validateDatabaseTerminology("Active transaction", "活跃事务"),
    /active transaction.*活动事务/i,
  );
  assert.throws(
    () => validateDatabaseTerminology("Rollback-only transaction", "仅回滚事务"),
    /rollback-only.*仅可回滚/i,
  );
  assert.doesNotThrow(() => validateDatabaseTerminology("System architecture", "系统架构"));
  assert.doesNotThrow(() => validateDatabaseTerminology("Data serialization", "数据序列化"));
});
