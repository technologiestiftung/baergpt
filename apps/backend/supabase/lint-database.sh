#!/bin/bash
set -e

echo "Running Supabase Database Linting..."

# Download latest splinter.sql
echo "Downloading Splinter linter..."
curl -s -o splinter.sql https://raw.githubusercontent.com/supabase/splinter/main/splinter.sql

# Try to find Docker container first (local development)
DB_CONTAINER=$(docker ps --format "{{.Names}}" 2>/dev/null | grep "supabase.*db" | head -1 || true)

if [[ -n "$DB_CONTAINER" ]]; then
    echo "Found database container: $DB_CONTAINER"
    echo "Applying linting rules..."
    
    # Apply the lints to database via Docker and capture output
    SPLINTER_OUTPUT=$(docker exec -i "$DB_CONTAINER" psql -U postgres -d postgres < splinter.sql 2>&1)
else
    echo "No Docker container found, using direct connection (CI mode)"
    echo "Applying linting rules..."
    
    # Apply the lints to database via direct connection (CI) and capture output
    SPLINTER_OUTPUT=$(psql postgresql://postgres:postgres@localhost:54322/postgres -f splinter.sql 2>&1)
fi

# Show any warnings from splinter execution
echo "$SPLINTER_OUTPUT" | grep -E "(WARNING|ERROR|NOTICE)" || echo "   Linting rules applied successfully"

echo "Generating lint report..."

# Parse the splinter output directly to count issues
ERROR_COUNT=$(echo "$SPLINTER_OUTPUT" | grep -c "| ERROR " 2>/dev/null || echo "0")
WARN_COUNT=$(echo "$SPLINTER_OUTPUT" | grep -c "| WARN " 2>/dev/null || echo "0") 
INFO_COUNT=$(echo "$SPLINTER_OUTPUT" | grep -c "| INFO " 2>/dev/null || echo "0")

# Ensure counts are valid numbers
ERROR_COUNT=$(echo "$ERROR_COUNT" | head -1 | tr -d '\n' | grep -E '^[0-9]+$' || echo "0")
WARN_COUNT=$(echo "$WARN_COUNT" | head -1 | tr -d '\n' | grep -E '^[0-9]+$' || echo "0")
INFO_COUNT=$(echo "$INFO_COUNT" | head -1 | tr -d '\n' | grep -E '^[0-9]+$' || echo "0")

TOTAL_ISSUES=$((ERROR_COUNT + WARN_COUNT + INFO_COUNT))

if [[ "$TOTAL_ISSUES" -gt "0" ]]; then
    echo ""
    echo "Issue Summary:"
    [[ "$ERROR_COUNT" -gt "0" ]] && echo "  Errors: $ERROR_COUNT"
    [[ "$WARN_COUNT" -gt "0" ]] && echo "  Warnings: $WARN_COUNT"
    [[ "$INFO_COUNT" -gt "0" ]] && echo "  Info: $INFO_COUNT"
fi

# Show all issues in detail
if [[ "$ERROR_COUNT" -gt "0" ]]; then
    echo ""
    echo "Errors:"
    
    # Extract and format error details from splinter output
    echo "$SPLINTER_OUTPUT" | grep "| ERROR " | while IFS='|' read -r name title level facing categories description detail remediation metadata cache_key; do
        name=$(echo "$name" | xargs)
        description=$(echo "$description" | xargs)
        detail=$(echo "$detail" | xargs)
        echo "  - $name: $description ($detail)"
    done
fi

if [[ "$WARN_COUNT" -gt "0" ]]; then
    echo ""
    echo "Warnings:"
    
    # Extract and format warning details from splinter output
    echo "$SPLINTER_OUTPUT" | grep "| WARN " | while IFS='|' read -r name title level facing categories description detail remediation metadata cache_key; do
        name=$(echo "$name" | xargs)
        description=$(echo "$description" | xargs)
        detail=$(echo "$detail" | xargs)
        echo "  - $name: $description ($detail)"
    done
fi

if [[ "$INFO_COUNT" -gt "0" ]]; then
    echo ""
    echo "Info:"
    
    # Extract and format info details from splinter output
    echo "$SPLINTER_OUTPUT" | grep "| INFO " | while IFS='|' read -r name title level facing categories description detail remediation metadata cache_key; do
        name=$(echo "$name" | xargs)
        description=$(echo "$description" | xargs)
        detail=$(echo "$detail" | xargs)
        echo "  - $name: $description ($detail)"
    done
fi

# Clean up
rm -f splinter.sql

echo ""

# Fail on ANY warnings or errors found
if [[ "$WARN_COUNT" -gt "0" || "$ERROR_COUNT" -gt "0" ]]; then
    echo "Database linting failed!"
    echo "   Found $TOTAL_ISSUES finding(s): $ERROR_COUNT errors, $WARN_COUNT warnings, $INFO_COUNT info items"
    echo "   All database warnings and errors must be resolved for linting to pass."
    exit 1
else
    echo "Found $TOTAL_ISSUES findings but none are critical"
    echo "Database linting passed!"
fi 