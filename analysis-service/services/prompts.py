"""
Prompt engineering for intelligent, concise AI responses.
Ensures that "short" doesn't mean "dumb" - maintains signal density and grounding.
"""
from typing import Optional, List, Dict, Any


def get_analysis_system_prompt() -> str:
    """
    System prompt for /ask endpoint.
    ENFORCES: Extreme brevity while maintaining intelligence and accuracy.
    """
    return """You are a water quality expert AI. You MUST respond with EXTREME BREVITY.

ABSOLUTE RULES:
1. MAXIMUM 3 sentences per response (unless explicitly asked for more)
2. NO fluff, filler, or generic statements
3. Always include specific numbers/values, never vague language
4. Start with the MOST CRITICAL finding
5. One fact per sentence
6. NO apologies, disclaimers, or meta-commentary
7. NO repetition

EXAMPLE GOOD RESPONSE: "pH is 7.8 (exceeds 6.5-8.5 safe range by 0.2 units). This correlates with 3 violations detected in the dataset. Recommend immediate alkalinity adjustment."

EXAMPLE BAD RESPONSE: "The water quality data shows several concerning issues. Based on the analysis, there appear to be some violations in the dataset. You may want to investigate further."

Be a sniper. Precision over volume."""


def get_ask_user_prompt(query: str, retrieved_chunks: List[str], stats: Dict[str, Any], 
                        anomalies: Dict[str, Any], risk: Dict[str, Any]) -> str:
    """
    User prompt for /ask endpoint combining RAG + ML results.
    """
    context_parts = []
    
    # Add retrieved chunks
    if retrieved_chunks:
        context_parts.append("=== RETRIEVED DOCUMENT CONTENT ===")
        for i, chunk in enumerate(retrieved_chunks, 1):
            context_parts.append(f"[Document {i}]: {chunk[:300]}...")
    
    # Add computed stats
    if stats and stats.get('col_stats'):
        context_parts.append("\n=== DATA STATISTICS ===")
        for col, col_data in stats['col_stats'].items():
            if col_data.get('mean') is not None:
                context_parts.append(f"{col}: mean={col_data.get('mean'):.2f}, "
                                   f"std={col_data.get('std'):.2f}, "
                                   f"n_samples={stats.get('summary', {}).get('total_rows', 'N/A')}")
    
    # Add anomalies
    if anomalies and anomalies.get('anomaly_rate'):
        context_parts.append(f"\n=== ANOMALIES ===")
        context_parts.append(f"Anomaly rate: {anomalies.get('anomaly_rate'):.1f}%")
        if anomalies.get('per_column'):
            for col, col_anom in anomalies['per_column'].items():
                if col_anom.get('outlier_count', 0) > 0:
                    context_parts.append(f"{col}: {col_anom['outlier_count']} outliers ({col_anom.get('outlier_pct', 0):.1f}%)")
    
    # Add risk assessment
    if risk:
        context_parts.append(f"\n=== RISK ASSESSMENT ===")
        context_parts.append(f"Overall Risk: {risk.get('level', 'unknown').upper()} (score: {risk.get('score', 0):.0f}/100)")
        if risk.get('violations'):
            context_parts.append("Violations:")
            for v in risk['violations'][:3]:
                context_parts.append(f"  - {v['column']}: {v['issue']} (value: {v.get('value'):.2f})")
    
    context = "\n".join(context_parts)

    if not context.strip():
        return f"""The user asked: "{query}"

There is no usable content in this document (it may be empty, contain only "null", or could not be parsed).

Respond with exactly: "This document appears to be empty or could not be parsed. Please upload a file with actual water quality data." Do not add anything else."""

    return f"""Answer this question with ABSOLUTE BREVITY (max 3 sentences). ONLY use the data provided below — do NOT invent or assume any values not present.

QUESTION: {query}

{context}

RESPONSE FORMAT:
- Sentence 1: Direct answer with specific number/value from the data above
- Sentence 2: Context or impact
- Sentence 3: Recommendation or conclusion (optional)

CRITICAL: If the data above does not contain enough information to answer, say "Insufficient data in this document to answer that question." Do not fabricate numbers."""


def get_compare_prompt(file1_name: str, file1_stats: Dict, file1_risk: Dict,
                       file2_name: str, file2_stats: Dict, file2_risk: Dict) -> str:
    """
    Prompt for comparing two datasets - EXTREME BREVITY VERSION.
    """
    return f"""Compare these datasets in 2-3 sentences MAX:

{file1_name}: Risk {file1_risk.get('level', 'unknown').upper()} ({file1_risk.get('score', 0):.0f}/100), {len(file1_risk.get('violations', []))} violations
{file2_name}: Risk {file2_risk.get('level', 'unknown').upper()} ({file2_risk.get('score', 0):.0f}/100), {len(file2_risk.get('violations', []))} violations

Which is healthier? Why? What's the key difference?"""


def get_anomaly_explanation_prompt(file_name: str, anomalies: Dict, stats: Dict) -> str:
    """
    Explain anomalies in 2 sentences MAX.
    """
    anomaly_details = []
    if anomalies.get('per_column'):
        for col, col_anom in list(anomalies['per_column'].items())[:3]:
            if col_anom.get('outlier_count', 0) > 0:
                anomaly_details.append(
                    f"{col}: {col_anom['outlier_count']} outliers "
                    f"({col_anom.get('outlier_pct', 0):.1f}%)"
                )
    
    return f"""Explain in 2 sentences: {anomalies.get('anomaly_rate', 0):.1f}% of data is anomalous.
Specifics: {', '.join(anomaly_details)}
What does this mean? Should we be concerned?"""


def get_report_prompt(file_name: str, stats: Dict, risk: Dict, anomalies: Dict, 
                      trends: Dict, quality: Dict) -> str:
    """
    Prompt for generating an executive summary for the report.
    """
    return f"""Generate a brief executive summary for this water quality analysis report:

FILE: {file_name}
OVERVIEW:
- Samples Analyzed: {stats.get('summary', {}).get('total_rows', 'N/A')}
- Columns: {stats.get('summary', {}).get('total_cols', 'N/A')}
- Data Quality Score: {quality.get('overall_score', 0):.0f}/100

RISK ASSESSMENT: {risk.get('level', 'unknown').upper()} ({risk.get('score', 0):.0f}/100, {len(risk.get('violations', []))} violations)

Write a 100-word executive summary: overall status, critical findings, required actions."""


def get_insights_prompt(stats: Dict, risk: Dict, anomalies: Dict, trends: Dict) -> str:
    """
    Prompt for generating key insights - 3 bullet points MAX.
    """
    return f"""Risk: {risk.get('level', 'unknown').upper()} ({risk.get('score', 0):.0f}/100). Violations: {len(risk.get('violations', []))}. Anomalies: {anomalies.get('anomaly_rate', 0):.1f}%.

Generate 3 bullet-point insights. Each: ONE sentence, specific number, actionable."""
