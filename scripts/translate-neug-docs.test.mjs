import assert from "node:assert/strict";
import test from "node:test";

import {
  createMarkdownTranslationPlan,
  restoreMarkdownTranslation,
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
