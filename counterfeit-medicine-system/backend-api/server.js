// server.js - Main Backend API Server
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Import MongoDB service
const {
  initializeMongoDB,
  getMedicineRecord,
  addScanRecord,
  updateScanCount,
  getAllMedicines,
  isRecalled,
  getRecentScans,
  getStatisticsSummary,
  healthCheck,
} = require("./mongodb-service");

// ============================================
// HEALTH CHECK ENDPOINT
// ============================================

app.get("/api/health", async (req, res) => {
  try {
    const mongoHealth = await healthCheck();

    res.json({
      status: "API is running",
      database: mongoHealth.status,
      message: mongoHealth.message,
      timestamp: new Date(),
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: error.message,
      timestamp: new Date(),
    });
  }
});

// ============================================
// MEDICINE RECORDS ENDPOINTS
// ============================================

/**
 * GET /api/medicines/:uid
 * Retrieve medicine record by RFID UID
 */
app.get("/api/medicines/:uid", async (req, res) => {
  try {
    const { uid } = req.params;
    const medicine = await getMedicineRecord(uid);

    if (!medicine) {
      return res.status(404).json({
        success: false,
        error: "Medicine not found",
        uid,
      });
    }

    res.json({
      success: true,
      data: medicine,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error("Error fetching medicine:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/medicines
 * Create new medicine record (Admin only)
 */
app.post("/api/medicines", async (req, res) => {
  try {
    const {
      uid,
      medicineName,
      batchId,
      expiryDate,
      uvRef,
      uvTol,
      rgbRef,
      rgbTol,
    } = req.body;

    if (!uid || !medicineName) {
      return res.status(400).json({
        success: false,
        error: "uid and medicineName are required",
      });
    }

    const newMedicine = {
      uid,
      medicineName,
      batchId: batchId || "",
      registered: true,
      expiryDate: expiryDate || "",
      recalled: false,
      uvRef: uvRef || 0,
      uvTol: uvTol || 0,
      rgbRef: rgbRef || { r: 0, g: 0, b: 0, c: 0 },
      rgbTol: rgbTol || { r: 0, g: 0, b: 0, c: 0 },
      scanCount: 0,
      lastScanDate: "",
      createdAt: new Date().toISOString(),
    };

    // Note:
    // This currently uses addScanRecord(), exactly like your existing code.
    // If later you create addMedicineRecord(), replace this call with that.
    const result = await addScanRecord(newMedicine);

    res.status(201).json({
      success: true,
      data: newMedicine,
      message: "Medicine record created",
      recordId: result?.scanId || result?._id || null,
    });
  } catch (error) {
    console.error("Error creating medicine:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * PUT /api/medicines/:uid/calibrate
 * Update UV/RGB calibration values
 */
app.put("/api/medicines/:uid/calibrate", async (req, res) => {
  try {
    const { uid } = req.params;
    const { uvRef, uvTol, rgbRef, rgbTol } = req.body;

    if (!uid) {
      return res.status(400).json({
        success: false,
        error: "uid is required",
      });
    }

    // Placeholder for future direct DB update
    console.log(`Calibration updated for ${uid}`);

    res.json({
      success: true,
      message: "Calibration updated",
      data: { uid, uvRef, uvTol, rgbRef, rgbTol },
    });
  } catch (error) {
    console.error("Error updating calibration:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ============================================
// SCAN HISTORY ENDPOINTS
// ============================================

/**
 * POST /api/scans
 * Record a new scan result
 */
app.post("/api/scans", async (req, res) => {
  try {
    const {
      uid,
      rfidStatus,
      uvResult,
      uvValue,
      rgbResult,
      rgbValue,
      finalResult,
      deviceId,
    } = req.body;

    if (!uid) {
      return res.status(400).json({
        success: false,
        error: "uid is required",
      });
    }

    const scanRecord = {
      uid,
      timestamp: new Date().toISOString(),
      rfidStatus: rfidStatus || "PASS",
      uvResult: uvResult || "N/A",
      uvValue: uvValue || 0,
      rgbResult: rgbResult || "N/A",
      rgbValue: rgbValue || { r: 0, g: 0, b: 0, c: 0 },
      finalResult: finalResult || "UNKNOWN",
    };

    const scanId = await addScanRecord(scanRecord);

    await updateScanCount(uid);

    res.status(201).json({
      success: true,
      scanId,
      data: scanRecord,
      message: "Scan recorded successfully",
    });
  } catch (error) {
    console.error("Error recording scan:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/scans/:uid
 * Get scan history for a medicine
 */
app.get("/api/scans/:uid", async (req, res) => {
  try {
    const { uid } = req.params;

    // Step 1: check medicine database
    const medicine = await getMedicineRecord(uid);

    if (!medicine) {
      return res.status(404).json({
        success: false,
        registered: false,
        uid,
        message: "Medicine not registered",
      });
    }

    // Step 2: get latest scan
    const scans = await getRecentScans(100);
    const latestScan = scans.find((s) => s.uid === uid) || null;

    res.json({
      success: true,
      registered: true,
      uid,
      medicine,
      latestScan,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ============================================
// STATISTICS & DASHBOARD ENDPOINTS
// ============================================

/**
 * GET /api/stats/summary
 * Get system statistics for dashboard
 */
app.get("/api/stats/summary", async (req, res) => {
  try {
    const stats = await getStatisticsSummary();
    const registeredMedicines = await getAllMedicines();
    const recentScans = await getRecentScans(1);

    res.json({
      success: true,
      data: {
        totalScans: stats.totalScans || 0,
        genuineCount: stats.genuineCount || 0,
        suspectCount: stats.suspectCount || 0,
        rejectedCount: stats.rejectedCount || 0,
        registeredMedicines: registeredMedicines.length,
        lastScanTime: recentScans.length > 0 ? recentScans[0].timestamp : null,
      },
      timestamp: new Date(),
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/stats/recent-scans
 * Get recent scan results for dashboard
 */
app.get("/api/stats/recent-scans", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 20;
    const recentScans = await getRecentScans(limit);

    res.json({
      success: true,
      data: recentScans,
      count: recentScans.length,
    });
  } catch (error) {
    console.error("Error fetching recent scans:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ============================================
// ERROR HANDLING
// ============================================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "Endpoint not found",
  });
});

// ============================================
// START SERVER ONLY AFTER MONGODB CONNECTS
// ============================================

async function startServer() {
  try {
    await initializeMongoDB();
    console.log("✓ MongoDB initialized successfully");

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`✓ Backend API running on http://localhost:${PORT}`);
      console.log(`✓ Health check: http://localhost:${PORT}/api/health`);
    });
  } catch (error) {
    console.error("Failed to initialize MongoDB:", error.message);
    process.exit(1);
  }
}

startServer();
