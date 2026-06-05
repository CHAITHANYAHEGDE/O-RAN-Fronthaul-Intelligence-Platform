import pandas as pd
import numpy as np
from typing import List, Dict, Any
import io

def parse_dat_file(content: str, filename: str) -> pd.DataFrame:
    """
    Parses symbol-level .dat files.
    Expected columns: symbol_index, packet_count, throughput_bytes
    """
    try:
        # Assuming space-separated values based on typical .dat logs
        df = pd.read_csv(io.StringIO(content), sep=r'\s+', names=['symbol_index', 'packet_count', 'throughput_bytes'])
        df['cell_id'] = filename.split('.')[0]
        return df
    except Exception as e:
        print(f"Error parsing {filename}: {e}")
        return pd.DataFrame()

def aggregate_to_slots(df: pd.DataFrame) -> pd.DataFrame:
    """
    Aggregates 14 symbols into 1 slot.
    1 slot = 500 microseconds.
    """
    if df.empty:
        return df
    
    # Create slot index
    df['slot_index'] = df['symbol_index'] // 14
    
    slot_df = df.groupby(['cell_id', 'slot_index']).agg({
        'packet_count': 'sum',
        'throughput_bytes': 'sum'
    }).reset_index()
    
    # Calculate Mbps (Bytes * 8 / 500us) -> (Bytes * 8 / 0.0005) = Bytes * 16000 bps
    # To Gbps: Bytes * 16000 / 1e9
    slot_df['throughput_gbps'] = (slot_df['throughput_bytes'] * 8) / (500 * 1e-6 * 1e9)
    
    return slot_df
