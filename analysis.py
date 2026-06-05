import numpy as np
import pandas as pd
from sklearn.cluster import SpectralClustering
from sklearn.preprocessing import StandardScaler
import shap
from typing import List, Dict, Tuple

class TopologyEngine:
    """
    Advanced Topology Detection using Feature Engineering and Spectral Clustering.
    """
    def __init__(self, n_clusters=3):
        self.n_clusters = n_clusters
        self.scaler = StandardScaler()
        self.model = SpectralClustering(n_clusters=n_clusters, affinity='nearest_neighbors', random_state=42)
        self.explainer = None

    def dtw_distance(self, s1, s2):
        """
        Simple Dynamic Time Warping implementation to handle temporal shifts.
        """
        n, m = len(s1), len(s2)
        dtw_matrix = np.zeros((n + 1, m + 1))
        for i in range(n + 1):
            for j in range(m + 1):
                dtw_matrix[i, j] = np.inf
        dtw_matrix[0, 0] = 0
        
        for i in range(1, n + 1):
            for j in range(1, m + 1):
                cost = abs(s1[i-1] - s2[j-1])
                last_min = min(dtw_matrix[i-1, j], dtw_matrix[i, j-1], dtw_matrix[i-1, j-1])
                dtw_matrix[i, j] = cost + last_min
        
        return dtw_matrix[n, m]

    def extract_features(self, cell_data: Dict[str, pd.DataFrame]) -> pd.DataFrame:
        features = []
        cell_ids = list(cell_data.keys())
        
        # Pre-calculate throughput series for correlation analysis
        throughput_series = {cid: cell_data[cid]['throughput_gbps'].values for cid in cell_ids}
        
        # Identify packet loss events (throughput < 10% of peak)
        loss_events = {}
        for cid in cell_ids:
            series = throughput_series[cid]
            peak = np.max(series)
            # Threshold at 10% as per research requirements
            loss_events[cid] = (series < 0.1 * peak).astype(int)

        for cid in cell_ids:
            df = cell_data[cid]
            series = throughput_series[cid]
            
            # 1. Basic Statistical Features
            mean_tp = np.mean(series)
            peak_tp = np.max(series)
            std_tp = np.std(series)
            burstiness = peak_tp / (mean_tp + 1e-9)
            
            # 2. Temporal Cross-Correlation using DTW
            # DTW is superior to Pearson as it handles non-linear temporal shifts
            dtw_scores = []
            for other_cid in cell_ids:
                if cid == other_cid: continue
                # We use a normalized DTW distance (inverted to represent correlation)
                # To keep it fast for the demo, we use a window of the series
                s1 = series[:50] if len(series) > 50 else series
                s2 = throughput_series[other_cid][:50] if len(throughput_series[other_cid]) > 50 else throughput_series[other_cid]
                
                dist = self.dtw_distance(s1, s2)
                # Convert distance to a similarity score [0, 1]
                similarity = 1 / (1 + dist + 1e-9)
                dtw_scores.append(similarity)
            
            max_dtw_score = np.max(dtw_scores) if dtw_scores else 0
            avg_top_dtw = np.mean(sorted(dtw_scores, reverse=True)[:3]) if len(dtw_scores) >= 3 else max_dtw_score

            # 3. Packet Loss Correlation (Congestion Sync)
            # Measure how many packet loss events are shared with other cells
            # This is a high-confidence indicator of shared physical bottlenecks
            loss_corr_scores = []
            my_loss = loss_events[cid]
            if np.sum(my_loss) > 0:
                for other_cid in cell_ids:
                    if cid == other_cid: continue
                    other_loss = loss_events[other_cid]
                    # Pairwise correlation of binary loss events
                    # Using Jaccard similarity as a robust measure for binary event correlation
                    intersection = np.sum(my_loss & other_loss)
                    union = np.sum(my_loss | other_loss)
                    loss_corr_scores.append(intersection / (union + 1e-9))
            
            max_loss_corr = np.max(loss_corr_scores) if loss_corr_scores else 0

            feat = {
                'cell_id': cid,
                'mean_throughput': mean_tp,
                'peak_throughput': peak_tp,
                'std_throughput': std_tp,
                'burstiness': burstiness,
                'activity_ratio': (series > 0.1).mean(),
                'temporal_correlation': avg_top_dtw,
                'packet_loss_correlation': max_loss_corr
            }
            features.append(feat)
            
        return pd.DataFrame(features)

    def detect_topology(self, features_df: pd.DataFrame) -> pd.DataFrame:
        X = features_df.drop('cell_id', axis=1)
        X_scaled = self.scaler.fit_transform(X)
        
        labels = self.model.fit_predict(X_scaled)
        features_df['link_id'] = labels + 1 # 1-indexed links
        
        # SHAP for Explainability
        # Since SpectralClustering doesn't have a direct SHAP interface easily, 
        # we'll use a surrogate Random Forest to explain the clusters
        from sklearn.ensemble import RandomForestClassifier
        surrogate = RandomForestClassifier(n_estimators=100).fit(X_scaled, labels)
        self.explainer = shap.TreeExplainer(surrogate)
        self.shap_values = self.explainer.shap_values(X_scaled)
        
        return features_df

    def get_explanations(self, features_df: pd.DataFrame) -> Dict:
        # Return SHAP feature importance for the UI
        import numpy as np
        feature_names = [c for c in features_df.columns if c not in ['cell_id', 'link_id']]
        
        # Average absolute SHAP values across all classes
        if isinstance(self.shap_values, list):
            avg_shap = np.mean([np.abs(v).mean(0) for v in self.shap_values], axis=0)
        else:
            avg_shap = np.abs(self.shap_values).mean(0)
            
        return dict(zip(feature_names, avg_shap.tolist()))
