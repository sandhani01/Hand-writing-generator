import os
import sys
from pathlib import Path

# Add project root to sys.path
PROJECT_DIR = Path(__file__).resolve().parent
sys.path.append(str(PROJECT_DIR))

import renderer

def test_wobble():
    text = """This is a test of the line start wobble feature.
Each of these lines should start at a slightly different horizontal position.
This mimics the natural variation in human handwriting.
If you set the wobble to a high value, the effect becomes very obvious.
Let's see if the lines are jittered as expected."""

    output_path = "test_wobble_result.png"
    
    # Use a high wobble to make it visible in the test
    cfg = renderer.DEFAULT_CFG.copy()
    cfg["line_start_jitter"] = 40.0 # High value for visibility
    cfg["margin_left"] = 100
    
    print(f"Rendering test with line_start_jitter = {cfg['line_start_jitter']}...")
    renderer.render(text, output_path, glyphs_dir="glyph_sets", cfg=cfg)
    print(f"Test render saved to {output_path}")

if __name__ == "__main__":
    try:
        test_wobble()
    except Exception as e:
        print(f"FAILED: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
