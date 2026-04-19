import sys
import random
from pathlib import Path

# Add project root to sys.path
PROJECT_DIR = Path(__file__).resolve().parent
sys.path.append(str(PROJECT_DIR))

import renderer

def test_sampling_variety():
    # Mock library with 2 different samples for 's'
    mock_s1 = "SAMPLE_A"
    mock_s2 = "SAMPLE_B"
    library = {"s_lower": [mock_s1, mock_s2]}

    print("Testing GlyphSampler with 2 samples (A and B)...")
    sampler = renderer.GlyphSampler(library)
    
    results = []
    for _ in range(10):
        results.append(sampler.get_sample("s"))
    
    print(f"Sampling sequence: {results}")
    
    # Check for immediate repeats
    repeats = 0
    for i in range(len(results) - 1):
        if results[i] == results[i+1]:
            repeats += 1
            print(f"FAIL: Immediate repeat at index {i}/{i+1}: {results[i]}")
            
    if repeats == 0:
        print("PASS: No immediate repeats found in 10 samples.")
    else:
        print(f"FAIL: Found {repeats} immediate repeats.")
        sys.exit(1)

    # Check that both are used
    if "SAMPLE_A" in results and "SAMPLE_B" in results:
        print("PASS: Both samples were used.")
    else:
        print("FAIL: One or more samples were never used.")
        sys.exit(1)

if __name__ == "__main__":
    try:
        test_sampling_variety()
    except Exception as e:
        print(f"CRITICAL ERROR: {e}")
        sys.exit(1)
