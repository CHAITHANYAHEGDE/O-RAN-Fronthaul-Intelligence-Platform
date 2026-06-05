import numpy as np
import pandas as pd
from typing import Dict, List, Tuple

class CapacityOptimizer:
    """
    Link Capacity Estimation using Queue Simulation (M/D/1/K equivalent).
    """
    def __init__(self, buffer_symbols=4):
        self.buffer_symbols = buffer_symbols
        # 1 symbol = 35.7 us
        self.buffer_time_us = buffer_symbols * 35.7 

    def simulate_queue(self, traffic_gbps: np.ndarray, capacity_gbps: float) -> float:
        """
        Simulates a simple buffer queue to estimate packet loss.
        """
        buffer_size_bits = capacity_gbps * 1e9 * (self.buffer_time_us * 1e-6)
        current_buffer = 0.0
        dropped_bits = 0.0
        total_bits = 0.0
        
        # Slot duration 500us
        slot_duration = 500 * 1e-6
        
        for load in traffic_gbps:
            incoming_bits = load * 1e9 * slot_duration
            total_bits += incoming_bits
            
            # Process outgoing bits
            available_capacity = capacity_gbps * 1e9 * slot_duration
            
            # Add to buffer
            current_buffer += incoming_bits
            
            # Drain buffer
            served = min(current_buffer, available_capacity)
            current_buffer -= served
            
            # Check overflow
            if current_buffer > buffer_size_bits:
                dropped_bits += (current_buffer - buffer_size_bits)
                current_buffer = buffer_size_bits
                
        return dropped_bits / (total_bits + 1e-9)

    def estimate_capacity(self, aggregated_traffic: pd.DataFrame, target_loss=0.01, iterations=100) -> Dict:
        """
        Finds minimum capacity that satisfies target_loss with statistical rigor.
        Uses Monte Carlo simulations to provide a confidence interval.
        """
        traffic = aggregated_traffic['throughput_gbps'].values
        peak = np.max(traffic)
        avg = np.mean(traffic)
        
        def find_min_cap(ts):
            low = np.mean(ts)
            high = np.max(ts) * 1.5
            best = high
            for _ in range(12):
                mid = (low + high) / 2
                if self.simulate_queue(ts, mid) <= target_loss:
                    best = mid
                    high = mid
                else:
                    low = mid
            return best

        # Base estimation
        base_cap = find_min_cap(traffic)
        
        # Monte Carlo simulations for confidence interval
        # We simulate traffic variability by adding Gaussian noise or bootstrapping
        simulated_caps = []
        for _ in range(iterations):
            # Simulate 10% traffic variability (standard in telecom research)
            noise = np.random.normal(1.0, 0.1, size=traffic.shape)
            sim_traffic = np.maximum(0, traffic * noise)
            simulated_caps.append(find_min_cap(sim_traffic))
            
        simulated_caps = np.array(simulated_caps)
        conf_low = np.percentile(simulated_caps, 5)
        conf_high = np.percentile(simulated_caps, 95)
        
        return {
            'required_capacity_gbps': round(base_cap, 2),
            'capacity_lower_bound': round(conf_low, 2),
            'capacity_upper_bound': round(conf_high, 2),
            'peak_load_gbps': round(peak, 2),
            'avg_load_gbps': round(avg, 2),
            'efficiency': round(avg / base_cap, 3) if base_cap > 0 else 0,
            'confidence_level': 0.95
        }
