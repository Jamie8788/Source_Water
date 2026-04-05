"""
File parsing service for PDF, DOCX, TXT, CSV, XLSX, JSON
Extracts text and structured data with metadata.
"""
import json
from pathlib import Path
from typing import Tuple, Dict, Any

import pandas as pd
from PyPDF2 import PdfReader  # type: ignore
from docx import Document as DocxDocument  # type: ignore


def parse_pdf(file_path: Path) -> Tuple[str, Dict[str, Any]]:
    """Extract text from PDF."""
    text = []
    metadata = {}
    
    try:
        with open(file_path, 'rb') as f:
            reader = PdfReader(f)
            metadata = {
                'pages': len(reader.pages),
                'title': reader.metadata.title if reader.metadata else None,
                'author': reader.metadata.author if reader.metadata else None,
            }
            for page_num, page in enumerate(reader.pages):
                text.append(page.extract_text())
    except Exception as e:
        raise ValueError(f"PDF parsing failed: {str(e)}")
    
    return "\n\n".join(text), metadata


def parse_docx(file_path: Path) -> Tuple[str, Dict[str, Any]]:
    """Extract text from DOCX."""
    try:
        doc = DocxDocument(file_path)
        text = []
        for para in doc.paragraphs:
            if para.text.strip():
                text.append(para.text)
        
        metadata = {
            'core_properties': {
                'title': doc.core_properties.title or None,
                'author': doc.core_properties.author or None,
                'created': str(doc.core_properties.created) if doc.core_properties.created else None,
            }
        }
        
        return "\n".join(text), metadata
    except Exception as e:
        raise ValueError(f"DOCX parsing failed: {str(e)}")


def parse_csv(file_path: Path) -> Tuple[str, Dict[str, Any]]:
    """Parse CSV into dataframe + generate summary text."""
    try:
        df = pd.read_csv(file_path)
        
        # Generate text summary
        text_parts = [f"CSV Data Summary ({len(df)} rows, {len(df.columns)} columns)\n"]
        text_parts.append("Columns: " + ", ".join(df.columns.tolist()))
        text_parts.append("\nFirst rows:\n")
        text_parts.append(df.head(10).to_string())
        
        # Extract stats
        metadata = extract_dataframe_stats(df)
        metadata['file_type'] = 'csv'
        metadata['shape'] = {'rows': len(df), 'cols': len(df.columns)}
        
        return "\n".join(text_parts), metadata
        
    except Exception as e:
        raise ValueError(f"CSV parsing failed: {str(e)}")


def parse_xlsx(file_path: Path) -> Tuple[str, Dict[str, Any]]:
    """Parse XLSX into dataframe + generate summary text."""
    try:
        # Read all sheets
        xls = pd.ExcelFile(file_path)
        dfs = {sheet: pd.read_excel(file_path, sheet_name=sheet) for sheet in xls.sheet_names}
        
        text_parts = [f"Excel Workbook ({len(dfs)} sheets)\n"]
        all_data = []
        
        for sheet_name, df in dfs.items():
            text_parts.append(f"\n--- Sheet: {sheet_name} ---")
            text_parts.append(f"Rows: {len(df)}, Columns: {len(df.columns)}")
            text_parts.append("Columns: " + ", ".join(df.columns.tolist()))
            text_parts.append(df.head(5).to_string())
            all_data.append(df)
        
        # Combine all sheets for stats
        combined_df = pd.concat(all_data, ignore_index=True) if all_data else pd.DataFrame()
        metadata = extract_dataframe_stats(combined_df)
        metadata['file_type'] = 'xlsx'
        metadata['sheets'] = xls.sheet_names
        metadata['shape'] = {'rows': len(combined_df), 'cols': len(combined_df.columns)}
        
        return "\n".join(text_parts), metadata
        
    except Exception as e:
        raise ValueError(f"XLSX parsing failed: {str(e)}")


def parse_json(file_path: Path) -> Tuple[str, Dict[str, Any]]:
    """Parse JSON file."""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # Try to convert to dataframe if it's a list of objects
        text_parts = ["JSON Data:\n"]
        
        if isinstance(data, list) and len(data) > 0 and isinstance(data[0], dict):
            df = pd.DataFrame(data)
            text_parts.append(f"Records: {len(df)}, Fields: {len(df.columns)}")
            text_parts.append("Fields: " + ", ".join(df.columns.tolist()))
            text_parts.append(df.head(10).to_string())
            metadata = extract_dataframe_stats(df)
            metadata['shape'] = {'rows': len(df), 'cols': len(df.columns)}
        else:
            text_parts.append(json.dumps(data, indent=2)[:2000])  # First 2000 chars
            metadata = {'record_count': len(data) if isinstance(data, list) else 1}
        
        metadata['file_type'] = 'json'
        return "\n".join(text_parts), metadata
        
    except Exception as e:
        raise ValueError(f"JSON parsing failed: {str(e)}")


def parse_txt(file_path: Path) -> Tuple[str, Dict[str, Any]]:
    """Parse plain text file."""
    try:
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            text = f.read()
        
        metadata = {
            'file_type': 'txt',
            'length': len(text),
            'lines': len(text.split('\n')),
        }
        
        return text, metadata
        
    except Exception as e:
        raise ValueError(f"Text parsing failed: {str(e)}")


def extract_dataframe_stats(df: pd.DataFrame) -> Dict[str, Any]:
    """Extract statistics from a pandas DataFrame."""
    stats = {
        'col_stats': {},
        'summary': {},
    }
    
    for col in df.columns:
        col_data = df[col]
        col_stats = {
            'type': str(col_data.dtype),
            'missing': int(col_data.isna().sum()),
            'missing_pct': float(col_data.isna().sum() / len(df) * 100),
        }
        
        # Numeric stats
        if pd.api.types.is_numeric_dtype(col_data):
            numeric = pd.to_numeric(col_data, errors='coerce')
            col_stats.update({
                'mean': float(numeric.mean()) if not numeric.isna().all() else None,
                'median': float(numeric.median()) if not numeric.isna().all() else None,
                'std': float(numeric.std()) if not numeric.isna().all() else None,
                'min': float(numeric.min()) if not numeric.isna().all() else None,
                'max': float(numeric.max()) if not numeric.isna().all() else None,
                'q25': float(numeric.quantile(0.25)) if not numeric.isna().all() else None,
                'q75': float(numeric.quantile(0.75)) if not numeric.isna().all() else None,
            })
            
            # Detect outliers using IQR
            q25 = numeric.quantile(0.25)
            q75 = numeric.quantile(0.75)
            iqr = q75 - q25
            outliers = ((numeric < (q25 - 1.5 * iqr)) | (numeric > (q75 + 1.5 * iqr))).sum()
            col_stats['outliers'] = int(outliers)
        
        # Categorical stats
        else:
            col_stats['unique'] = int(col_data.nunique())
            col_stats['top_values'] = col_data.value_counts().head(5).to_dict()
        
        stats['col_stats'][col] = col_stats
    
    stats['summary'] = {
        'total_rows': len(df),
        'total_cols': len(df.columns),
        'memory_usage_mb': float(df.memory_usage(deep=True).sum() / 1024 / 1024),
    }
    
    return stats


def parse_file(file_path: Path) -> Tuple[str, Dict[str, Any]]:
    """Auto-detect file type and parse accordingly."""
    suffix = file_path.suffix.lower()
    
    if suffix == '.pdf':
        return parse_pdf(file_path)
    elif suffix == '.docx':
        return parse_docx(file_path)
    elif suffix == '.xlsx':
        return parse_xlsx(file_path)
    elif suffix == '.csv':
        return parse_csv(file_path)
    elif suffix == '.json':
        return parse_json(file_path)
    elif suffix == '.txt':
        return parse_txt(file_path)
    else:
        # Try as text
        return parse_txt(file_path)
