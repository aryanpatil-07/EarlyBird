"""
Anomaly scoring using z-score deviation from baseline.

Flags transactions that deviate significantly from entity's established baseline.
Returns score, evidence (JSON), and reasoning for explainability.
"""

import math
from typing import TypedDict


class ScoreResult(TypedDict):
    """Result of z-score anomaly scoring."""
    z_score: float
    baseline_mean: float
    baseline_stddev: float
    transaction_amount: float
    deviation: float
    is_anomalous: bool
    threshold: float
    evidence_dict: dict


def compute_z_score(
    amount: float,
    baseline_mean: float,
    baseline_stddev: float,
    threshold: float = 3.0
) -> ScoreResult:
    """
    Compute z-score deviation from baseline and return evidence.
    
    z-score = (amount - baseline_mean) / baseline_stddev
    
    Anomalous if z_score > threshold (default 3.0 = ~0.27% of normal distribution)
    
    Args:
        amount: Transaction amount
        baseline_mean: Card's baseline average amount
        baseline_stddev: Card's baseline standard deviation
        threshold: Z-score threshold for anomaly (default 3.0)
    
    Returns:
        ScoreResult with z_score, evidence, is_anomalous flag
    """
    
    # Handle edge case: zero variance (all historical amounts identical)
    if baseline_stddev == 0:
        z_score = float('inf') if amount != baseline_mean else 0.0
    else:
        z_score = (amount - baseline_mean) / baseline_stddev
    
    deviation = abs(amount - baseline_mean)
    is_anomalous = z_score > threshold
    
    # Build evidence dict for explainability
    evidence_dict = {
        "baseline_mean": round(baseline_mean, 2),
        "baseline_stddev": round(baseline_stddev, 2),
        "transaction_amount": round(amount, 2),
        "deviation": round(deviation, 2),
        "z_score": round(z_score, 2),
        "threshold": threshold,
        "is_anomalous": is_anomalous,
        "calculation": f"z = ({amount} - {baseline_mean}) / {baseline_stddev} = {z_score:.2f}",
    }
    
    return {
        "z_score": z_score,
        "baseline_mean": baseline_mean,
        "baseline_stddev": baseline_stddev,
        "transaction_amount": amount,
        "deviation": deviation,
        "is_anomalous": is_anomalous,
        "threshold": threshold,
        "evidence_dict": evidence_dict,
    }


def score_transaction(
    amount: float,
    baseline_mean: float,
    baseline_stddev: float,
    threshold: float = 3.0
) -> ScoreResult:
    """
    Public API wrapper for compute_z_score.
    
    Args:
        amount: Transaction amount
        baseline_mean: Entity's baseline mean
        baseline_stddev: Entity's baseline stddev
        threshold: Anomaly threshold (default 3.0)
    
    Returns:
        ScoreResult with full evidence and reasoning
    """
    return compute_z_score(amount, baseline_mean, baseline_stddev, threshold)
