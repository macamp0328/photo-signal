#!/bin/bash
# Bundle size checker script
# Analyzes Vite build output and compares against limits

set -e

DIST_DIR="dist/assets"
MAX_JS_SIZE_KB=80    # Maximum gzipped JS size in KB
MAX_CSS_SIZE_KB=3    # Maximum gzipped CSS size in KB

echo "📦 Bundle Size Analysis"
echo "======================="
echo ""

if [ ! -d "dist" ]; then
  echo "❌ Error: dist/ directory not found. Run 'npm run build' first."
  exit 1
fi

# Find JS and CSS files
JS_FILE=$(find "$DIST_DIR" -name "index-*.js" | head -1)
CSS_FILE=$(find "$DIST_DIR" -name "index-*.css" | head -1)

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
echo "  File: $(basename $JS_FILE)"
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
echo "  File: $(basename $CSS_FILE)"
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
