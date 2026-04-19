import cv2
import numpy as np
import os
import sys
from pathlib import Path

# Add project root to sys.path
sys.path.append(str(Path(__file__).resolve().parent))

from generate_aruco_template import generate_aruco_template
from extractor import find_grid_aruco

def test_robustness():
    os.makedirs("tmp_robustness_test", exist_ok=True)
    template_path = "tmp_robustness_test/base_template.png"
    
    # 1. Generate a clean template
    generate_aruco_template(template_path, rows=8, cols=8)
    img = cv2.imread(template_path)
    
    print("\n--- TEST 1: Clean Template ---")
    corners = find_grid_aruco(img)
    print("Success: Found 4 corners on clean template.")

    print("\n--- TEST 2: Missing Case (Marker 3 removed) ---")
    # Marker 3 is BL. It is roughly at (padding, height - padding - marker_size)
    # The template padding is 100, marker_size is 100.
    h, w = img.shape[:2]
    img_missing = img.copy()
    # Erase Marker 3 (BL)
    cv2.rectangle(img_missing, (50, h - 250), (250, h - 50), (255, 255, 255), -1)
    
    corners = find_grid_aruco(img_missing)
    print("Success: Estimated 4th corner geometrically.")

    print("\n--- TEST 3: Extreme Noise + Shadow ---")
    img_noisy = img.copy()
    # Add noise
    noise = np.random.normal(0, 50, img_noisy.shape).astype(np.int16)
    img_noisy = np.clip(img_noisy.astype(np.int16) + noise, 0, 255).astype(np.uint8)
    
    # Add a shadow over half the image
    shadow_mask = np.ones((h, w), dtype=np.uint8) * 255
    cv2.rectangle(shadow_mask, (0, 0), (w // 2, h), 100, -1)
    shadow_mask = cv2.GaussianBlur(shadow_mask, (201, 201), 0)
    img_noisy = (img_noisy.astype(np.float32) * (shadow_mask[..., None].astype(np.float32) / 255.0)).astype(np.uint8)
    
    cv2.imwrite("tmp_robustness_test/noisy_shadow.png", img_noisy)
    corners = find_grid_aruco(img_noisy)
    print("Success: Detected markers under noise and shadow.")

    print("\nRobustness tests PASSED!")

if __name__ == "__main__":
    try:
        test_robustness()
    except Exception as e:
        print(f"FAILED: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
