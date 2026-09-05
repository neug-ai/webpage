# NeuG Webpage

The unified website for [NeuG](https://github.com/alibaba/neug), including the product homepage, versioned documentation, and bilingual technical blog.

Production: [https://neug.io](https://neug.io)

## Local development

Requirements:

- Node.js 20 or later
- npm 10 or later

Install dependencies and start the development server:

```bash
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). English routes are served from `/`; Simplified Chinese routes are served from `/zh/`.

Run the same checks used by CI:

```bash
npm run typecheck
npm run validate:content
npm run build
```

The production build is a static export in `out/`. To inspect it locally:

```bash
npm run serve
```

## Content layout

```text
content/en/                 English documentation
content/zh/                 Simplified Chinese documentation
content/en/blog/*.mdx       English blog posts
content/zh/blog/*.mdx       Simplified Chinese blog posts
public/images/              Documentation and blog assets
```

Every published blog post must exist in both locales with the same filename and `translationKey`. Blog frontmatter is validated by `npm run validate:content`.

## Synchronizing documentation from alibaba/neug

Documentation is synchronized incrementally from `alibaba/neug/doc/source`:

1. Publishing a release in `alibaba/neug` runs `.github/workflows/trigger-docs-sync.yml` in that repository.
2. The source workflow sends the `neug-docs-update` repository dispatch event to this repository, pinned to the released commit.
3. `.github/workflows/sync-neug-docs.yml` copies only new, changed, renamed, or removed documents and managed images.
4. New and changed English sections are translated into Simplified Chinese with Qwen.
5. The workflow creates or updates an `automation/neug-docs-*` pull request and publishes a PR preview.

Required configuration:

| Repository | Setting | Purpose |
| --- | --- | --- |
| `alibaba/neug` | Secret `WEBPAGE_DISPATCH_TOKEN` | Fine-grained token that can dispatch events to `neug-ai/webpage` |
| `neug-ai/webpage` | Secret `DASHSCOPE_API_KEY` (or `QWEN_API_KEY`) | Qwen translation credential |
| `neug-ai/webpage` | Variable `QWEN_BASE_URL` | DashScope OpenAI-compatible API base URL |
| `neug-ai/webpage` | Variable `QWEN_MODEL` | Translation model, currently `qwen3.7-plus` |
| `neug-ai/webpage` | Actions setting **Allow GitHub Actions to create and approve pull requests** | Lets synchronization workflows open their generated PRs |

For a controlled rerun, use the **Sync NeuG Documentation** workflow in GitHub Actions and provide an exact source ref when needed. To run the same synchronization locally, clone `alibaba/neug`, then provide its directory and commit:

```bash
NEUG_SOURCE_DIR=/path/to/neug \
NEUG_SOURCE_SHA=<full-commit-sha> \
NEUG_VERSION=v0.2.0 \
OPENAI_API_KEY=<dashscope-api-key> \
OPENAI_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1 \
OPENAI_MODEL=qwen3.7-plus \
npm run sync:docs
```

The command modifies tracked content in place. Review the diff and run the validation commands before committing.

## Synchronizing blog posts from neug-ai/wiki

The canonical English source for an automatically published post is:

```text
raw/blogs/<slug>/blog-en.md
raw/blogs/<slug>/banner_en.*       optional
raw/blogs/<slug>/images_en/        optional
```

The first level-one heading in `blog-en.md` becomes the post title. Relative references such as `images_en/diagram.png` are rewritten to the website image path.

Automatic flow:

1. A pull request in `neug-ai/wiki` changes exactly one `raw/blogs/<slug>/` directory and is given the `blog` label.
2. When the PR is merged into `main`, `.github/workflows/trigger-blog-sync.yml` dispatches the post to `neug-ai/webpage`.
3. `.github/workflows/sync-neug-blog.yml` checks out the exact merge commit, generates NeuG blog frontmatter, copies managed images, and translates new or changed English content into Simplified Chinese with Qwen.
4. The workflow creates or updates an `automation/neug-blog-*` pull request and publishes a PR preview.

The private repositories need two narrowly scoped credentials:

- `neug-ai/wiki` needs `WEBPAGE_DISPATCH_TOKEN`, with access to dispatch events to `neug-ai/webpage`.
- `neug-ai/webpage` needs `NEUG_WIKI_READ_TOKEN`, with read-only Contents access to `neug-ai/wiki`, so it can check out the exact source commit and its images.

The translation secret and Qwen variables live only in `neug-ai/webpage`; they do not need to be copied to `neug-ai/wiki`.

To synchronize a post manually, run the **Sync NeuG Blog Post** workflow in this repository and provide the source directory name as `slug`. For a local run:

```bash
NEUG_WIKI_SOURCE_DIR=/path/to/neug-wiki \
NEUG_WIKI_SOURCE_SHA=<full-commit-sha> \
NEUG_BLOG_SLUG=<raw-blog-directory-name> \
NEUG_BLOG_DATE=2026-09-05 \
OPENAI_API_KEY=<dashscope-api-key> \
OPENAI_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1 \
OPENAI_MODEL=qwen3.7-plus \
npm run sync:blog
```

`blog-sync.json` records the source fingerprint for each managed post. The existing 15 bilingual posts remain in the repository; mapped source posts update them in place, while newly synchronized posts are appended. Re-running an unchanged post does not call the translation API or create a content change.

## Pull request previews and deployment

Changes to application code, content, assets, build scripts, or build configuration run `.github/workflows/ci.yml`. Pull requests publish a complete static preview under GitHub Pages. Closing a pull request removes that preview.

Merging a site-affecting change into `main` builds the complete static export and lets Cloudflare deploy the production Worker. README-only and GitHub Workflow-only changes are excluded from the GitHub Actions site build; Cloudflare build-watch paths must be configured separately in the Cloudflare dashboard.
