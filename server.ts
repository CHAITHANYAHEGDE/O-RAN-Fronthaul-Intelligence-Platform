import { fileURLToPath } from 'url';
import path from "path";
import express from "express";
import { createServer as createViteServer } from "vite";
import multer from "multer";
import fs from "fs";
import Database from "better-sqlite3";
import { spawn } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Database for History
const db = new Database("history.db");
db.exec(`
  CREATE TABLE IF NOT EXISTS analysis_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    name TEXT,
    cells_count INTEGER,
    topology_data TEXT,
    optimization_data TEXT,
    explanations_data TEXT,
    traffic_data TEXT
  )
`);

// Migration: Ensure traffic_data column exists if table was created in older version
try {
  db.exec("ALTER TABLE analysis_history ADD COLUMN traffic_data TEXT");
} catch (e) {
  // Column likely already exists
}

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

// Force HTTPS on Render (Render sets x-forwarded-proto header)
app.use((req, res, next) => {
  if (process.env.NODE_ENV === 'production' && req.headers['x-forwarded-proto'] !== 'https') {
    return res.redirect(301, 'https://' + req.headers.host + req.url);
  }
  next();
});

// Security headers
app.use((req, res, next) => {
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString(), secure: req.headers['x-forwarded-proto'] === 'https' });
});

let processedData: any = {};

// --- Advanced Research-Grade Logic ---

app.post("/api/upload", upload.array("files"), (req: express.Request, res: express.Response) => {
  const files = req.files as Express.Multer.File[];
  if (!files || files.length === 0) return res.status(400).json({ error: "No files uploaded" });

  processedData = {};
  
  files.forEach(file => {
    const content = file.buffer.toString('utf-8');
    const lines = content.trim().split('\n');
    
    const dataLines = lines.filter(line => {
      const parts = line.trim().split(/\s+/);
      return parts.length >= 2 && !isNaN(Number(parts[0]));
    });

    const data = dataLines.map(line => {
      const parts = line.trim().split(/\s+/).map(Number);
      if (parts.length === 2) {
        return { 
          symbol: parts[0] || 0, 
          packets: 0, 
          bytes: parts[1] || 0 
        };
      } else {
        return { 
          symbol: parts[0] || 0, 
          packets: parts[1] || 0, 
          bytes: parts[2] || 0 
        };
      }
    });
    
    const slots: any[] = [];
    for (let i = 0; i < data.length; i += 14) {
      const chunk = data.slice(i, i + 14);
      const packets = chunk.reduce((acc, curr) => acc + curr.packets, 0);
      const bytes = chunk.reduce((acc, curr) => acc + curr.bytes, 0);
      const throughput_gbps = (bytes * 16000) / 1e9;
      slots.push({ slot_index: i / 14, packets, bytes, throughput_gbps });
    }
    
    const keyName = file.originalname.replace('.dat', '').replace(/[^a-zA-Z0-9_-]/g, '');
    if (keyName === '__proto__' || keyName === 'constructor' || keyName === 'prototype') {
      console.warn("Security warning: Blocked prototype pollution attempt:", keyName);
      return;
    }
    processedData[keyName] = slots;
    console.log("Processed:", file.originalname);
  });
  
  res.json({ status: "success", cells_processed: Object.keys(processedData) });
});

app.get("/api/analyze", (req, res) => {
  if (Object.keys(processedData).length === 0) return res.status(400).json({ error: "No data" });

  // Call Python bridge for advanced ML analysis
  const pythonProcess = spawn('python3', ['run_analysis.py']);
  
  let outputData = '';
  let errorData = '';

  pythonProcess.stdout.on('data', (data) => {
    outputData += data.toString();
  });

  pythonProcess.stderr.on('data', (data) => {
    errorData += data.toString();
  });

  pythonProcess.on('close', (code) => {
    if (code !== 0) {
      console.error(`Python process failed with code ${code}: ${errorData}`);
      return res.status(500).json({ error: "ML Analysis failed", details: errorData });
    }

    try {
      const result = JSON.parse(outputData);
      const topology = result.topology;
      const explanations = result.explanations;
      const optimization = result.optimization;
      const link_traffic = result.link_traffic;

      // Save to history
      const stmt = db.prepare(`
        INSERT INTO analysis_history (name, cells_count, topology_data, optimization_data, explanations_data, traffic_data)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        `Analysis ${new Date().toLocaleString()}`,
        Object.keys(processedData).length,
        JSON.stringify(topology),
        JSON.stringify(optimization),
        JSON.stringify(explanations),
        JSON.stringify(link_traffic)
      );

      console.log("Cells:", Object.keys(processedData));
      console.log("Cell count:", Object.keys(processedData).length);

      res.json({
        status: "success",
        cells_processed: Object.keys(processedData),
        topology,
        explanations,
        optimization,
        link_traffic
      });
    } catch (e) {
      res.status(500).json({ error: "Failed to parse ML results" });
    }
  });

  // Send data to Python
  pythonProcess.stdin.write(JSON.stringify(processedData));
  pythonProcess.stdin.end();
});

app.post("/api/load-demo", (req, res) => {
  try {
    // Pre-computed realistic O-RAN fronthaul ML results
    // Bypasses Python entirely for cloud deployment reliability
    const topology = [
      { cell_id: "throughput-cell-1", link_id: 1, mean_throughput: 0.00382, std_throughput: 0.00091, peak_throughput: 0.00971, packet_loss_rate: 0.018, timing_shift_slots: 2 },
      { cell_id: "throughput-cell-2", link_id: 1, mean_throughput: 0.00214, std_throughput: 0.00052, peak_throughput: 0.00437, packet_loss_rate: 0.011, timing_shift_slots: 1 },
      { cell_id: "throughput-cell-3", link_id: 2, mean_throughput: 0.00521, std_throughput: 0.00143, peak_throughput: 0.01284, packet_loss_rate: 0.024, timing_shift_slots: 3 },
    ];

    const explanations = {
      mean_throughput: 0.412,
      std_throughput: 0.289,
      peak_throughput: 0.178,
      packet_loss_rate: 0.121,
    };

    const optimization: Record<string, any> = {
      "Link 1": {
        cells: ["throughput-cell-1", "throughput-cell-2"],
        metrics: {
          peak_load_gbps: 0.014,
          required_capacity_gbps: 0.011,
          avg_latency_ms: 0.42,
          p99_latency_ms: 1.87,
          mitigation_strategy: "Statistical Multiplexing Gain applied. No physical upgrade needed.",
          multiplexing_gain: 1.31,
          buffer_utilization: 0.68,
        }
      },
      "Link 2": {
        cells: ["throughput-cell-3"],
        metrics: {
          peak_load_gbps: 0.0128,
          required_capacity_gbps: 0.0152,
          avg_latency_ms: 0.89,
          p99_latency_ms: 3.41,
          mitigation_strategy: "Critical Congestion Detected. Recommend Traffic Shaping or Link Aggregation.",
          multiplexing_gain: 0.84,
          buffer_utilization: 0.91,
        }
      }
    };

    // Generate realistic slot-level traffic series for charts
    const link_traffic: Record<string, any[]> = {};
    ["Link 1", "Link 2"].forEach((linkName, li) => {
      const base = li === 0 ? 0.006 : 0.0052;
      const slots = [];
      for (let i = 0; i < 200; i++) {
        const tod = 0.4 + 0.6 * Math.sin(Math.PI * Math.max(0, Math.min((i / 200) * 24 - 6, 14) / 14));
        const noise = (Math.random() - 0.5) * 0.002;
        slots.push({ slot_index: i, throughput_gbps: Math.max(0.001, base * tod + noise) });
      }
      link_traffic[linkName] = slots;
    });

    const stmt = db.prepare(`
      INSERT INTO analysis_history (name, cells_count, topology_data, optimization_data, explanations_data, traffic_data)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      `Demo Analysis ${new Date().toLocaleString()}`,
      3,
      JSON.stringify(topology),
      JSON.stringify(optimization),
      JSON.stringify(explanations),
      JSON.stringify(link_traffic)
    );

    res.json({
      status: "success",
      cells_processed: ["throughput-cell-1", "throughput-cell-2", "throughput-cell-3"],
      topology,
      explanations,
      optimization,
      link_traffic
    });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to generate demo data: " + err.message });
  }
});

app.get("/api/history", (req, res) => {
  const history = db.prepare("SELECT * FROM analysis_history ORDER BY timestamp DESC").all();
  res.json(history.map((h: any) => ({
    ...h,
    topology_data: JSON.parse(h.topology_data),
    optimization_data: JSON.parse(h.optimization_data),
    explanations_data: JSON.parse(h.explanations_data),
    traffic_data: h.traffic_data ? JSON.parse(h.traffic_data) : null
  })));
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  const PORT = Number(process.env.PORT) || 3000;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
