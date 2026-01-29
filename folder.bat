@echo off
echo [Antigravity] Creating directories and empty files...

:: 1. Create Directories
if not exist ".antigravity" mkdir ".antigravity"
if not exist ".context" mkdir ".context"

:: 2. Create Empty Files
type nul > .antigravity\rules.md
type nul > .context\tech-stack.md
type nul > .context\design-system.md
type nul > .context\product-goals.md
type nul > .context\architecture.md

:: Optional: overwrites README if it exists. Remove this line if you want to keep your current README.
type nul > README.md

echo.
echo [Antigravity] Structure created. You can now paste the content.
pause