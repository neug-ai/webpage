import assert from "node:assert/strict";
import test from "node:test";

import {
  createMarkdownTranslationPlan,
  restoreMetaControlValues,
  restoreMarkdownTranslation,
  validateDatabaseTerminology,
} from "./translate-neug-docs.mjs";

test("protected Markdown is excluded from translation and restored byte-for-byte", () => {
  const source = `## Usage

Run \`session.run(query)\` and see [the API](https://neug.io/docs/reference/java_api/session).

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

  const translated = Object.fromEntries(
    Object.keys(plan.fragments).map((key) => [key, `译文-${key}`]),
  );
  const restored = restoreMarkdownTranslation(plan, translated);

  assert.match(restored, /`session\.run\(query\)`/);
  assert.match(restored, /https:\/\/neug\.io\/docs\/reference\/java_api\/session/);
  assert.match(restored, /```java[\s\S]*session\.run\("RETURN 1"\);[\s\S]*```/);
  assert.match(restored, /<Callout type="info">[\s\S]*<\/Callout>/);
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
  assert.doesNotThrow(() => validateDatabaseTerminology("System architecture", "系统架构"));
  assert.doesNotThrow(() => validateDatabaseTerminology("Data serialization", "数据序列化"));
});
