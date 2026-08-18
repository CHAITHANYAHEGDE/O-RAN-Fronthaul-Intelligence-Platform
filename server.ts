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

app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
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
    // Generate realistic synthetic O-RAN fronthaul telemetry data
    // Simulates 3 cells across 2000 slots each with realistic traffic patterns
    processedData = {};

    const CELLS = [
      { id: "throughput-cell-1", baseMbps: 3.8, variance: 0.9, pattern: "bursty" },
      { id: "throughput-cell-2", baseMbps: 2.1, variance: 0.5, pattern: "steady" },
      { id: "throughput-cell-3", baseMbps: 5.2, variance: 1.4, pattern: "peaked" },
    ];

    CELLS.forEach(cell => {
      const slots: any[] = [];
      for (let i = 0; i < 2000; i++) {
        // Time of day effect: busiest 8am-10pm (slots 300-1380 assuming 0.5s per slot)
        const timeOfDay = (i % 1440) / 1440;
        const tod_factor = 0.4 + 0.6 * Math.sin(Math.PI * Math.max(0, Math.min(timeOfDay * 24 - 6, 14) / 14));

        // Pattern variation
        let noise = 0;
        if (cell.pattern === "bursty") {
          noise = Math.random() < 0.05 ? cell.variance * 3 * Math.random() : (Math.random() - 0.5) * cell.variance;
        } else if (cell.pattern === "peaked") {
          noise = Math.sin(i / 50) * cell.variance * 0.5 + (Math.random() - 0.5) * cell.variance * 0.5;
        } else {
          noise = (Math.random() - 0.5) * cell.variance;
        }

        const throughput_gbps = Math.max(0.01, (cell.baseMbps * tod_factor + noise) / 1000);
        const bytes = Math.round((throughput_gbps * 1e9) / 16000);
        const packets = Math.round(bytes / 1500);
        const packet_loss = Math.random() < 0.02 ? Math.random() * 0.05 : 0;

        slots.push({ slot_index: i, packets, bytes, throughput_gbps, packet_loss });
      }
      processedData[cell.id] = slots;
    });

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
        return res.status(500).json({ error: "Demo Analysis failed", details: errorData });
      }

      try {
        const result = JSON.parse(outputData);
        const topology = result.topology;
        const explanations = result.explanations;
        const optimization = result.optimization;
        const link_traffic = result.link_traffic;

        const stmt = db.prepare(`
          INSERT INTO analysis_history (name, cells_count, topology_data, optimization_data, explanations_data, traffic_data)
          VALUES (?, ?, ?, ?, ?, ?)
        `);
        stmt.run(
          `Demo Analysis ${new Date().toLocaleString()}`,
          Object.keys(processedData).length,
          JSON.stringify(topology),
          JSON.stringify(optimization),
          JSON.stringify(explanations),
          JSON.stringify(link_traffic)
        );

        res.json({
          status: "success",
          cells_processed: Object.keys(processedData),
          topology,
          explanations,
          optimization,
          link_traffic
        });
      } catch (e) {
        res.status(500).json({ error: "Failed to parse demo ML results" });
      }
    });

    pythonProcess.stdin.write(JSON.stringify(processedData));
    pythonProcess.stdin.end();
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
