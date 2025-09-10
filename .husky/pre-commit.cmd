@echo off
echo Running pre-commit checks...

echo Formatting code with Prettier...
call npm run format
if %errorlevel% neq 0 (
    echo Prettier formatting failed! Commit aborted.
    exit /b 1
)

echo Running ESLint checks...
call npm run lint:ci
if %errorlevel% neq 0 (
    echo ESLint checks failed! Commit aborted.
    exit /b 1
)

echo Running tests...
call npm run test:ci
if %errorlevel% neq 0 (
    echo Tests failed! Commit aborted.
    exit /b 1
)

echo Pre-commit checks completed!