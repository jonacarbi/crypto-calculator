#!/bin/sh
# Copies the real app UI into the landing page's live demo (run by Netlify before publish).
set -e
cp src/main.js src/num.js src/styles.css src/favicon.svg site/demo/
sed 's#<script type="module" src="main.js">#<script src="mock.js"></script>\n  <script type="module" src="main.js">#' src/index.html > site/demo/index.html
