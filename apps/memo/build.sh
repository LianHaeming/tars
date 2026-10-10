# Memo's landing page, then the Burmese and Omarchy apps built again under /burmese/ and /omarchy/ (their own dist/
# builds, for their own icons, are untouched).
set -eu
(cd web && npm run build)
for a in burmese omarchy; do (cd "../$a/web" && npx vite build --logLevel warn --base "/$a/" --outDir "../../memo/dist/$a"); done
