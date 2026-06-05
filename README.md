[![Live Demo](https://img.shields.io/badge/Live-Demo-blue)](https://o-ran-fronthaul-intelligence-platform.onrender.com)
<div align="center">

# Intelligent Fronthaul Network Optimization Platform

AI-Powered O-RAN Topology Detection, Capacity Estimation, Traffic Analytics, and Explainable Network Intelligence

![Python](https://img.shields.io/badge/Python-3.9+-blue)
![FastAPI](https://img.shields.io/badge/FastAPI-Backend-green)
![React](https://img.shields.io/badge/React-Frontend-blue)
![Machine Learning](https://img.shields.io/badge/Machine%20Learning-AI-orange)
![Telecom](https://img.shields.io/badge/O--RAN-Telecommunications-purple)

</div>

---

## Overview

The Intelligent Fronthaul Network Optimization Platform is a full-stack telecommunications analytics system developed to improve visibility, planning, and optimization of O-RAN fronthaul networks.

The platform processes large-scale traffic datasets collected from multiple Radio Units (RUs), automatically identifies network connectivity patterns, estimates optimal fronthaul link capacities using probabilistic techniques, and generates explainable AI insights for intelligent decision-making.

Designed for modern telecom environments, the solution combines data analytics, machine learning, statistical modeling, network visualization, and explainability into a unified platform.

---

## Problem Statement

Modern O-RAN deployments generate large volumes of traffic data that make network planning and optimization increasingly complex.

Network operators require:

- Accurate topology discovery
- Efficient capacity planning
- Congestion prediction
- Resource optimization
- Transparent AI-driven decision support

Traditional approaches often rely on manual analysis and static assumptions.

This platform addresses these challenges through automated topology inference, probabilistic capacity estimation, and explainable analytics.

---

## Key Features

### Automated Topology Detection

- Identifies fronthaul connectivity patterns
- Infers network links from packet-loss correlations
- Maps relationships between Radio Units and transport links

### Intelligent Capacity Estimation

- Monte Carlo-based capacity simulation
- Statistical confidence intervals
- Congestion-aware resource planning
- Buffer-aware network analysis

### Explainable AI (XAI)

- SHAP-based feature importance analysis
- Transparent decision-making support
- Causal relationship discovery
- Model interpretability

### Traffic Analytics

- Throughput analysis
- Congestion monitoring
- Peak utilization detection
- Traffic trend visualization

### Interactive Dashboard

- Real-time analytics visualization
- Capacity insights
- Historical analysis tracking
- Performance monitoring

### Network Visualization

- Interactive topology graphs
- Radio Unit connectivity mapping
- Fronthaul link representation
- Dynamic network exploration

---

## System Architecture

```text
                    ┌─────────────────┐
                    │  Traffic Data   │
                    │ (.dat Files)    │
                    └────────┬────────┘
                             │
                             ▼
                  ┌─────────────────────┐
                  │ Data Processing     │
                  │ & Aggregation       │
                  └────────┬────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼

 ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
 │ Topology    │   │ Capacity    │   │ Traffic     │
 │ Detection   │   │ Estimation  │   │ Analytics   │
 └──────┬──────┘   └──────┬──────┘   └──────┬──────┘
        │                 │                 │
        └──────────┬──────┴─────────┬───────┘
                   ▼                ▼

           ┌─────────────────────┐
           │ Explainable AI      │
           │ SHAP Analytics      │
           └─────────┬───────────┘
                     │
                     ▼

            ┌──────────────────┐
            │ React Dashboard  │
            └──────────────────┘
```

---

## Technology Stack

### Backend

- Python
- FastAPI
- Pandas
- NumPy
- Scikit-Learn
- NetworkX

### Frontend

- React
- Vite
- Tailwind CSS
- React Flow
- Recharts

### Analytics & AI

- SHAP Explainability
- Statistical Modeling
- Monte Carlo Simulation
- Capacity Optimization
- Traffic Correlation Analysis

---

## Project Structure

```text
project-root/
│
├── backend/
│   ├── main.py
│   ├── analysis.py
│   ├── optimization.py
│   ├── parsing.py
│   ├── requirements.txt
│   └── output/
│
├── frontend/
│   ├── src/
│   ├── public/
│   └── package.json
│
├── throughput/
│   └── throughput-cell-*.dat
│
├── packet_stats/
│   └── pkt-stats-cell-*.dat
│
└── README.md
```

---

## Core Functionalities

### Dashboard

Provides a centralized overview of:

- Network utilization
- Capacity recommendations
- Throughput statistics
- Traffic patterns
- Analysis history

### Topology Discovery

Automatically identifies:

- Fronthaul links
- Radio Unit relationships
- Shared infrastructure dependencies
- Connectivity structures

### Capacity Estimation

Supports:

- Buffer-aware estimation
- Loss-constrained optimization
- Statistical confidence bounds
- Monte Carlo simulations

### Explainable AI

Provides:

- Feature importance ranking
- SHAP visualizations
- Causal insights
- Model transparency

### Traffic Analysis

Monitors:

- Throughput variation
- Peak demand
- Congestion events
- Resource utilization

---

## Data Processing Pipeline

1. Load throughput datasets
2. Load packet statistics datasets
3. Normalize network measurements
4. Aggregate traffic information
5. Detect connectivity relationships
6. Infer network topology
7. Estimate optimal capacities
8. Generate explainable insights
9. Visualize results through dashboard

---

## Installation

### Prerequisites

- Python 3.9+
- Node.js 18+
- npm

---

### Backend Setup

```bash
pip install -r requirements.txt

uvicorn main:app --reload
```

Backend will be available at:

```text
http://127.0.0.1:8000
```

---

### Frontend Setup

```bash
cd frontend

npm install

npm run dev
```

Frontend will be available at:

```text
http://localhost:5173
```

---

## Sample Use Cases

### Telecom Network Planning

Optimize O-RAN fronthaul deployments using capacity recommendations.

### Capacity Engineering

Estimate bandwidth requirements under varying traffic conditions.

### Congestion Analysis

Detect and mitigate network bottlenecks.

### Explainable Network Intelligence

Provide transparent AI-driven recommendations for operators.

### Infrastructure Monitoring

Track network performance and utilization trends.

---

## Performance Highlights

- Multi-cell traffic analysis
- Automated topology inference
- Probabilistic capacity estimation
- Explainable AI integration
- Interactive visual analytics
- Telecom-grade architecture

---

## Future Enhancements

- Real-time streaming analytics
- Predictive congestion forecasting
- Reinforcement learning optimization
- Multi-site network orchestration
- Cloud-native deployment support
- Advanced anomaly detection

---

## Contributors

### Team Members

- Chaithanya R Hegde
- Rucha
- Arohi Rawat

---

## License

MIT License

---

## Acknowledgments

This project was developed as part of a telecommunications-focused innovation initiative exploring intelligent O-RAN fronthaul optimization through data analytics, machine learning, statistical modeling, and explainable AI.
