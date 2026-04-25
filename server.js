import express from "express";
import cors from "cors";
import axios from "axios";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(cors());
  app.use(express.json({ limit: '100mb' }));
  app.use(express.urlencoded({ extended: true, limit: '100mb' }));
  
  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "ok", 
      port: PORT, 
      env: process.env.NODE_ENV
    });
  });

  // Proxy endpoint for images to bypass CORS
  app.get("/api/proxy-image", async (req, res) => {
    try {
      const imageUrl = req.query.url;
      if (!imageUrl) {
        return res.status(400).json({ error: "Missing url parameter" });
      }
      
      const response = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        validateStatus: (status) => status < 500
      });
      
      if (response.status !== 200) {
        console.error(`Proxy failed with status ${response.status} for URL: ${imageUrl}`);
        return res.status(response.status).send(response.data);
      }
      
      const contentType = response.headers['content-type'] || '';
      
      if (!contentType.startsWith('image/')) {
        console.error(`Proxy failed: URL returned non-image content type: ${contentType} for URL: ${imageUrl}`);
        return res.status(400).json({ error: `URL returned non-image content type: ${contentType}` });
      }
      
      const buffer = Buffer.from(response.data);
      
      res.set('Content-Type', contentType || 'image/jpeg');
      res.set('Cache-Control', 'public, max-age=31536000');
      res.send(buffer);
    } catch (error) {
      console.error("Proxy image error:", error.message || error);
      res.status(500).json({ error: "Failed to fetch image", details: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV === "development") {
    try {
        const { createServer: createViteServer } = await import("vite");
        const vite = await createViteServer({
          server: { middlewareMode: true },
          appType: "spa",
        });
        app.use(vite.middlewares);
    } catch (err) {
        console.error("Failed to load vite", err);
    }
  } else {
    // Serve static files in production
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, () => {
    console.log("====================================================");
    console.log(`🚀 SERVER ĐANG CHẠY TẠI PORT: ${PORT}`);
    console.log(`📂 MÔI TRƯỜNG: ${process.env.NODE_ENV || 'development'}`);
    console.log("====================================================");
  });
}

startServer();
