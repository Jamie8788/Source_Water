"""
Visualization overlays for water detection comparison and error analysis.
Generates publication-ready comparison images without breaking existing UI.
"""

import numpy as np
from PIL import Image, ImageDraw, ImageFont
import io
import base64
from typing import Tuple, Optional


class MethodComparison:
    """
    Generate side-by-side or overlay comparison of detection methods.
    """
    
    @staticmethod
    def create_comparison_overlay(rgb: np.ndarray,
                                  baseline_mask: np.ndarray,
                                  improved_mask: np.ndarray,
                                  scale: int = 1) -> Image.Image:
        """
        Create overlay showing difference between baseline and improved methods.
        
        Colors:
        - Blue: detected by both (true positives)
        - Red: detected by improved only (potential false positives or improvements)
        - Yellow: detected by baseline only (false positives from baseline)
        - Green: undetected by both (true negatives)
        
        Args:
            rgb: RGB image (uint8, 0-255)
            baseline_mask: binary mask from baseline method
            improved_mask: binary mask from improved method
            scale: upscaling factor for visibility
        """
        # Ensure masks are binary
        baseline_mask = baseline_mask.astype(bool)
        improved_mask = improved_mask.astype(bool)
        
        # Upscale if needed
        if scale > 1:
            h, w = rgb.shape[:2]
            rgb_pil = Image.fromarray(rgb)
            rgb_pil = rgb_pil.resize((w * scale, h * scale), Image.Resampling.NEAREST)
            rgb = np.array(rgb_pil)
            
            baseline_mask = np.repeat(np.repeat(baseline_mask, scale, axis=0), scale, axis=1)
            improved_mask = np.repeat(np.repeat(improved_mask, scale, axis=0), scale, axis=1)
        
        # Create overlay layers
        h, w = rgb.shape[:2]
        overlay = np.zeros((h, w, 4), dtype=np.uint8)
        overlay[..., 3] = 0  # Transparent by default
        
        # True positives (both detect) - blue
        tp = baseline_mask & improved_mask
        overlay[tp, 0] = 50    # R
        overlay[tp, 1] = 100   # G
        overlay[tp, 2] = 200   # B (blue)
        overlay[tp, 3] = 180
        
        # False positives from improved (improved but not baseline) - red
        fp_improved = improved_mask & ~baseline_mask
        overlay[fp_improved, 0] = 220  # R (red)
        overlay[fp_improved, 1] = 50
        overlay[fp_improved, 2] = 50
        overlay[fp_improved, 3] = 180
        
        # False positives from baseline (baseline but not improved) - yellow
        fp_baseline = baseline_mask & ~improved_mask
        overlay[fp_baseline, 0] = 220  # R
        overlay[fp_baseline, 1] = 200  # G (yellow)
        overlay[fp_baseline, 2] = 20
        overlay[fp_baseline, 3] = 180
        
        # Convert to PIL and composite
        rgb_pil = Image.fromarray(rgb)
        overlay_pil = Image.fromarray(overlay, 'RGBA')
        
        result = Image.new('RGBA', rgb_pil.size, (0, 0, 0, 0))
        result.paste(rgb_pil.convert('RGBA'), (0, 0))
        result = Image.alpha_composite(result, overlay_pil)
        
        return result.convert('RGB')
    
    @staticmethod
    def create_error_map(rgb: np.ndarray,
                        predictions: np.ndarray,
                        ground_truth: np.ndarray,
                        scale: int = 1) -> Image.Image:
        """
        Highlight classification errors.
        
        Colors:
        - Green: true positives (correct water)
        - Red: false positives (incorrectly detected water)
        - Yellow: false negatives (missed water)
        - Gray: true negatives (correct non-water)
        
        Args:
            rgb: RGB image (uint8)
            predictions: binary predictions
            ground_truth: binary ground truth (-1 for ignore)
            scale: upscaling factor
        """
        predictions = predictions.astype(bool)
        ground_truth = ground_truth.astype(np.int16)
        
        valid = (ground_truth != -1)
        
        if scale > 1:
            h, w = rgb.shape[:2]
            rgb_pil = Image.fromarray(rgb)
            rgb_pil = rgb_pil.resize((w * scale, h * scale), Image.Resampling.NEAREST)
            rgb = np.array(rgb_pil)
            
            predictions = np.repeat(np.repeat(predictions, scale, axis=0), scale, axis=1)
            ground_truth = np.repeat(np.repeat(ground_truth, scale, axis=0), scale, axis=1)
            valid = np.repeat(np.repeat(valid, scale, axis=0), scale, axis=1)
        
        h, w = rgb.shape[:2]
        overlay = np.zeros((h, w, 4), dtype=np.uint8)
        overlay[..., 3] = 0
        
        # True positives - green
        tp = valid & (predictions == 1) & (ground_truth == 1)
        overlay[tp, 0] = 50
        overlay[tp, 1] = 200
        overlay[tp, 2] = 50
        overlay[tp, 3] = 160
        
        # False positives - red
        fp = valid & (predictions == 1) & (ground_truth == 0)
        overlay[fp, 0] = 220
        overlay[fp, 1] = 50
        overlay[fp, 2] = 50
        overlay[fp, 3] = 160
        
        # False negatives - yellow
        fn = valid & (predictions == 0) & (ground_truth == 1)
        overlay[fn, 0] = 220
        overlay[fn, 1] = 200
        overlay[fn, 2] = 20
        overlay[fn, 3] = 160
        
        # Composite
        rgb_pil = Image.fromarray(rgb)
        overlay_pil = Image.fromarray(overlay, 'RGBA')
        
        result = Image.new('RGBA', rgb_pil.size, (0, 0, 0, 0))
        result.paste(rgb_pil.convert('RGBA'), (0, 0))
        result = Image.alpha_composite(result, overlay_pil)
        
        return result.convert('RGB')
    
    @staticmethod
    def add_legend(img: Image.Image, legend_items: list) -> Image.Image:
        """
        Add legend to map image.
        
        Args:
            img: PIL Image
            legend_items: list of (label, color_rgb) tuples
        """
        # Create new image with extra space for legend
        legend_height = 20 + len(legend_items) * 25
        new_img = Image.new('RGB', (img.width, img.height + legend_height), (255, 255, 255))
        new_img.paste(img, (0, 0))
        
        draw = ImageDraw.Draw(new_img)
        
        # Draw legend items
        for idx, (label, color) in enumerate(legend_items):
            y = img.height + 20 + idx * 25
            # Draw color box
            draw.rectangle([10, y, 30, y + 15], fill=color, outline=(0, 0, 0))
            # Draw label
            draw.text([40, y], label, fill=(0, 0, 0))
        
        return new_img


class VisualizationUtils:
    """
    Utility functions for visualization processing.
    """
    
    @staticmethod
    def image_to_base64_png(img: Image.Image) -> str:
        """Convert PIL Image to base64-encoded PNG data URL."""
        buffer = io.BytesIO()
        img.save(buffer, format='PNG')
        buffer.seek(0)
        encoded = base64.b64encode(buffer.getvalue()).decode('utf-8')
        return f"data:image/png;base64,{encoded}"
    
    @staticmethod
    def binary_mask_to_overlay_png(mask: np.ndarray, 
                                   color: Tuple[int, int, int] = (0, 0, 255),
                                   opacity: float = 0.25) -> Image.Image:
        """
        Convert binary mask to semi-transparent overlay image.
        
        Args:
            mask: binary array (0 or 1)
            color: RGB color tuple
            opacity: opacity level (0-1)
        """
        h, w = mask.shape
        overlay = np.zeros((h, w, 4), dtype=np.uint8)
        
        mask_bool = mask.astype(bool)
        overlay[mask_bool, 0] = color[0]
        overlay[mask_bool, 1] = color[1]
        overlay[mask_bool, 2] = color[2]
        overlay[mask_bool, 3] = int(255 * opacity)
        
        return Image.fromarray(overlay, 'RGBA')
    
    @staticmethod
    def create_comparison_grid(images: dict, titles: list, 
                               size: Tuple[int, int] = (512, 512)) -> Image.Image:
        """
        Create grid of comparison images.
        
        Args:
            images: dict of {title: PIL_Image}
            titles: list of titles in order
            size: size of each sub-image
        
        Returns:
            PIL Image with grid layout
        """
        if not titles:
            titles = list(images.keys())
        
        n = len(titles)
        cols = min(2, n)
        rows = (n + cols - 1) // cols
        
        grid_img = Image.new('RGB', (size[0] * cols, size[1] * rows), (200, 200, 200))
        
        for idx, title in enumerate(titles):
            if title not in images:
                continue
            
            img = images[title]
            img_resized = img.resize(size, Image.Resampling.LANCZOS)
            
            col = idx % cols
            row = idx // cols
            
            x = col * size[0]
            y = row * size[1]
            
            grid_img.paste(img_resized, (x, y))
        
        return grid_img
