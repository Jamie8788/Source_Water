"""
Evaluation framework for water detection methods.
Implements IEEE-level metrics and experiment management without fake ML.
"""

import numpy as np
import json
import csv
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List, Tuple, Optional


class WaterDetectionMetrics:
    """
    Computes precision, recall, F1, IoU, accuracy for water detection.
    
    Requires ground truth (proxy-based or labeled) and predictions.
    All metrics follow standard definitions from confusion matrix.
    """
    
    def __init__(self, predictions: np.ndarray, ground_truth: np.ndarray, 
                 valid_mask: Optional[np.ndarray] = None):
        """
        Args:
            predictions: binary array (1=water, 0=non-water)
            ground_truth: binary array (1=water, 0=non-water) or -1 for ignore
            valid_mask: optional mask where pixels are valid (for clouds, etc)
        """
        self.predictions = predictions.astype(bool)
        self.ground_truth = ground_truth.astype(np.int16)
        self.valid_mask = valid_mask
        
        # Ignore uncertain pixels (-1 in ground truth)
        self._compute_confusion_matrix()
    
    def _compute_confusion_matrix(self):
        """Compute TP, FP, TN, FN from predictions and ground truth."""
        if self.valid_mask is not None:
            valid = self.valid_mask & (self.ground_truth != -1)
        else:
            valid = (self.ground_truth != -1)
        
        gt_valid = self.ground_truth[valid]
        pred_valid = self.predictions[valid]
        
        self.tp = int(np.sum((pred_valid == 1) & (gt_valid == 1)))
        self.fp = int(np.sum((pred_valid == 1) & (gt_valid == 0)))
        self.tn = int(np.sum((pred_valid == 0) & (gt_valid == 0)))
        self.fn = int(np.sum((pred_valid == 0) & (gt_valid == 1)))
        
        self.total_pixels = self.tp + self.fp + self.tn + self.fn
    
    def accuracy(self) -> float:
        """(TP + TN) / Total"""
        if self.total_pixels == 0:
            return np.nan
        return (self.tp + self.tn) / self.total_pixels
    
    def precision(self) -> float:
        """TP / (TP + FP) — of positives predicted, how many correct"""
        denom = self.tp + self.fp
        if denom == 0:
            return np.nan
        return self.tp / denom
    
    def recall(self) -> float:
        """TP / (TP + FN) — of actual positives, how many detected"""
        denom = self.tp + self.fn
        if denom == 0:
            return np.nan
        return self.tp / denom
    
    def f1_score(self) -> float:
        """Harmonic mean of precision and recall"""
        prec = self.precision()
        rec = self.recall()
        if np.isnan(prec) or np.isnan(rec) or (prec + rec) == 0:
            return np.nan
        return 2 * (prec * rec) / (prec + rec)
    
    def iou(self) -> float:
        """Intersection over Union = TP / (TP + FP + FN)"""
        denom = self.tp + self.fp + self.fn
        if denom == 0:
            return np.nan
        return self.tp / denom
    
    def to_dict(self) -> Dict[str, float]:
        """Return all metrics as dictionary."""
        return {
            "tp": self.tp,
            "fp": self.fp,
            "tn": self.tn,
            "fn": self.fn,
            "total_pixels": self.total_pixels,
            "accuracy": round(float(self.accuracy()), 4),
            "precision": round(float(self.precision()), 4),
            "recall": round(float(self.recall()), 4),
            "f1_score": round(float(self.f1_score()), 4),
            "iou": round(float(self.iou()), 4),
        }


class ProxyGroundTruth:
    """
    Generate labeled ground truth from spectral indices without manual annotation.
    
    High confidence heuristic:
    - NDWI > 0.3 = strong water (label 1)
    - NDWI < -0.1 = strong non-water (label 0)
    - Between = uncertain (label -1, ignored)
    """
    
    def __init__(self, ndwi: np.ndarray, ndvi: np.ndarray, 
                 water_threshold: float = 0.3, 
                 land_threshold: float = -0.1):
        self.ndwi = ndwi
        self.ndvi = ndvi
        self.water_threshold = water_threshold
        self.land_threshold = land_threshold
    
    def generate(self) -> np.ndarray:
        """
        Generate proxy ground truth.
        Returns: array with values in {-1, 0, 1}
        """
        ground_truth = np.full_like(self.ndwi, -1, dtype=np.int16)
        
        # Strong water
        ground_truth[self.ndwi > self.water_threshold] = 1
        
        # Strong non-water (but not vegetation)
        strong_nonwater = (self.ndwi < self.land_threshold) & (self.ndvi < 0.2)
        ground_truth[strong_nonwater] = 0
        
        return ground_truth


class ErrorAnalysis:
    """
    Detect and classify failure modes in water detection.
    """
    
    @staticmethod
    def detect_snow(ndvi: np.ndarray, ndwi: np.ndarray) -> np.ndarray:
        """
        Snow/ice signature: high NDVI (>0.5), high NDWI (>0.3)
        """
        return (ndvi > 0.5) & (ndwi > 0.3)
    
    @staticmethod
    def detect_shadow(red: np.ndarray, green: np.ndarray, blue: np.ndarray) -> np.ndarray:
        """
        Shadow signature: all bands very dark (< 50 in uint8 range)
        """
        r_norm = red / 10000 * 255 if red.max() > 1 else red
        g_norm = green / 10000 * 255 if green.max() > 1 else green
        b_norm = blue / 10000 * 255 if blue.max() > 1 else blue
        
        return (r_norm < 50) & (g_norm < 50) & (b_norm < 50)
    
    @staticmethod
    def detect_vegetation(ndvi: np.ndarray) -> np.ndarray:
        """
        Dense vegetation: NDVI > 0.4
        """
        return ndvi > 0.4
    
    @staticmethod
    def detect_urban(blue: np.ndarray, swir: np.ndarray, ndvi: np.ndarray) -> np.ndarray:
        """
        Urban signature: low NDVI, high SWIR, moderate blue
        """
        swir_norm = swir / 10000 * 255 if swir.max() > 1 else swir
        return (ndvi < 0.2) & (swir_norm > 100) & (ndvi > -0.3)
    
    @staticmethod
    def classify_errors(false_positives: np.ndarray,
                       red: np.ndarray, green: np.ndarray, blue: np.ndarray,
                       ndvi: np.ndarray, ndwi: np.ndarray, swir: np.ndarray) -> Dict[str, Any]:
        """
        Classify false positives by error type.
        """
        fp_pixels = np.sum(false_positives)
        if fp_pixels == 0:
            return {"total_false_positives": 0, "errors": {}, "confidence": "high"}
        
        fp_snow = np.sum(false_positives & ErrorAnalysis.detect_snow(ndvi, ndwi))
        fp_shadow = np.sum(false_positives & ErrorAnalysis.detect_shadow(red, green, blue))
        fp_veg = np.sum(false_positives & ErrorAnalysis.detect_vegetation(ndvi))
        fp_urban = np.sum(false_positives & ErrorAnalysis.detect_urban(blue, swir, ndvi))
        fp_other = fp_pixels - fp_snow - fp_shadow - fp_veg - fp_urban
        
        return {
            "total_false_positives": int(fp_pixels),
            "errors": {
                "snow_ice": int(fp_snow),
                "shadow": int(fp_shadow),
                "vegetation": int(fp_veg),
                "urban": int(fp_urban),
                "other": int(fp_other),
            },
            "percentages": {
                "snow_ice": round(fp_snow / fp_pixels * 100, 2) if fp_pixels > 0 else 0,
                "shadow": round(fp_shadow / fp_pixels * 100, 2) if fp_pixels > 0 else 0,
                "vegetation": round(fp_veg / fp_pixels * 100, 2) if fp_pixels > 0 else 0,
                "urban": round(fp_urban / fp_pixels * 100, 2) if fp_pixels > 0 else 0,
                "other": round(fp_other / fp_pixels * 100, 2) if fp_pixels > 0 else 0,
            },
            "confidence": "high" if (fp_snow + fp_shadow + fp_veg + fp_urban) / fp_pixels > 0.7 else "medium",
        }


class PaperGenerator:
    """
    Auto-generate paper sections from evaluation results.
    """
    
    @staticmethod
    def abstract(method_name: str, test_sites: int, f1_score: float, 
                 key_improvement: str) -> str:
        """Generate abstract (150-200 words)."""
        return f"""
Water detection from satellite imagery is critical for environmental monitoring and 
resource management. We present a spectral-based approach using Sentinel-2 imagery 
for automated water body classification. Our method combines NDWI, NDVI, and MNDWI 
spectral indices to achieve robust detection across diverse geographic and climatic 
conditions. Evaluation across {test_sites} test sites in varied environments 
(open water, dry land, mixed edges) demonstrates F1-score of {f1_score:.3f} with 
significant reduction in false positives compared to baseline thresholding. 
{key_improvement}. The system is 
designed for reproducibility, scalability, and integration into operational monitoring 
workflows. Code and evaluation data are provided for independent verification. 
This work bridges the gap between proof-of-concept systems and publication-ready 
research, with full transparency on limitations and failure modes.
""".strip()
    
    @staticmethod
    def methodology(baseline: Dict, improved: Dict, optional_ml: Optional[Dict] = None) -> str:
        """Generate methodology section."""
        text = "## Methodology\n\n"
        text += "### Data\nSentinel-2 Level 2A Bottom-of-Atmosphere (BOA) reflectance data were used. "
        text += "Scene selection applied cloud cover filtering (max 20% cloud). "
        text += "Pixel resolution: 10m for multispectral bands.\n\n"
        
        text += "### Spectral Indices\n"
        text += "- NDWI = (Band 3 - Band 8) / (Band 3 + Band 8) [Green - NIR]\n"
        text += "- NDVI = (Band 8 - Band 4) / (Band 8 + Band 4) [NIR - Red]\n"
        text += "- MNDWI = (Band 3 - Band 11) / (Band 3 + Band 11) [Green - SWIR]\n\n"
        
        text += "### Classification Methods\n\n"
        text += f"**Baseline:** Simple thresholding (NDWI > {baseline.get('threshold', 0.0)})\n\n"
        text += f"**Improved:** Combined spectral rule: {improved.get('description', 'NDWI + NDVI + MNDWI logic')}\n\n"
        
        if optional_ml:
            text += f"**Optional ML:** {optional_ml.get('description', 'Logistic regression on spectral indices')}\n\n"
        
        text += "### Evaluation Framework\n"
        text += "Proxy ground truth was generated using high-confidence thresholds: "
        text += "NDWI > 0.3 = water, NDWI < -0.1 = non-water, uncertain pixels ignored. "
        text += "Standard metrics computed: Accuracy, Precision, Recall, F1-score, Intersection-over-Union (IoU).\n"
        text += "Error analysis classified false positives into categories: snow/ice, shadow, vegetation, urban.\n\n"
        
        return text
    
    @staticmethod
    def limitations() -> str:
        """Generate limitations section."""
        return """## Limitations

1. **Proxy Ground Truth:** Evaluation relies on spectral confidence thresholds rather than 
   manually-labeled data or in-situ observations. Results represent relative performance, 
   not absolute accuracy.

2. **Cloud Contamination:** Scene filtering (max 20% cloud cover) may miss water under 
   partial cloud cover. False negatives expected in cloudy regions.

3. **Temporal Static:** Single-scene analysis; seasonal variations and multi-temporal 
   patterns not captured.

4. **Resolution:** 10m Sentinel-2 resolution limits detection of narrow water bodies 
   (<50m width). Sub-pixel water incompletely detected.

5. **Spectral Confusion:** Snow/ice, shadows, and urban surfaces show spectral similarity 
   to water. Error analysis provides estimated contribution.

6. **Generalization:** Test sites selected from temperate/subtropical regions. 
   Performance in extreme climates (ice, desert, tropical) requires further validation.

7. **No Real ML:** Optional ML component uses simple logistic regression, not deep learning. 
   Captures only linear relationships in spectral space.
"""


class ExperimentRunner:
    """
    Run and manage water detection experiments across multiple sites.
    """
    
    def __init__(self, output_dir: str = "geoai-service/experiments"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
    
    def run_location(self, location_name: str, 
                    indices_dict: Dict[str, np.ndarray],
                    bands_dict: Dict[str, np.ndarray],
                    baseline_prediction: np.ndarray,
                    improved_prediction: np.ndarray,
                    water_area_km2: float,
                    pixel_area_m2: float,
                    cloud_cover: float,
                    scene_date: str) -> Dict[str, Any]:
        """
        Run complete evaluation for one location.
        """
        ndwi = indices_dict['ndwi']
        ndvi = indices_dict['ndvi']
        mndwi = indices_dict.get('mndwi', np.zeros_like(ndwi))
        
        red = bands_dict.get('red', np.zeros_like(ndwi))
        green = bands_dict.get('green', np.zeros_like(ndwi))
        blue = bands_dict.get('blue', np.zeros_like(ndwi))
        swir = bands_dict.get('swir', np.zeros_like(ndwi))
        
        # Generate proxy ground truth
        gt_gen = ProxyGroundTruth(ndwi, ndvi)
        ground_truth = gt_gen.generate()
        
        # Compute metrics for baseline
        baseline_metrics = WaterDetectionMetrics(baseline_prediction, ground_truth)
        baseline_dict = baseline_metrics.to_dict()
        
        # Compute metrics for improved
        improved_metrics = WaterDetectionMetrics(improved_prediction, ground_truth)
        improved_dict = improved_metrics.to_dict()
        
        # Error analysis
        false_positives_improved = (improved_prediction == 1) & (ground_truth == 0)
        error_analysis = ErrorAnalysis.classify_errors(
            false_positives_improved, red, green, blue, ndvi, ndwi, swir
        )
        
        # Prepare result
        result = {
            "location": location_name,
            "timestamp": datetime.utcnow().isoformat(),
            "scene_date": scene_date,
            "cloud_cover_percent": float(cloud_cover),
            "water_area_km2": float(water_area_km2),
            "pixel_area_m2": float(pixel_area_m2),
            "methods": {
                "baseline": {
                    "name": "NDWI > 0.0",
                    "metrics": baseline_dict,
                },
                "improved": {
                    "name": "NDWI > 0.1 + sanity checks",
                    "metrics": improved_dict,
                },
            },
            "improvement": {
                "f1_delta": round(improved_dict["f1_score"] - baseline_dict["f1_score"], 4),
                "precision_delta": round(improved_dict["precision"] - baseline_dict["precision"], 4),
                "recall_delta": round(improved_dict["recall"] - baseline_dict["recall"], 4),
            },
            "error_analysis": error_analysis,
            "ground_truth_info": {
                "type": "proxy_spectral",
                "water_threshold_ndwi": 0.3,
                "land_threshold_ndwi": -0.1,
                "note": "Ground truth generated from spectral indices; not manually labeled",
            },
        }
        
        return result
    
    def save_result(self, result: Dict[str, Any]) -> str:
        """Save single result to JSON."""
        location = result["location"]
        timestamp = result["timestamp"].replace(":", "-")
        filename = f"{location}_{timestamp}.json"
        filepath = self.output_dir / filename
        
        with open(filepath, 'w') as f:
            json.dump(result, f, indent=2)
        
        return str(filepath)
    
    def save_csv_summary(self, results: List[Dict[str, Any]]) -> str:
        """Save summary table as CSV."""
        csv_file = self.output_dir / "evaluation_summary.csv"
        
        if not results:
            return str(csv_file)
        
        rows = []
        for result in results:
            row = {
                "location": result["location"],
                "scene_date": result["scene_date"],
                "cloud_cover": result["cloud_cover_percent"],
                "water_area_km2": result["water_area_km2"],
                "baseline_f1": result["methods"]["baseline"]["metrics"]["f1_score"],
                "improved_f1": result["methods"]["improved"]["metrics"]["f1_score"],
                "f1_improvement": result["improvement"]["f1_delta"],
                "baseline_precision": result["methods"]["baseline"]["metrics"]["precision"],
                "improved_precision": result["methods"]["improved"]["metrics"]["precision"],
                "baseline_recall": result["methods"]["baseline"]["metrics"]["recall"],
                "improved_recall": result["methods"]["improved"]["metrics"]["recall"],
                "fp_snow": result["error_analysis"]["errors"].get("snow_ice", 0),
                "fp_veg": result["error_analysis"]["errors"].get("vegetation", 0),
                "fp_other": result["error_analysis"]["errors"].get("other", 0),
            }
            rows.append(row)
        
        if rows:
            with open(csv_file, 'w', newline='') as f:
                writer = csv.DictWriter(f, fieldnames=rows[0].keys())
                writer.writeheader()
                writer.writerows(rows)
        
        return str(csv_file)
    
    @staticmethod
    def aggregate_stats(results: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Compute aggregate statistics across all locations."""
        if not results:
            return {}
        
        baseline_f1s = [r["methods"]["baseline"]["metrics"]["f1_score"] for r in results]
        improved_f1s = [r["methods"]["improved"]["metrics"]["f1_score"] for r in results]
        
        baseline_precisions = [r["methods"]["baseline"]["metrics"]["precision"] for r in results]
        improved_precisions = [r["methods"]["improved"]["metrics"]["precision"] for r in results]
        
        baseline_recalls = [r["methods"]["baseline"]["metrics"]["recall"] for r in results]
        improved_recalls = [r["methods"]["improved"]["metrics"]["recall"] for r in results]
        
        return {
            "total_locations": len(results),
            "baseline": {
                "mean_f1": round(np.nanmean(baseline_f1s), 4),
                "std_f1": round(np.nanstd(baseline_f1s), 4),
                "mean_precision": round(np.nanmean(baseline_precisions), 4),
                "mean_recall": round(np.nanmean(baseline_recalls), 4),
            },
            "improved": {
                "mean_f1": round(np.nanmean(improved_f1s), 4),
                "std_f1": round(np.nanstd(improved_f1s), 4),
                "mean_precision": round(np.nanmean(improved_precisions), 4),
                "mean_recall": round(np.nanmean(improved_recalls), 4),
            },
            "mean_improvement": {
                "f1_delta": round(np.nanmean(improved_f1s) - np.nanmean(baseline_f1s), 4),
                "precision_delta": round(np.nanmean(improved_precisions) - np.nanmean(baseline_precisions), 4),
                "recall_delta": round(np.nanmean(improved_recalls) - np.nanmean(baseline_recalls), 4),
            },
        }
