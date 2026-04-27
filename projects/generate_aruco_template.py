import argparse
import cv2
import cv2.aruco
import numpy as np
from pathlib import Path

def generate_aruco_template(
    output_path,
    rows=8,
    cols=8,
    cell_size=120,
    marker_size=100,
    padding=100,
    dictionary_id=cv2.aruco.DICT_4X4_50,
    labels=None,
    use_color=False
):
    """
    Generates a grid template with ArUco markers at the four corners.
    We add a 1-cell border all around so markers don't block handwriting.
    """
    # Grid dimensions (Content + 1-cell border on each side)
    grid_rows = rows + 2
    grid_cols = cols + 2

    # Calculate pixel dimensions
    grid_w = grid_cols * cell_size
    grid_h = grid_rows * cell_size
    
    # Extra height for header
    header_h = 140 if use_color else 0
    
    # Canvas dimensions
    width = grid_w + 2 * padding
    height = grid_h + 2 * padding + header_h
    
    # Create white canvas
    canvas = np.ones((height, width, 3), dtype=np.uint8) * 255
    
    # Styling colors
    if use_color:
        tech_blue = (255, 140, 0) # Technical Cyan/Blue (BGR)
        line_color = (250, 230, 200) # Soft tech-lines
        font_color = tech_blue
        border_color = tech_blue
    else:
        line_color = (220, 220, 220) # Light gray
        font_color = (150, 150, 150)
        border_color = (180, 180, 180)

    # Offset for grid placement
    grid_y_offset = padding + header_h

    # Add Header if color is enabled
    if use_color:
        # Subtle header bar
        cv2.rectangle(canvas, (0, 0), (width, 80), tech_blue, -1)
        cv2.putText(canvas, "HANDWRITING PROFILE TEMPLATE", (padding, 55), 
                    cv2.FONT_HERSHEY_DUPLEX, 1.2, (255, 255, 255), 2, cv2.LINE_AA)
        
        cv2.putText(canvas, f"Layout: {rows}x{cols} Grid  |  Markers: ArUco 4x4", 
                    (padding, 115), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (120, 120, 120), 1, cv2.LINE_AA)

    # ArUco dictionary
    aruco_dict = cv2.aruco.getPredefinedDictionary(dictionary_id)
    
    # Marker positions: Corners of the expanded (N+2) grid
    marker_positions = [
        (padding, grid_y_offset),                           # TL
        (padding + grid_w - marker_size, grid_y_offset),    # TR
        (padding + grid_w - marker_size, grid_y_offset + grid_h - marker_size), # BR
        (padding, grid_y_offset + grid_h - marker_size)     # BL
    ]
    
    marker_ids = [0, 1, 2, 3]
    
    for i, marker_id in enumerate(marker_ids):
        marker_img = cv2.aruco.generateImageMarker(aruco_dict, marker_id, marker_size)
        marker_img_bgr = cv2.cvtColor(marker_img, cv2.COLOR_GRAY2BGR)
        x, y = marker_positions[i]
        canvas[y : y + marker_size, x : x + marker_size] = marker_img_bgr
        
    # Draw Grid Lines for the expanded grid
    for r in range(grid_rows + 1):
        y = grid_y_offset + r * cell_size
        cv2.line(canvas, (padding, y), (padding + grid_w, y), line_color, 1)
        
    for c in range(grid_cols + 1):
        x = padding + c * cell_size
        cv2.line(canvas, (x, grid_y_offset), (x, grid_y_offset + grid_h), line_color, 1)
        
    # Draw Outer Border
    cv2.rectangle(canvas, (padding, grid_y_offset), (padding + grid_w, grid_y_offset + grid_h), border_color, 2)
    
    # Optional: Add cell labels in the inner rows x cols area
    if labels:
        font = cv2.FONT_HERSHEY_SIMPLEX
        font_scale = 0.4
        for r in range(rows):
            for c in range(cols):
                idx = r * cols + c
                if idx < len(labels):
                    char = labels[idx]
                    if char:
                        label_x = padding + (c + 1) * cell_size + 5
                        label_y = grid_y_offset + (r + 1) * cell_size + 15
                        cv2.putText(canvas, char, (label_x, label_y), font, font_scale, font_color, 1, cv2.LINE_AA)
    
    # Save
    cv2.imwrite(output_path, canvas)
    print(f"Successfully generated ArUco template: {output_path}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate ArUco-enabled handwriting templates.")
    parser.add_argument("--output", type=str, default="template_aruco.png", help="Output filename")
    parser.add_argument("--rows", type=int, default=8, help="Number of rows")
    parser.add_argument("--cols", type=int, default=8, help="Number of columns")
    parser.add_argument("--cell_size", type=int, default=150, help="Size of each cell in pixels")
    parser.add_argument("--marker_size", type=int, default=100, help="Size of ArUco markers")
    parser.add_argument("--padding", type=int, default=100, help="Padding around the grid")
    parser.add_argument("--mode", type=str, choices=["handwriting", "coding", "font"], default="handwriting", help="Preset mode")
    parser.add_argument("--color", action="store_true", help="Use Premium Color Mode (Technical Blue)")
    
    args = parser.parse_args()
    
    path = Path(args.output).resolve()
    
    handwriting_labels = list("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789,.")
    font_labels = list("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz")
    coding_labels = [
        "!", "@", "#", "%", "^", "&",
        "*", "(", ")", "-", "_", "=",
        "+", "[", "]", "{", "}", ";",
        ":", "'", "\"", "<", ">", "/",
        "?", "\\", "|", "`", "~", "",
    ]
    
    if args.mode == "coding":
        generate_aruco_template(str(path), rows=5, cols=6, labels=coding_labels, 
                                 cell_size=args.cell_size, marker_size=args.marker_size, 
                                 use_color=args.color)
    elif args.mode == "font":
        generate_aruco_template(str(path), rows=7, cols=8, labels=font_labels, 
                                 cell_size=args.cell_size, marker_size=args.marker_size, 
                                 use_color=args.color)
    else:
        generate_aruco_template(str(path), rows=8, cols=8, labels=handwriting_labels, 
                                 cell_size=args.cell_size, marker_size=args.marker_size, 
                                 use_color=args.color)
