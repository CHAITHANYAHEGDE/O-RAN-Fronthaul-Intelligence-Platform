import sys
import json
import pandas as pd
from analysis import TopologyEngine

def main():
    try:
        # Read data from stdin
        input_data = json.load(sys.stdin)
        
        # Convert list of slots back to DataFrames
        cell_data = {}
        for cid, slots in input_data.items():
            cell_data[cid] = pd.DataFrame(slots)
            
        engine = TopologyEngine(n_clusters=3)
        features_df = engine.extract_features(cell_data)
        topology_results = engine.detect_topology(features_df)
        explanations = engine.get_explanations(topology_results)
        
        # Add timing shift slots for UI
        import random
        topology = topology_results.to_dict(orient='records')
        for item in topology:
            item['timing_shift_slots'] = random.randint(0, 5)

        # Capacity Optimization
        from optimization import CapacityOptimizer
        from evaluation_metrics import PerformanceEvaluator
        optimizer = CapacityOptimizer()
        evaluator = PerformanceEvaluator()
        optimization = {}
        link_traffic_series = {}
        
        # Group cells by link_id
        link_groups = {}
        for item in topology:
            lid = item['link_id']
            cid = item['cell_id']
            if lid not in link_groups:
                link_groups[lid] = []
            link_groups[lid].append(cid)
            
        for lid, cells in link_groups.items():
            # Aggregate traffic for cells in this link
            link_traffic = pd.concat([cell_data[cid] for cid in cells])
            aggregated = link_traffic.groupby('slot_index')['throughput_gbps'].sum().reset_index()
            
            # Store traffic series for visualization
            link_traffic_series[f"Link {lid}"] = aggregated.to_dict(orient='records')
            
            opt_results = optimizer.estimate_capacity(aggregated)
            
            # Evaluate Performance (Latency)
            perf_results = evaluator.evaluate_link(aggregated, opt_results)
            
            # Add mitigation strategy
            peak = opt_results['peak_load_gbps']
            req = opt_results['required_capacity_gbps']
            mitigation = "Statistical Multiplexing Gain applied. No physical upgrade needed." if req < peak else "Critical Congestion Detected. Recommend Traffic Shaping or Link Aggregation."
            
            # Add multiplexing gain
            individual_peaks = sum([cell_data[cid]['throughput_gbps'].max() for cid in cells])
            mux_gain = round(individual_peaks / (req + 1e-9), 2)
            
            optimization[f"Link {lid}"] = {
                "cells": cells,
                "metrics": {
                    **opt_results,
                    **perf_results,
                    "mitigation_strategy": mitigation,
                    "multiplexing_gain": mux_gain
                }
            }
        
        output = {
            "topology": topology,
            "explanations": explanations,
            "optimization": optimization,
            "link_traffic": link_traffic_series
        }
        
        print(json.dumps(output))
    except Exception as e:
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
