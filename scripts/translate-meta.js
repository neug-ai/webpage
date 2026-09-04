#!/usr/bin/env node

/**
 * Translate _meta.ts files from English to Chinese using LLM
 * - New files: translate and create
 * - Existing files: compare keys with source; re-translate if keys differ
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const CONTENT_DIR = path.join(__dirname, '..', 'content');
const SOURCE_LANG = 'en';
const TARGET_LANG = 'zh';

// Translation prompt
const SYSTEM_PROMPT = `You are a translator. Translate the values in this TypeScript _meta.ts file from English to Chinese.
Keep the keys unchanged, only translate the string values.
Return ONLY the translated TypeScript code, no explanations.
Keep the same format and structure.`;

async function translateWithLLM(content) {
  const apiKey = process.env.OPENAI_API_KEY;
  let baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
  
  // Remove trailing slash if present
  baseUrl = baseUrl.replace(/\/+$/, '');
  
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not set (check env or .env file)');
  }

  // Check if baseUrl already contains /chat/completions
  const endpoint = baseUrl.includes('/chat/completions') 
    ? baseUrl 
    : `${baseUrl}/chat/completions`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'qwen-plus',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Translate this _meta.ts file to Chinese:\n\n${content}` }
      ],
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`LLM API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  let translated = data.choices[0].message.content.trim();
  
  // Clean up markdown code blocks if present
  translated = translated.replace(/^```(?:typescript|ts)?\n?/i, '');
  translated = translated.replace(/\n?```$/i, '');
  
  return translated;
}

function findMetaFiles(dir, files = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      findMetaFiles(fullPath, files);
    } else if (entry.name === '_meta.ts') {
      files.push(fullPath);
    }
  }
  
  return files;
}

/** Extract keys from _meta.ts export default { key: "value", ... } */
function extractKeys(content) {
  const keys = [];
  const match = content.match(/export\s+default\s*\{([\s\S]+)\}/);
  if (!match) return keys;
  const body = match[1];
  const keyRegex = /^\s*(?:(["'])(.*?)\1|([A-Za-z_$][\w$]*))\s*:/gm;
  let m;
  while ((m = keyRegex.exec(body)) !== null) keys.push(m[2] || m[3]);
  return keys.sort();
}

/** Check if target needs sync (keys differ from source) */
function needsKeySync(sourceContent, targetContent) {
  const sourceKeys = extractKeys(sourceContent);
  const targetKeys = extractKeys(targetContent);
  if (sourceKeys.length !== targetKeys.length) return true;
  return sourceKeys.some((k, i) => k !== targetKeys[i]);
}

async function main() {
  const sourceDir = path.join(CONTENT_DIR, SOURCE_LANG);
  const targetDir = path.join(CONTENT_DIR, TARGET_LANG);
  
  if (!fs.existsSync(sourceDir)) {
    console.log(`❌ Source directory not found: ${sourceDir}`);
    process.exit(1);
  }
  
  // Find all _meta.ts files in source language
  const sourceMetaFiles = findMetaFiles(sourceDir);
  
  console.log(`\n📝 Found ${sourceMetaFiles.length} _meta.ts files in ${SOURCE_LANG}/`);
  
  let translated = 0;
  let skipped = 0;
  
  for (const sourceFile of sourceMetaFiles) {
    // Calculate target path
    const relativePath = path.relative(sourceDir, sourceFile);
    const targetFile = path.join(targetDir, relativePath);
    
    const sourceContent = fs.readFileSync(sourceFile, 'utf-8');
    
    // If target exists, check key consistency
    if (fs.existsSync(targetFile)) {
      const targetContent = fs.readFileSync(targetFile, 'utf-8');
      if (!needsKeySync(sourceContent, targetContent)) {
        console.log(`  ⏭️  Skip (keys match): ${relativePath}`);
        skipped++;
        continue;
      }
      console.log(`  🔄 Re-translating (keys changed): ${relativePath}`);
    } else {
      console.log(`  🔄 Translating: ${relativePath}`);
    }
    
    // Ensure target directory exists
    const targetDirPath = path.dirname(targetFile);
    if (!fs.existsSync(targetDirPath)) {
      fs.mkdirSync(targetDirPath, { recursive: true });
    }
    
    try {
      // Translate using LLM
      const translatedContent = await translateWithLLM(sourceContent);

      // Write translated file
      fs.writeFileSync(targetFile, translatedContent);
      console.log(`  ✅ Created: ${TARGET_LANG}/${relativePath}`);
      translated++;
    } catch (error) {
      console.error(`  ❌ Failed to translate ${relativePath}: ${error.message}`);
      if (fs.existsSync(targetFile)) {
        console.log(`  ⏭️  Keeping existing: ${TARGET_LANG}/${relativePath}`);
      } else {
        fs.writeFileSync(targetFile, sourceContent);
        console.log(`  ⚠️  Copied original as fallback: ${TARGET_LANG}/${relativePath}`);
      }
    }
  }
  
  console.log(`\n📊 Summary: ${translated} translated, ${skipped} skipped`);
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
