"""
Seed rich forensic precedents for resolved cases into the EarlyBird database.
"""

from datetime import datetime, timedelta
import os
import sys

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.models import KnowledgeBase, Case, Anomaly, Transaction, AuditLog


def seed_precedents():
    db = SessionLocal()
    try:
        cases = db.query(Case).all()
        print(f"Database contains {len(cases)} cases.")

        precedents_data = [
            {
                "case_id": "CASE-0389583F",
                "title": "CNP e-Commerce Anomaly on Monitored Card (CARD_10)",
                "category": "Card-Not-Present (CNP) e-Commerce Anomaly",
                "severity": "MEDIUM",
                "decision": "CASE_ACCEPTED",
                "actor_id": "2",
                "verification_methods": [
                    "EWMA Rolling Velocity Baseline Analyzed",
                    "Cardholder Phone / SMS Verification",
                ],
                "content": """# Incident Investigation & Resolution Report — CASE-0389583F

**Classification:** Card-Not-Present (CNP) e-Commerce Anomaly  
**Resolution Decision:** CASE_ACCEPTED (Confirmed Fraud Pattern)  
**Investigating Officer:** Team Lead Sarah (ID: 2)  
**Entity Protected:** CARD_10  

---

## 1. Executive Summary
On 2026-08-08, anomaly detection identified a statistical deviation on card account **CARD_10**. The transaction ($159.28) deviated significantly from the rolling baseline mean ($79.64, Z-Score: 5.00σ). Root cause correlation flagged 3 rapid consecutive online merchant authorizations within a 4-minute window.

## 2. Evidence & Forensic Correlation
- **Deviation Score:** 5.00σ above 30-day EWMA baseline.
- **Velocity Signal:** 3 transactions within 240 seconds at distinct e-commerce merchant endpoints.
- **Terminal Match:** Card-Not-Present e-commerce checkout without 3D-Secure fallback.

## 3. Applied Verification & Resolution
- **Verification Applied:** EWMA Rolling Velocity Baseline Analyzed & Cardholder SMS Callback.
- **Cardholder Outcome:** Cardholder confirmed they did not initiate the second and third authorizations.
- **Action Taken:** Case accepted as true positive fraud. Compromised card blocked and reissued. Merchant terminal added to automated watchlist.
""",
            },
            {
                "case_id": "CASE-15E621C8",
                "title": "High-Frequency Velocity Burst on CARD_2",
                "category": "Rapid High-Frequency Transaction Burst",
                "severity": "LOW",
                "decision": "CASE_ACCEPTED",
                "actor_id": "1",
                "verification_methods": [
                    "Historical Merchant Spending Pattern Match",
                    "EWMA Rolling Velocity Baseline Analyzed",
                ],
                "content": """# Incident Investigation & Resolution Report — CASE-15E621C8

**Classification:** Rapid High-Frequency Transaction Burst  
**Resolution Decision:** CASE_ACCEPTED (Confirmed Script Attack)  
**Investigating Officer:** Reviewer Alex (ID: 1)  
**Entity Protected:** CARD_2  

---

## 1. Executive Summary
Multiple micro-transactions detected within sub-minute intervals targeting gas station POS terminals. The rapid burst pattern matched automated card testing botnet scripts.

## 2. Evidence & Forensic Correlation
- **Z-Score:** 2.32σ velocity deviation.
- **Pattern:** 4 authorizations under $5.00 followed by a $120.00 attempt.
- **MCC Category:** Service Station Automated Fuel Dispensers.

## 3. Applied Verification & Resolution
- **Verification Applied:** Historical Merchant Spending Pattern Match.
- **Action Taken:** Automated rule triggered immediate temporary freeze. Cardholder notified via push notification.
""",
            },
            {
                "case_id": "CASE-DD876322",
                "title": "Compromised POS Terminal at Merchant_12 (CARD_5)",
                "category": "Compromised Terminal / High-Risk Merchant",
                "severity": "HIGH",
                "decision": "CASE_ACCEPTED",
                "actor_id": "2",
                "verification_methods": [
                    "Device & Browser Fingerprint Analyzed",
                    "Merchant 3D-Secure / EMV Verified",
                ],
                "content": """# Incident Investigation & Resolution Report — CASE-DD876322

**Classification:** Compromised Terminal / High-Risk Merchant  
**Resolution Decision:** CASE_ACCEPTED (Point-of-Sale Breach)  
**Investigating Officer:** Team Lead Sarah (ID: 2)  
**Entity Protected:** CARD_5  

---

## 1. Executive Summary
Cross-entity correlation identified a common point of compromise across multiple cards recently used at merchant terminal ID MERCHANT_12. 

## 2. Evidence & Forensic Correlation
- **Z-Score:** 5.00σ severe deviation.
- **Correlated Entities:** 6 distinct cardholders transacted at the same terminal within a 48-hour window prior to unauthorized overseas debits.
- **Location:** Offline physical POS terminal.

## 3. Applied Verification & Resolution
- **Verification Applied:** Device & Browser Fingerprint Analyzed.
- **Action Taken:** Merchant flagged for acquiring bank review; automated alert rule authored to intercept transactions from this terminal.
""",
            },
            {
                "case_id": "CASE-671CC2DC",
                "title": "Geographic Impossibility / Cross-Border Spike (CARD_4)",
                "category": "Geographic Impossibility / IP Conflict",
                "severity": "MEDIUM",
                "decision": "CASE_ACCEPTED",
                "actor_id": "1",
                "verification_methods": [
                    "IP & Geolocation Match Checked",
                    "Cardholder Phone / SMS Verification",
                ],
                "content": """# Incident Investigation & Resolution Report — CASE-671CC2DC

**Classification:** Geographic Impossibility / IP Conflict  
**Resolution Decision:** CASE_ACCEPTED (Simultaneous Geo Locations)  
**Investigating Officer:** Reviewer Alex (ID: 1)  
**Entity Protected:** CARD_4  

---

## 1. Executive Summary
A physical card-present transaction in New York was followed 18 minutes later by an in-person transaction in Tokyo, representing a physical travel impossibility.

## 2. Evidence & Forensic Correlation
- **Distance / Time:** 6,700 miles in 18 minutes.
- **Z-Score:** 2.50σ cross-border anomaly.
- **Origin:** Tokyo physical department store.

## 3. Applied Verification & Resolution
- **Verification Applied:** IP & Geolocation Match Checked.
- **Action Taken:** Foreign transaction reversed; clone counterfeit card deactivated.
""",
            },
            {
                "case_id": "CASE-E7FE08E3",
                "title": "Authorized Luxury High-Ticket Travel Purchase (CARD_8)",
                "category": "Verified Authorized Luxury / High-Ticket Purchase",
                "severity": "LOW",
                "decision": "CASE_REJECTED",
                "actor_id": "2",
                "verification_methods": [
                    "Cardholder Phone / SMS Verification",
                    "Verified Domestic / International Cardholder Travel",
                ],
                "content": """# Incident Investigation & Resolution Report — CASE-E7FE08E3

**Classification:** Verified Authorized Luxury / High-Ticket Purchase  
**Resolution Decision:** CASE_REJECTED (False Positive / Authorized Activity)  
**Investigating Officer:** Team Lead Sarah (ID: 2)  
**Entity Protected:** CARD_8  

---

## 1. Executive Summary
A sudden high-ticket transaction ($4,250.00) flagged for baseline spike at an international resort was verified as legitimate cardholder vacation spend.

## 2. Evidence & Forensic Correlation
- **Z-Score:** 5.00σ (amount spike).
- **MCC:** 7011 (Hotels & Resorts).
- **Cardholder Confirmation:** 3D-Secure biometric authentication completed successfully on cardholder device.

## 3. Applied Verification & Resolution
- **Verification Applied:** Cardholder Phone Verification & Travel Notice Match.
- **Action Taken:** False positive cleared. Rolling baseline mean adjusted upward to prevent future benign re-alerts.
""",
            },
            {
                "case_id": "CASE-BE88C0EA",
                "title": "Account Takeover & Password Reset Probe (CARD_6)",
                "category": "Compromised Credentials / Account Takeover",
                "severity": "HIGH",
                "decision": "CASE_RESOLVED",
                "actor_id": "2",
                "verification_methods": [
                    "Device & Browser Fingerprint Analyzed",
                    "IP & Geolocation Match Checked",
                ],
                "content": """# Incident Investigation & Resolution Report — CASE-BE88C0EA

**Classification:** Compromised Credentials / Account Takeover  
**Resolution Decision:** CASE_RESOLVED (Credential Stuffing Attack)  
**Investigating Officer:** Team Lead Sarah (ID: 2)  
**Entity Protected:** CARD_6  

---

## 1. Executive Summary
Multiple failed authentication attempts followed by a billing address change and immediate electronic gift card purchases.

## 2. Evidence & Forensic Correlation
- **Z-Score:** 2.66σ behavioral deviation.
- **Device Fingerprint:** New unrecognized user-agent routing through a commercial VPN proxy.
- **Target Merchandise:** Digital gift cards / high-liquidity stored value.

## 3. Applied Verification & Resolution
- **Verification Applied:** Device Fingerprinting & IP Telemetry.
- **Action Taken:** Digital account locked, gift card codes invalidated, customer service assisted customer with multi-factor authentication reset.
""",
            },
        ]

        base_time = datetime.utcnow()
        for idx, p in enumerate(precedents_data):
            entry_time = base_time - timedelta(days=idx, hours=idx * 3, minutes=idx * 15)
            entry = db.query(KnowledgeBase).filter(KnowledgeBase.case_id == p["case_id"]).first()
            if not entry:
                entry = KnowledgeBase(
                    case_id=p["case_id"],
                    title=p["title"],
                    content=p["content"],
                    created_at=entry_time,
                )
                db.add(entry)
                db.flush()
            else:
                entry.title = p["title"]
                entry.content = p["content"]
                entry.created_at = entry_time

            case_obj = db.query(Case).filter(Case.case_id == p["case_id"]).first()
            if case_obj:
                case_obj.state = "RESOLVED"
                case_obj.resolved_at = entry_time

                log = db.query(AuditLog).filter(
                    AuditLog.entity_id == p["case_id"],
                    AuditLog.action.in_(["CASE_ACCEPTED", "CASE_REJECTED", "CASE_RESOLVED"]),
                ).first()
                if not log:
                    log = AuditLog(
                        entity_type="case",
                        entity_id=p["case_id"],
                        action=p["decision"],
                        actor_id=p["actor_id"],
                        reason=f"Resolved as {p['category']}",
                        changes={
                            "category": p["category"],
                            "verification_methods": p["verification_methods"],
                            "note": f"Forensic precedent documented for {p['title']}",
                        },
                        created_at=entry_time,
                    )
                    db.add(log)
                else:
                    log.changes = {
                        "category": p["category"],
                        "verification_methods": p["verification_methods"],
                        "note": f"Forensic precedent documented for {p['title']}",
                    }

        db.commit()
        print(f"Successfully seeded {len(precedents_data)} rich forensic precedents across categories!")
    finally:
        db.close()


if __name__ == "__main__":
    seed_precedents()
