#!/bin/bash

# Test all Ollama models with glance CLI
echo "Testing all Ollama models with glance CLI"
echo "=========================================="

# Array of models to test
models=(
    "gemma3:4b"
    "mistral:7b"
    "mistral:latest"
    "gpt-oss:20b"
    "deepseek-r1:latest"
    "llama3:latest"
    "gpt-oss:120b-cloud"
)

# Test URL (using example.com as it's small and predictable)
TEST_URL="https://example.com"

# Summary modes to test
modes=("--tldr" "--key-points" "--eli5")

# Results file
RESULTS_FILE="model-test-results.md"

# Initialize results file
echo "# Ollama Model Test Results" > $RESULTS_FILE
echo "" >> $RESULTS_FILE
echo "Test Date: $(date)" >> $RESULTS_FILE
echo "" >> $RESULTS_FILE

# Test each model
for model in "${models[@]}"; do
    echo "Testing model: $model"
    echo "" 
    echo "## Model: $model" >> $RESULTS_FILE
    echo "" >> $RESULTS_FILE
    
    # Test each mode
    for mode in "${modes[@]}"; do
        echo "  Testing $mode mode..."
        echo "### Mode: $mode" >> $RESULTS_FILE
        echo "" >> $RESULTS_FILE
        
        # Run the test and capture output
        echo '```' >> $RESULTS_FILE
        
        # Run the test
        if node dist/cli.js "$TEST_URL" --model "$model" $mode 2>&1; then
            echo "✅ SUCCESS: $model with $mode"
            echo '```' >> $RESULTS_FILE
            echo "**Status:** ✅ SUCCESS" >> $RESULTS_FILE
        else
            exit_code=$?
            echo "❌ FAILED: $model with $mode (exit code: $exit_code)"
            echo '```' >> $RESULTS_FILE
            echo "**Status:** ❌ FAILED (exit code: $exit_code)" >> $RESULTS_FILE
        fi
        
        echo "" >> $RESULTS_FILE
    done
    
    echo "---" >> $RESULTS_FILE
    echo "" >> $RESULTS_FILE
done

echo ""
echo "=========================================="
echo "All tests completed! Results saved to $RESULTS_FILE"
echo ""
echo "Summary:"
grep "Status:" $RESULTS_FILE | sort | uniq -c