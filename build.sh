#!/bin/bash
set -e
cd "$(dirname "$0")"
if [ -s deps/lame.min.js ] && head -c 100 deps/lame.min.js | grep -q lamejs; then
  { cat src/head.html
    printf '<script>\n'
    cat deps/lame.min.js
    printf '\n</script>\n'
    cat src/app.html src/js1.html src/js2.html src/js3.html src/js4.html
  } > index.html
else
  { cat src/head.html
    cat src/app.html src/js1.html src/js2.html src/js3.html src/js4.html
  } > index.html
fi
echo "built index.html: $(wc -c < index.html) bytes"
