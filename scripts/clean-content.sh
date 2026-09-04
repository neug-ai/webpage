#!/bin/bash

# 清理 content 目录中不应该被 Nextra 处理的文件
# 运行方式: ./scripts/clean-content.sh

CONTENT_DIR="./content"

echo "🧹 Cleaning content directory..."

# 需要删除的文件模式
PATTERNS=(
  "Doxyfile"
  "*.py"
  "*.sh"
  "*.json"
  "*.yaml"
  "*.yml"
  "*.toml"
  "*.txt"
  "*.rst"
  "*.html"
  "*.css"
  "*.js"
  "*.conf"
  "Makefile"
  "*.make"
  "requirements*.txt"
  ".gitignore"
  ".gitkeep"
  "*.pyc"
  "__pycache__"
  "*.ipynb"
)

# 需要保留的文件扩展名
# .md, .mdx, .ts (for _meta.ts), .png, .jpg, .jpeg, .gif, .svg, .webp

deleted_count=0

for pattern in "${PATTERNS[@]}"; do
  # 查找并删除匹配的文件
  while IFS= read -r -d '' file; do
    if [[ -f "$file" ]]; then
      echo "  ❌ Removing: $file"
      rm "$file"
      ((deleted_count++))
    elif [[ -d "$file" ]]; then
      echo "  ❌ Removing directory: $file"
      rm -rf "$file"
      ((deleted_count++))
    fi
  done < <(find "$CONTENT_DIR" -name "$pattern" -print0 2>/dev/null)
done

# 删除空目录
find "$CONTENT_DIR" -type d -empty -delete 2>/dev/null

echo ""
echo "✅ Cleanup complete! Removed $deleted_count items."
