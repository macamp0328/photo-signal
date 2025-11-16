#!/bin/bash
# Bundle size checker script
# Analyzes Vite build output and compares against limits

set -e

DIST_DIR="dist/assets"
# Maximum gzipped JS size in KB
# Set to 140KB to accommodate Howler.js audio library (~90KB gzipped)
# + React/DOM (~40KB) + app code (~10KB)
# TODO: Consider code splitting or lighter audio library for future optimization
MAX_JS_SIZE_KB=140
MAX_CSS_SIZE_KB=5    # Maximum gzipped CSS size in KB (increased for secret-settings and debug-overlay modules)

echo "📦 Bundle Size Analysis"
echo "======================="
echo ""

if [ ! -d "dist" ]; then
  echo "❌ Error: dist/ directory not found. Run 'npm run build' first."
  exit 1
fi

# Find JS and CSS files
find_largest_bundle_file() {
  local pattern=$1
  local largest_file=""
  local largest_size=0

  while IFS= read -r file; do
    [ -f "$file" ] || continue
    local gz_size
    gz_size=$(gzip -c "$file" | wc -c | tr -d ' ')
    if [ "$gz_size" -gt "$largest_size" ]; then
      largest_size=$gz_size
      largest_file=$file
    fi
  done < <(find "$DIST_DIR" -name "$pattern" -type f)

  echo "$largest_file"
}

JS_FILE=$(find_largest_bundle_file "index-*.js")
CSS_FILE=$(find_largest_bundle_file "index-*.css")

if [ -z "$JS_FILE" ]; then
  echo "❌ Error: No JavaScript bundle found in $DIST_DIR"
  exit 1
fi

if [ -z "$CSS_FILE" ]; then
  echo "❌ Error: No CSS bundle found in $DIST_DIR"
  exit 1
fi

# Get file sizes (raw and gzipped)
JS_RAW_SIZE=$(stat -f%z "$JS_FILE" 2>/dev/null || stat -c%s "$JS_FILE")
CSS_RAW_SIZE=$(stat -f%z "$CSS_FILE" 2>/dev/null || stat -c%s "$CSS_FILE")

# Gzip files temporarily to check compressed size
JS_GZIP_SIZE=$(gzip -c "$JS_FILE" | wc -c | tr -d ' ')
CSS_GZIP_SIZE=$(gzip -c "$CSS_FILE" | wc -c | tr -d ' ')

# Convert to KB
JS_RAW_KB=$((JS_RAW_SIZE / 1024))
CSS_RAW_KB=$((CSS_RAW_SIZE / 1024))
JS_GZIP_KB=$((JS_GZIP_SIZE / 1024))
CSS_GZIP_KB=$((CSS_GZIP_SIZE / 1024))

echo "JavaScript Bundle:"
echo "  File: $(basename "$JS_FILE")"
echo "  Raw:     ${JS_RAW_KB} KB (${JS_RAW_SIZE} bytes)"
echo "  Gzipped: ${JS_GZIP_KB} KB (${JS_GZIP_SIZE} bytes)"
echo "  Limit:   ${MAX_JS_SIZE_KB} KB"

if [ $JS_GZIP_KB -gt $MAX_JS_SIZE_KB ]; then
  echo "  Status: ❌ FAIL (exceeds limit by $((JS_GZIP_KB - MAX_JS_SIZE_KB)) KB)"
  JS_PASS=false
else
  echo "  Status: ✅ PASS"
  JS_PASS=true
fi

echo ""
echo "CSS Bundle:"
echo "  File: $(basename "$CSS_FILE")"
echo "  Raw:     ${CSS_RAW_KB} KB (${CSS_RAW_SIZE} bytes)"
echo "  Gzipped: ${CSS_GZIP_KB} KB (${CSS_GZIP_SIZE} bytes)"
echo "  Limit:   ${MAX_CSS_SIZE_KB} KB"

if [ $CSS_GZIP_KB -gt $MAX_CSS_SIZE_KB ]; then
  echo "  Status: ❌ FAIL (exceeds limit by $((CSS_GZIP_KB - MAX_CSS_SIZE_KB)) KB)"
  CSS_PASS=false
else
  echo "  Status: ✅ PASS"
  CSS_PASS=true
fi

echo ""
echo "Total Bundle:"
TOTAL_GZIP_KB=$((JS_GZIP_KB + CSS_GZIP_KB))
echo "  Gzipped: ${TOTAL_GZIP_KB} KB"
echo ""

if [ "$JS_PASS" = true ] && [ "$CSS_PASS" = true ]; then
  echo "✅ All bundle size checks passed!"
  exit 0
else
  echo "❌ Bundle size check failed. Consider:"
  echo "   - Code splitting"
  echo "   - Removing unused dependencies"
  echo "   - Tree-shaking optimization"
  echo "   - Lazy loading components"
  exit 1
fi
