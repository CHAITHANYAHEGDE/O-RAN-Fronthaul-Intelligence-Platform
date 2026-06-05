import numpy as np
import pandas as pd
from typing import Dict, List

class PerformanceEvaluator:
    """
    Evaluates Fronthaul Network Performance Metrics.
    """
    def __init__(self, slot_duration_us=500):
        self.slot_duration_us = slot_duration_us

    def estimate_slot_latency(self, traffic_series: np.ndarray, capacity_gbps: float) -> float:
        """
        Estimates average slot-level latency per link.
        Latency is derived from queuing delay: (Average Buffer Occupancy / Capacity).
        Plus a base propagation/processing delay.
        """
        if capacity_gbps <= 0:
            return 0.0
            
        # 1 symbol = 35.7 us, 4 symbols buffer = 142.8 us
        buffer_size_bits = capacity_gbps * 1e9 * (142.8 * 1e-6)
        current_buffer = 0.0
        total_delay_us = 0.0
        total_bits = 0.0
        
        slot_duration = self.slot_duration_us * 1e-6
        
        for load in traffic_series:
            incoming_bits = load * 1e9 * slot_duration
            total_bits += incoming_bits
            
            # Process outgoing bits
            available_capacity = capacity_gbps * 1e9 * slot_duration
            
            # Add to buffer
            current_buffer += incoming_bits
            
            # Queuing delay for this slot (Little's Law approximation)
            # Delay = Buffer / Capacity
            slot_delay = (current_buffer / (capacity_gbps * 1e9)) * 1e6 # in us
            total_delay_us += slot_delay * incoming_bits
            
            # Drain buffer
            served = min(current_buffer, available_capacity)
            current_buffer -= served
            
            # Cap buffer
            if current_buffer > buffer_size_bits:
                current_buffer = buffer_size_bits
                
        avg_latency = total_delay_us / (total_bits + 1e-9)
        # Base delay: 1 slot for processing + propagation (approx 500us)
        return round(500 + avg_latency, 2)

    def evaluate_link(self, aggregated_traffic: pd.DataFrame, capacity_results: Dict) -> Dict:
        """
        Provides a comprehensive performance assessment for a link.
        """
        traffic = aggregated_traffic['throughput_gbps'].values
        capacity = capacity_results['required_capacity_gbps']
        
        avg_latency = self.estimate_slot_latency(traffic, capacity)
        
        return {
            'avg_slot_latency_us': avg_latency,
            'jitter_estimate_us': round(avg_latency * 0.15, 2), # Simulated jitter
            'utilization_score': round(capacity_results['efficiency'] * 100, 1)
        }
