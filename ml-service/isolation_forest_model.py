import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
from typing import List, Tuple
import warnings
warnings.filterwarnings('ignore')

FEATURE_NAMES = ["amount", "hour", "dayOfWeek", "ipChanged", "deviceChanged", "velocityScore", "userAvgAmount", "totalTransactions"]

class IsolationForestModel:
    def __init__(self, user_id: str):
        self.user_id = user_id
        self.model = IsolationForest(
            n_estimators=100,
            contamination=0.1,
            random_state=42,
            max_samples='auto',
            bootstrap=False
        )
        self.scaler = StandardScaler()
        self.samples: List[np.ndarray] = []
        self.labels: List[bool] = []
        self.trained = False
        self.threshold = 0.5
        self.adaptive_thresholds = {
            "maxDailyTransactions": 10,
            "maxTransactionAmount": 10000,
            "maxHourlyTransactions": 3,
            "adaptiveScore": 0.5
        }
        # Seed with synthetic normal data for cold start
        self._seed_with_synthetic_data()

    def _seed_with_synthetic_data(self):
        """Generate synthetic normal transactions for cold start"""
        np.random.seed(42)
        # Simulate normal business hours transactions
        for _ in range(20):
            sample = np.array([
                np.random.uniform(100, 5000),   # amount
                np.random.choice(range(9, 22)),  # business hours
                np.random.randint(0, 7),          # day of week
                0.0,                              # ip not changed
                0.0,                              # device not changed
                np.random.uniform(0, 0.2),       # low velocity
                np.random.uniform(500, 3000),    # avg amount
                np.random.randint(1, 50)         # total transactions
            ])
            self.samples.append(sample)
            self.labels.append(True)
        self.retrain()

    def add_sample(self, features: np.ndarray, is_legitimate: bool):
        self.samples.append(features.flatten())
        self.labels.append(is_legitimate)
        self._update_adaptive_thresholds()

    def retrain(self):
        if len(self.samples) < 5:
            return
        X = np.array(self.samples)
        X_scaled = self.scaler.fit_transform(X)
        self.model.fit(X_scaled)
        self.trained = True
        self._update_threshold()

    def predict(self, features: np.ndarray) -> dict:
        if not self.trained:
            return {"score": 0.3, "decision": "normal", "confidence": 0.5, "threshold": 0.5, "training_size": 0}

        try:
            X = features.reshape(1, -1)
            X_scaled = self.scaler.transform(X)
            # Isolation Forest anomaly score (-1 = anomaly, 1 = normal)
            raw_score = self.model.decision_function(X_scaled)[0]
            prediction = self.model.predict(X_scaled)[0]

            # Normalize score to 0-1 (higher = more anomalous)
            normalized_score = max(0, min(1, (0.5 - raw_score) / 1.0))

            decision = "anomaly" if prediction == -1 or normalized_score > self.threshold else "normal"
            confidence = abs(raw_score) / max(abs(raw_score) + 0.1, 0.1)
            confidence = max(0.4, min(0.95, confidence))

            return {
                "score": normalized_score,
                "decision": decision,
                "confidence": confidence,
                "threshold": self.threshold,
                "training_size": len(self.samples)
            }
        except Exception as e:
            return {"score": 0.2, "decision": "normal", "confidence": 0.5, "threshold": 0.5, "training_size": len(self.samples)}

    def _update_threshold(self):
        """Adaptive threshold based on user's transaction history"""
        if len(self.samples) < 10:
            return
        legit_count = sum(1 for l in self.labels if l)
        fraud_ratio = 1 - (legit_count / len(self.labels))
        # More transactions = lower contamination = tighter threshold
        if len(self.samples) > 50:
            self.threshold = 0.35
        elif len(self.samples) > 20:
            self.threshold = 0.42
        else:
            self.threshold = 0.5
        self.model.set_params(contamination=max(0.05, min(0.3, fraud_ratio + 0.05)))

    def _update_adaptive_thresholds(self):
        """Learn user-specific limits from legitimate transactions"""
        legit_samples = [s for s, l in zip(self.samples, self.labels) if l]
        if len(legit_samples) < 5:
            return
        amounts = [s[0] for s in legit_samples]
        # Set threshold at 95th percentile of legitimate amounts
        p95_amount = np.percentile(amounts, 95)
        # Adapt daily transaction limit based on user behavior
        avg_daily = len(legit_samples) / max(1, len(set([int(s[2]) for s in legit_samples])))

        self.adaptive_thresholds = {
            "maxDailyTransactions": max(10, int(avg_daily * 2.5)),
            "maxTransactionAmount": max(10000, int(p95_amount * 2)),
            "maxHourlyTransactions": max(3, int(avg_daily * 0.5) + 2),
            "adaptiveScore": float(self.threshold)
        }

    def get_adaptive_thresholds(self) -> dict:
        return self.adaptive_thresholds

    def get_sample_count(self) -> int:
        return len(self.samples)

    def is_trained(self) -> bool:
        return self.trained
