const express = require("express");
const axios   = require("axios");
const fs      = require("fs");
const path    = require("path");
const router  = express.Router();

const ML = "http://localhost:8000";

// POST /api/Dw_ml/predict
router.post("/predict", async (req, res) => {
  try {
    const { data } = await axios.post(`${ML}/predict`, req.body, { timeout: 5000 });
    res.json(data);
  } catch (err) {
    res.status(503).json({ error: "ML service indisponible — FastAPI lancé ?" });
  }
});

// GET /api/Dw_ml/dashboard
router.get("/dashboard", async (req, res) => {
  try {
    const { data } = await axios.get(`${ML}/dashboard`, { timeout: 5000 });
    res.json(data);
  } catch (err) {
    res.status(503).json({ error: "ML service indisponible" });
  }
});

// GET /api/Dw_ml/health
router.get("/health", async (req, res) => {
  try {
    const { data } = await axios.get(`${ML}/health`);
    res.json(data);
  } catch {
    res.status(503).json({ error: "ML hors ligne" });
  }
});

module.exports = router;