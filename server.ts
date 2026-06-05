import express from "express";
import { createServer as createViteServer } from "vite";
import multer from "multer";
import path from "path";
import fs from "fs";
import Database from "better-sqlite3";
import { spawn } from "child_process";

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
    const data = lines.map(line => {
      const parts = line.trim().split(/\s+/).map(Number);
      return { 
        symbol: parts[0] || 0, 
        packets: parts[1] || 0, 
        bytes: parts[2] || 0 
      };
    });
    
    const slots: any[] = [];
    for (let i = 0; i < data.length; i += 14) {
      const chunk = data.slice(i, i + 14);
      const packets = chunk.reduce((acc, curr) => acc + curr.packets, 0);
      const bytes = chunk.reduce((acc, curr) => acc + curr.bytes, 0);
      const throughput_gbps = (bytes * 16000) / 1e9;
      slots.push({ slot_index: i / 14, packets, bytes, throughput_gbps });
    }
    
    processedData[file.originalname.replace('.dat', '')] = slots;
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

      res.json({ topology, explanations, optimization, link_traffic });
    } catch (e) {
      res.status(500).json({ error: "Failed to parse ML results" });
    }
  });

  // Send data to Python
  pythonProcess.stdin.write(JSON.stringify(processedData));
  pythonProcess.stdin.end();
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
  }

  const PORT = 3000;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
