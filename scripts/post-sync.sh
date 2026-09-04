#!/bin/bash

# Post-sync script: Process synced docs to fix images and links
# Run this after syncing docs from NeuG source

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
CONTENT_DIR="$ROOT_DIR/content"
PUBLIC_DIR="$ROOT_DIR/public"
SOURCE_REPO="$ROOT_DIR/.temp-source-repo"

echo "🔄 Post-sync processing..."

# =============================================================================
# 1. Extract version info
# =============================================================================
# v0.1.2+ uses NEUG_VERSION at repo root; older releases used tools/python_bind/VERSION.
VERSION_FILE=""
if [[ -f "$SOURCE_REPO/NEUG_VERSION" ]]; then
    VERSION_FILE="$SOURCE_REPO/NEUG_VERSION"
elif [[ -f "$SOURCE_REPO/tools/python_bind/VERSION" ]]; then
    VERSION_FILE="$SOURCE_REPO/tools/python_bind/VERSION"
fi

if [[ -n "$VERSION_FILE" ]]; then
    VERSION="v$(cat "$VERSION_FILE" | tr -d '[:space:]')"
    echo "📦 NeuG version: $VERSION (from $VERSION_FILE)"
    
    # Update version info file
    COMMIT=$(cd "$SOURCE_REPO" && git rev-parse --short HEAD 2>/dev/null || echo "unknown")
    RELEASE_DATE=$(date -u +"%Y-%m-%d")
    
    cat > "$ROOT_DIR/version-info.json" << EOF
{
  "version": "$VERSION",
  "commit": "$COMMIT",
  "syncedAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
}
EOF

    # Update versions.json with current version
    if [[ -f "$ROOT_DIR/versions.json" ]]; then
        node -e "
            const fs = require('fs');
            const data = JSON.parse(fs.readFileSync('$ROOT_DIR/versions.json', 'utf-8'));
            data.current = '$VERSION';
            
            // Add a version entry only when synchronizing a new release
            const existingIdx = data.versions.findIndex(v => v.version === '$VERSION');
            if (existingIdx < 0) {
                // Mark all as not latest
                data.versions.forEach(v => { v.isLatest = false; v.label = v.version; });
                // Add new version as latest
                data.versions.unshift({
                    version: '$VERSION',
                    label: '$VERSION (Latest)',
                    isLatest: true,
                    releaseDate: '$RELEASE_DATE'
                });
            }
            
            fs.writeFileSync('$ROOT_DIR/versions.json', JSON.stringify(data, null, 2));
        "
        echo "✅ Updated versions.json"
    fi
    
    echo "✅ Version info saved to version-info.json"
fi

# =============================================================================
# 1.5 Remove Sphinx/Doxygen artifacts that don't belong in Nextra
# =============================================================================
echo ""
echo "🧹 Removing Sphinx/Doxygen artifacts..."

find "$CONTENT_DIR" -type d \( -name "_scripts" -o -name "_static" -o -name "_templates" \) -exec rm -rf {} + 2>/dev/null || true
find "$CONTENT_DIR" -type f \( -name "*.rst" -o -name "conf.py" -o -name "Doxyfile" -o -name "sphinx_ext.py" \) -delete 2>/dev/null || true
echo "✅ Cleaned up build artifacts"

# =============================================================================
# 2. Move images from content to public
# =============================================================================
echo ""
echo "🖼️  Processing images..."

# Find all image directories in content and move to public
find "$CONTENT_DIR" -type d \( -name "figures" -o -name "images" \) 2>/dev/null | while read -r img_dir; do
    if [[ -d "$img_dir" ]]; then
        # Get relative path from content dir
        rel_path="${img_dir#$CONTENT_DIR/}"
        # Remove language prefix (en/, zh/, etc.)
        rel_path_no_lang="${rel_path#*/}"
        
        # Target directory in public
        target_dir="$PUBLIC_DIR/images/${rel_path_no_lang%/figures}"
        target_dir="${target_dir%/images}"  # Remove trailing /images if exists
        
        mkdir -p "$target_dir"
        
        # Copy images
        find "$img_dir" -maxdepth 1 -type f \( -name "*.png" -o -name "*.jpg" -o -name "*.jpeg" -o -name "*.gif" -o -name "*.svg" -o -name "*.webp" \) | while read -r img; do
            cp "$img" "$target_dir/"
            echo "  📁 Copied: $(basename "$img") -> $target_dir/"
        done
        
        # Remove the figures directory from content
        rm -rf "$img_dir"
    fi
done

# =============================================================================
# 3. Fix image paths in markdown files
# =============================================================================
echo ""
echo "🔗 Fixing image paths in markdown files..."

fix_image_paths() {
    local file="$1"
    local rel_dir
    
    # Get the relative directory path (without language prefix)
    rel_dir=$(dirname "${file#$CONTENT_DIR/}")
    rel_dir="${rel_dir#*/}"  # Remove language prefix
    
    # Replace ./figures/xxx.png with /images/rel_dir/xxx.png
    if grep -q '\./figures/' "$file" 2>/dev/null; then
        sed -i.bak "s|\./figures/|/images/${rel_dir}/|g" "$file"
        rm -f "$file.bak"
        echo "  ✏️  Fixed image paths in: $file"
    fi
    
    # Replace ../figures/xxx.png with /images/parent_dir/xxx.png
    if grep -q '\.\./figures/' "$file" 2>/dev/null; then
        parent_dir=$(dirname "$rel_dir")
        sed -i.bak "s|\.\./figures/|/images/${parent_dir}/|g" "$file"
        rm -f "$file.bak"
        echo "  ✏️  Fixed parent image paths in: $file"
    fi

    if grep -q '\.\./images/' "$file" 2>/dev/null; then
        parent_dir=$(dirname "$rel_dir")
        [[ "$parent_dir" == "." ]] && parent_dir=""
        sed -i.bak "s|\.\./images/|/images/${parent_dir:+${parent_dir}/}|g" "$file"
        rm -f "$file.bak"
        echo "  ✏️  Fixed parent image paths in: $file"
    fi
}

export -f fix_image_paths
export CONTENT_DIR

find "$CONTENT_DIR" -name "*.md" -type f | while read -r file; do
    fix_image_paths "$file"
done

# =============================================================================
# 3.5 Drop orphan files (translated docs whose source .md no longer exists)
# =============================================================================
echo ""
echo "🗑️  Removing orphan content files..."

SOURCE_DOCS="$SOURCE_REPO/doc/source"
if [[ -d "$SOURCE_DOCS" ]]; then
    for lang_dir in "$CONTENT_DIR"/*; do
        [[ -d "$lang_dir" ]] || continue
        lang=$(basename "$lang_dir")
        find "$lang_dir" \( -name "*.md" -o -name "*.mdx" \) -type f | while read -r f; do
            rel="${f#$lang_dir/}"
            if [[ ! -f "$SOURCE_DOCS/$rel" ]]; then
                echo "  ❌ Orphan: $lang/$rel"
                rm -f "$f"
            fi
        done
        # Drop now-empty directories.
        find "$lang_dir" -type d -empty -delete 2>/dev/null
    done
else
    echo "  (skipped: $SOURCE_DOCS not present)"
fi

# =============================================================================
# 3.6 Fallback: copy missing content files from en to zh
# =============================================================================
# Ensure zh has all files en has before translation runs. If a file is
# renamed (e.g. installation.md → installation.mdx) or new files are added,
# the zh directory may be missing files that _meta.ts references. Copy the
# English version as a fallback so the build doesn't break.
# translate-diff-v2.js will overwrite these with Chinese translations.
echo ""
echo "📋 Checking for missing zh files (en fallback)..."

EN_DIR="$CONTENT_DIR/en"
ZH_DIR="$CONTENT_DIR/zh"
if [[ -d "$EN_DIR" && -d "$ZH_DIR" ]]; then
    find "$EN_DIR" \( -name "*.md" -o -name "*.mdx" \) -type f | while read -r f; do
        rel="${f#$EN_DIR/}"
        zh_file="$ZH_DIR/$rel"
        if [[ ! -f "$zh_file" ]]; then
            mkdir -p "$(dirname "$zh_file")"
            cp "$f" "$zh_file"
            echo "  📄 Copied: zh/$rel (en fallback)"
        fi
    done
    echo "✅ zh fallback check complete"
else
    echo "  (skipped: en or zh directory not found)"
fi

# =============================================================================
# 4. Translate _meta.ts files to Chinese
# =============================================================================
echo ""
echo "🌐 Translating _meta.ts files..."

node "$SCRIPT_DIR/translate-meta.js"

echo ""
echo "✅ Post-sync processing complete!"
echo ""
echo "Summary:"
echo "  - Version info: $ROOT_DIR/version-info.json"
echo "  - Images moved to: $PUBLIC_DIR/images/"
echo "  - Document links: handled by remark plugin at build time"
echo "  - _meta.ts files translated to Chinese"
