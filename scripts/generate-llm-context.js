const fs = require('node:fs');
const path = require('node:path');

// Configuration
const DOCS_DIR = path.join(__dirname, '../docs');
const OUTPUT_FILE = path.join(__dirname, '../static/llm-context.md');

/**
 * Recursively get all markdown files from a directory
 * @param {string} dir - Directory to search
 * @param {string} baseDir - Base directory for relative paths
 * @returns {Array<{path: string, relativePath: string}>}
 */
function getAllMarkdownFiles(dir, baseDir = dir) {
  let results = [];
  const items = fs.readdirSync(dir, { withFileTypes: true });

  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    
    if (item.isDirectory()) {
      // Recursively search subdirectories
      results = results.concat(getAllMarkdownFiles(fullPath, baseDir));
    } else if (item.isFile() && item.name.endsWith('.md')) {
      const relativePath = path.relative(baseDir, fullPath);
      results.push({ path: fullPath, relativePath });
    }
  }

  return results;
}

/**
 * Sort files in a logical order (numerical prefix first, then alphabetically)
 */
function sortFiles(files) {
  return files.sort((a, b) => {
    // Sort by relative path for proper hierarchy
    const pathA = a.relativePath.toLowerCase();
    const pathB = b.relativePath.toLowerCase();
    
    return pathA.localeCompare(pathB, undefined, { numeric: true });
  });
}

/**
 * Generate the LLM context file
 */
function generateLLMContext() {
  console.log('🔍 Scanning documentation files...');
  
  // Get all markdown files
  const markdownFiles = getAllMarkdownFiles(DOCS_DIR);
  const sortedFiles = sortFiles(markdownFiles);
  
  console.log(`📄 Found ${sortedFiles.length} markdown files`);
  
  // Create output content
  let output = '';
  
  // Add header
  output += '# Adaptivestone Framework - Complete Documentation\n\n';
  output += '> This file is auto-generated from the Docusaurus documentation.\n';
  output += `> Generated on: ${new Date().toISOString()}\n`;
  output += `> Total documents: ${sortedFiles.length}\n\n`;
  output += '---\n\n';
  
  // Add table of contents
  output += '## Table of Contents\n\n';
  sortedFiles.forEach((file, index) => {
    const title = file.relativePath.replace(/\.md$/, '').replace(/\//g, ' / ');
    output += `${index + 1}. ${title}\n`;
  });
  output += '\n---\n\n';
  
  // Concatenate all files
  sortedFiles.forEach((file, index) => {
    console.log(`  ├─ Processing: ${file.relativePath}`);
    
    // Add section header
    const sectionTitle = file.relativePath.replace(/\.md$/, '').replace(/\//g, ' > ');
    output += `\n\n# Document ${index + 1}: ${sectionTitle}\n\n`;
    output += `<!-- Source: ${file.relativePath} -->\n\n`;
    
    // Read and add file content
    const content = fs.readFileSync(file.path, 'utf8');
    output += content;
    
    // Add separator between documents
    output += '\n\n---\n';
  });
  
  // Add footer
  output += '\n\n<!-- End of Documentation -->\n';
  
  // Write output file
  fs.writeFileSync(OUTPUT_FILE, output, 'utf8');
  
  // Calculate statistics
  const stats = fs.statSync(OUTPUT_FILE);
  const words = output.split(/\s+/).length;
  const estimatedTokens = Math.round(words * 1.3); // Rough estimate: 1 word ≈ 1.3 tokens
  
  console.log('\n✅ LLM context file generated successfully!');
  console.log(`\n📊 Statistics:`);
  console.log(`  - Output file: ${path.relative(process.cwd(), OUTPUT_FILE)}`);
  console.log(`  - File size: ${(stats.size / 1024).toFixed(2)} KB`);
  console.log(`  - Word count: ${words.toLocaleString()}`);
  console.log(`  - Estimated tokens: ${estimatedTokens.toLocaleString()}`);
  console.log(`\n💡 You can now use this file with AI assistants like ChatGPT, Claude, etc.`);
}

// Run the script
try {
  generateLLMContext();
} catch (error) {
  console.error('❌ Error generating LLM context:', error);
  process.exit(1);
}
