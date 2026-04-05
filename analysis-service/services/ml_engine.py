"""
Real ML Engine for anomaly detection, clustering, trend analysis, and data quality scoring.
"""
from typing import Dict, List, Any, Optional, Tuple
import warnings
warnings.filterwarnings('ignore')

import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.cluster import KMeans, DBSCAN
from scipy import stats


# ── WHO Water Quality Thresholds ───────────────────────────────────────────
WHO_THRESHOLDS = {
    'ph': {'min': 6.5, 'max': 8.5, 'unit': '', 'label': 'pH'},
    'turbidity': {'min': 0, 'max': 5, 'unit': 'NTU', 'label': 'Turbidity'},
    'dissolved_oxygen': {'min': 6, 'max': 999, 'unit': 'mg/L', 'label': 'DO'},
    'temperature': {'min': 0, 'max': 25, 'unit': '°C', 'label': 'Temperature'},
    'nitrates': {'min': 0, 'max': 10, 'unit': 'mg/L', 'label': 'Nitrates'},
    'nitrites': {'min': 0, 'max': 0.1, 'unit': 'mg/L', 'label': 'Nitrites'},
    'conductivity': {'min': 0, 'max': 1500, 'unit': 'µS/cm', 'label': 'Conductivity'},
    'phosphorus': {'min': 0, 'max': 0.03, 'unit': 'mg/L', 'label': 'Phosphorus'},
    'tss': {'min': 0, 'max': 30, 'unit': 'mg/L', 'label': 'TSS'},
    'ecoli': {'min': 0, 'max': 0, 'unit': 'CFU/mL', 'label': 'E. coli'},
    'chlorophyll': {'min': 0, 'max': 15, 'unit': 'µg/L', 'label': 'Chlorophyll'},
}


def normalize_column_name(col: str) -> Optional[str]:
    """Normalize column name to match WHO threshold keys."""
    key = col.lower().replace('_', '').replace(' ', '').replace('-', '')
    for who_key in WHO_THRESHOLDS.keys():
        if who_key.lower().replace('_', '') in key or key in who_key.lower().replace('_', ''):
            return who_key
    return None


def detect_anomalies(df: pd.DataFrame) -> Dict[str, Any]:
    """
    Detect anomalies using IsolationForest on numeric columns.
    Returns dict with anomaly scores, indices, and interpretation.
    """
    anomalies = {
        'method': 'IsolationForest',
        'per_column': {},
        'global_anomalies': [],
        'anomaly_rate': 0.0,
    }
    
    # Select numeric columns
    numeric_cols = df.select_dtypes(include=[np.number]).columns
    if len(numeric_cols) == 0:
        return anomalies
    
    try:
        # IsolationForest
        iso_forest = IsolationForest(contamination=0.1, random_state=42, n_estimators=100)
        predictions = iso_forest.fit_predict(df[numeric_cols].fillna(df[numeric_cols].mean()))
        scores = iso_forest.score_samples(df[numeric_cols].fillna(df[numeric_cols].mean()))
        
        # Per-column analysis
        for col in numeric_cols:
            col_data = pd.to_numeric(df[col], errors='coerce')
            if col_data.isna().all():
                continue
            
            # IQR-based outlier detection as backup
            q25 = col_data.quantile(0.25)
            q75 = col_data.quantile(0.75)
            iqr = q75 - q25
            lower_bound = q25 - 1.5 * iqr
            upper_bound = q75 + 1.5 * iqr
            
            outliers = (col_data < lower_bound) | (col_data > upper_bound)
            outlier_indices = df.index[outliers].tolist()
            
            anomalies['per_column'][col] = {
                'outlier_count': int(outliers.sum()),
                'outlier_pct': float(outliers.sum() / len(df) * 100),
                'lower_bound': float(lower_bound),
                'upper_bound': float(upper_bound),
                'outlier_indices': outlier_indices[:10],  # First 10
            }
        
        # Global anomalies
        global_anomaly_mask = predictions == -1
        anomalies['global_anomalies'] = df.index[global_anomaly_mask].tolist()
        anomalies['anomaly_rate'] = float((global_anomaly_mask).sum() / len(df) * 100)
        anomalies['global_count'] = int(global_anomaly_mask.sum())
        
    except Exception as e:
        anomalies['error'] = str(e)
    
    return anomalies


def detect_correlations(df: pd.DataFrame) -> Dict[str, Any]:
    """Detect correlations between numeric columns."""
    numeric_cols = df.select_dtypes(include=[np.number]).columns
    
    correlations = {
        'matrix': {},
        'strong_pairs': [],
    }
    
    if len(numeric_cols) < 2:
        return correlations
    
    try:
        corr_matrix = df[numeric_cols].corr(method='pearson')
        
        # Store full matrix
        correlations['matrix'] = corr_matrix.to_dict()
        
        # Find strong correlations (|r| > 0.7)
        for i in range(len(corr_matrix.columns)):
            for j in range(i+1, len(corr_matrix.columns)):
                col_i = corr_matrix.columns[i]
                col_j = corr_matrix.columns[j]
                corr_val = corr_matrix.iloc[i, j]
                
                if abs(corr_val) > 0.7:
                    correlations['strong_pairs'].append({
                        'col1': col_i,
                        'col2': col_j,
                        'r': float(corr_val),
                        'relationship': 'positive' if corr_val > 0 else 'negative',
                    })
    
    except Exception as e:
        correlations['error'] = str(e)
    
    return correlations


def detect_trends(df: pd.DataFrame, time_col: Optional[str] = None) -> Dict[str, Any]:
    """
    Detect trends in numeric columns.
    If time_col is provided, use it; otherwise use row index as proxy for time.
    """
    trends = {
        'per_column': {},
        'increasing_trend_count': 0,
        'decreasing_trend_count': 0,
    }
    
    numeric_cols = df.select_dtypes(include=[np.number]).columns
    
    for col in numeric_cols:
        col_data = pd.to_numeric(df[col], errors='coerce')
        if col_data.isna().all():
            continue
        
        # Fill NaN for trend calculation
        col_mean = col_data.mean()
        if pd.isna(col_mean):
            col_mean = 0
        col_filled = col_data.fillna(col_mean)
        
        # Simple linear regression (trend)
        x = np.arange(len(col_filled))
        y = col_filled.values
        
        try:
            slope, intercept, r_value, p_value, std_err = stats.linregress(x, y)
            
            trend_direction = 'increasing' if slope > 0 else 'decreasing' if slope < 0 else 'flat'
            if trend_direction == 'increasing':
                trends['increasing_trend_count'] += 1
            elif trend_direction == 'decreasing':
                trends['decreasing_trend_count'] += 1
            
            # Compute percentage change safely
            col_mean_safe = col_filled.mean() if col_filled.mean() != 0 else 0.01
            pct_change = (slope * len(col_filled)) / col_mean_safe * 100 if col_mean_safe > 0 else 0
            
            trends['per_column'][col] = {
                'slope': float(slope),
                'r_squared': float(r_value ** 2),
                'p_value': float(p_value),
                'trend': trend_direction,
                'significance': 'significant' if p_value < 0.05 else 'not_significant',
                'pct_change': float(pct_change),
            }
        except Exception as e:
            trends['per_column'][col] = {'error': str(e)}
            pass
    
    return trends


def assess_data_quality(df: pd.DataFrame, col_stats: Dict) -> Dict[str, Any]:
    """
    Assess overall data quality based on missing values, outliers, etc.
    Returns quality score 0-100.
    """
    quality = {
        'overall_score': 100.0,
        'issues': [],
        'warnings': [],
        'missing_data_severity': 'low',
        'outlier_severity': 'low',
    }
    
    # Check missing values
    total_values = df.shape[0] * df.shape[1]
    missing_values = df.isna().sum().sum()
    missing_pct = (missing_values / total_values * 100) if total_values > 0 else 0
    
    if missing_pct > 30:
        quality['issues'].append(f"High missing data: {missing_pct:.1f}%")
        quality['overall_score'] -= 30
        quality['missing_data_severity'] = 'critical'
    elif missing_pct > 10:
        quality['warnings'].append(f"Moderate missing data: {missing_pct:.1f}%")
        quality['overall_score'] -= 10
        quality['missing_data_severity'] = 'moderate'
    elif missing_pct > 0:
        quality['warnings'].append(f"Low missing data: {missing_pct:.1f}%")
        quality['overall_score'] -= 2
    
    # Check outliers
    total_outliers = 0
    for col, stats_data in col_stats.get('col_stats', {}).items():
        outliers = stats_data.get('outliers', 0)
        total_outliers += outliers
    
    outlier_pct = (total_outliers / (df.shape[0] * len(df.select_dtypes(include=[np.number]).columns)) * 100) if df.shape[0] > 0 else 0
    
    if outlier_pct > 20:
        quality['issues'].append(f"High outlier rate: {outlier_pct:.1f}%")
        quality['overall_score'] -= 20
        quality['outlier_severity'] = 'critical'
    elif outlier_pct > 5:
        quality['warnings'].append(f"Moderate outlier rate: {outlier_pct:.1f}%")
        quality['overall_score'] -= 8
        quality['outlier_severity'] = 'moderate'
    
    # Check sample size
    if df.shape[0] < 10:
        quality['issues'].append(f"Very small sample size: {df.shape[0]} rows")
        quality['overall_score'] -= 15
    elif df.shape[0] < 30:
        quality['warnings'].append(f"Small sample size: {df.shape[0]} rows")
        quality['overall_score'] -= 5
    
    # Ensure score is in [0, 100]
    quality['overall_score'] = max(0, min(100, quality['overall_score']))
    quality['overall_score'] = float(quality['overall_score'])
    
    return quality


def compute_risk_score(df: pd.DataFrame, col_stats: Dict) -> Dict[str, Any]:
    """
    Compute overall risk score based on WHO violations, anomalies, trends, and data quality.
    Returns score 0-100.
    """
    risk = {
        'score': 0,
        'level': 'low',
        'components': {
            'violations': 0,
            'anomalies': 0,
            'trends': 0,
            'data_quality': 0,
        },
        'violations': [],
        'recommendations': [],
    }
    
    # WHO violations
    violation_score = 0
    for col, stats_data in col_stats.get('col_stats', {}).items():
        norm_col = normalize_column_name(col)
        if not norm_col:
            continue
        
        who = WHO_THRESHOLDS[norm_col]
        mean = stats_data.get('mean')
        if mean is None:
            continue
        
        mean = float(mean)
        
        # Check bounds
        if mean < who['min']:
            severity = 'elevated' if who['min'] > 0 else 'low'
            gap = abs(who['min'] - mean)
            safe_min = max(who['min'], 0.01)  # Avoid division by very small number
            deviation_pct = (gap / safe_min) * 100 if safe_min > 0 else 0
            pts = min(20, deviation_pct / 10) if deviation_pct > 0 else 0
            violation_score += pts
            risk['violations'].append({
                'column': col,
                'issue': f"Below safe range ({who['min']})",
                'value': mean,
                'severity': severity,
            })
        elif mean > who['max']:
            safe_max = max(who['max'], 0.01)  # Avoid division by zero
            ratio = mean / safe_max if safe_max > 0 else 1
            pts = min(30, (ratio - 1) * 30) if ratio > 1 else 0
            violation_score += pts
            risk['violations'].append({
                'column': col,
                'issue': f"Exceeds limit ({who['max']})",
                'value': mean,
                'severity': 'critical' if ratio > 2 else 'elevated',
            })
    
    risk['components']['violations'] = violation_score
    
    # Anomaly score
    anomalies = detect_anomalies(df)
    anomaly_pct = anomalies.get('anomaly_rate', 0)
    anomaly_score = min(25, anomaly_pct * 2.5)  # 10% anomalies = 25 pts
    risk['components']['anomalies'] = anomaly_score
    
    # Trend score
    trends = detect_trends(df)
    # Give points for concerning trends
    trend_score = 0
    for col, trend_data in trends.get('per_column', {}).items():
        norm_col = normalize_column_name(col)
        if norm_col:
            who = WHO_THRESHOLDS[norm_col]
            mean = col_stats.get('col_stats', {}).get(col, {}).get('mean')
            if mean and trend_data['trend'] == 'increasing' and float(mean) > who['max']:
                trend_score += 10  # Getting worse
            elif mean and trend_data['trend'] == 'decreasing' and float(mean) < who['min'] and who['min'] > 0:
                trend_score += 10  # Getting worse
    
    risk['components']['trends'] = trend_score
    
    # Data quality score
    quality = assess_data_quality(df, col_stats)
    quality_score = (100 - quality['overall_score']) / 2  # Inverse, capped at 50 pts
    risk['components']['data_quality'] = quality_score
    
    # Total risk
    risk['score'] = min(100, violation_score + anomaly_score + trend_score + quality_score)
    risk['score'] = float(risk['score'])
    
    # Level
    if risk['score'] >= 60:
        risk['level'] = 'critical'
    elif risk['score'] >= 35:
        risk['level'] = 'elevated'
    elif risk['score'] >= 15:
        risk['level'] = 'moderate'
    else:
        risk['level'] = 'low'
    
    # Recommendations
    if risk['level'] == 'critical':
        risk['recommendations'].append('Urgent investigation required. Sample immediately.')
        risk['recommendations'].append('Review and remediate identified violations.')
    elif risk['level'] == 'elevated':
        risk['recommendations'].append('Monitor closely. Sample again soon.')
        risk['recommendations'].append('Investigate trend direction and potential causes.')
    
    if len(risk['violations']) > 3:
        risk['recommendations'].append('Multiple parameters out of range. Broad investigation needed.')
    
    return risk
