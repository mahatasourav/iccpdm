// src/App.tsx
import { useEffect, useState } from "react";
import axios from "axios";
import StatsOverview from "./components/StatsOverview";
import RecentScans from "./components/RecentScans";
import ScanDetails from "./components/ScanDetails";
import { startQRScan } from "./utils/startQRScan";

interface Stats {
  totalScans: number;
  genuineCount: number;
  suspectCount: number;
  rejectedCount: number;
}

interface Scan {
  id: string;
  uid: string;
  medicineName?: string;
  batchId?: string;
  rfidStatus: string;
  uvResult: string;
  rgbResult: string;
  finalResult: string;
  timestamp: string;
}

interface CurrentScan {
  uid: string;
  registered: boolean;
  medicineName?: string;
  batchId?: string;
  rfidStatus?: string;
  uvResult?: string;
  rgbResult?: string;
  finalResult?: string;
  timestamp?: string;
}

export default function App() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentScans, setRecentScans] = useState<Scan[]>([]);
  const [selectedScan, setSelectedScan] = useState<Scan | null>(null);
  const [currentScan, setCurrentScan] = useState<CurrentScan | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanLoading, setScanLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scannedResult, setScannedResult] = useState("");

  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3001";

  const sendToESP32 = async (uid: string) => {
    try {
      const response = await axios.get(
        `http://10.67.62.46/receive?uid=${encodeURIComponent(uid)}`,
      );
      console.log("ESP32 response:", response.data);
    } catch (error) {
      console.error("Failed to send QR to ESP32:", error);
    }
  };

  const getResultColor = (result?: string) => {
    if (!result) return "text-gray-500";

    const value = result.toUpperCase();

    if (value === "GENUINE" || value === "PASS" || value === "VALID") {
      return "text-green-600";
    }

    if (
      value === "SUSPECT" ||
      value === "REJECTED" ||
      value === "FAIL" ||
      value === "INVALID" ||
      value === "EXPIRED" ||
      value === "RECALLED" ||
      value === "UNREGISTERED"
    ) {
      return "text-red-600";
    }

    return "text-yellow-600";
  };

  const getResultBadge = (result?: string) => {
    if (!result) return "bg-gray-100 text-gray-600 border-gray-200";

    const value = result.toUpperCase();

    if (value === "GENUINE" || value === "PASS" || value === "VALID") {
      return "bg-green-100 text-green-700 border-green-200";
    }

    if (
      value === "SUSPECT" ||
      value === "REJECTED" ||
      value === "FAIL" ||
      value === "INVALID" ||
      value === "EXPIRED" ||
      value === "RECALLED" ||
      value === "UNREGISTERED"
    ) {
      return "bg-red-100 text-red-700 border-red-200";
    }

    return "bg-yellow-100 text-yellow-700 border-yellow-200";
  };

  const fetchStats = async () => {
    try {
      const response = await axios.get(`${apiUrl}/api/stats/summary`);
      setStats(response.data.data || response.data);
    } catch (err) {
      console.error("Failed to fetch stats:", err);
      setError("Failed to load statistics");
    }
  };

  const fetchRecentScans = async () => {
    try {
      const response = await axios.get(
        `${apiUrl}/api/stats/recent-scans?limit=20`,
      );
      const scans = response.data.data || response.data;
      setRecentScans(Array.isArray(scans) ? scans : []);
    } catch (err) {
      console.error("Failed to fetch scans:", err);
      setError("Failed to load recent scans");
    }
  };

  const fetchCurrentScan = async (data: string) => {
    try {
      const uid = data.trim();
      const response = await axios.get(`${apiUrl}/api/scans/${uid}`);
      const result = response.data;

      setCurrentScan({
        uid: result.uid,
        registered: result.registered,
        medicineName: result.medicine?.medicineName,
        batchId: result.medicine?.batchId,
        rfidStatus: "true", // Assuming if we get a response, RFID scan passed. Adjust as needed based on actual API response.
        uvResult: result.latestScan?.uvResult,
        rgbResult: result.latestScan?.rgbResult,
        finalResult: result.latestScan?.finalResult,
        timestamp: result.latestScan?.timestamp,
      });
    } catch (err: any) {
      if (err.response?.status === 404) {
        setCurrentScan({
          uid: data.trim(),
          registered: false,
          medicineName: "Not Registered",
          batchId: "-",
          rfidStatus: "FAIL",
          uvResult: "-",
          rgbResult: "-",
          finalResult: "REJECTED",
          timestamp: new Date().toISOString(),
        });
      } else {
        console.error("Failed to fetch current scan:", err);
      }
    }
  };

  const handleScan = async () => {
    setScanLoading(true);
    setError(null);

    try {
      startQRScan(async (data: string) => {
        setScannedResult(data);
        await sendToESP32(data);
        await fetchCurrentScan(data);
        await fetchRecentScans();
        await fetchStats();
        setScanLoading(false);
      });
    } catch (err) {
      console.error("Failed to start scan:", err);
      setError("Failed to start QR scan");
      setScanLoading(false);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);

      await Promise.all([fetchStats(), fetchRecentScans()]);

      setLoading(false);
    };

    loadData();

    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  const InfoCard = ({
    label,
    value,
    highlight = false,
    badge = false,
  }: {
    label: string;
    value: string;
    highlight?: boolean;
    badge?: boolean;
  }) => (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
        {label}
      </p>
      {badge ? (
        <span
          className={`mt-3 inline-flex rounded-full border px-3 py-1 text-sm font-semibold ${getResultBadge(
            value,
          )}`}
        >
          {value}
        </span>
      ) : (
        <p
          className={`mt-2 break-words text-base font-semibold ${
            highlight ? getResultColor(value) : "text-gray-800"
          }`}
        >
          {value}
        </p>
      )}
    </div>
  );

  if (loading && !stats) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100 px-4">
        <div className="rounded-2xl bg-white px-8 py-6 text-center shadow-lg">
          <div className="text-lg font-semibold text-gray-700">
            Loading dashboard...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-700 via-blue-600 to-cyan-600 text-white shadow-lg">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <p className="mb-2 inline-flex rounded-full bg-white/15 px-3 py-1 text-xs font-medium uppercase tracking-wider text-blue-50">
                Live Monitoring
              </p>
              <h1 className="text-3xl font-bold leading-tight sm:text-4xl">
                Judge Dashboard
              </h1>
              <p className="mt-2 text-sm text-blue-100 sm:text-base">
                Counterfeit Medicine Detection System
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:min-w-[360px]">
              <div className="rounded-2xl bg-white/10 p-4 backdrop-blur-sm">
                <p className="text-xs uppercase tracking-wide text-blue-100">
                  Backend
                </p>
                <p className="mt-1 break-all text-sm font-medium">{apiUrl}</p>
              </div>
              <div className="rounded-2xl bg-white/10 p-4 backdrop-blur-sm">
                <p className="text-xs uppercase tracking-wide text-blue-100">
                  Last Updated
                </p>
                <p className="mt-1 text-sm font-medium">
                  {new Date().toLocaleTimeString()}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Current Live Scan */}
      <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-lg">
          <div className="border-b border-gray-200 bg-gradient-to-r from-blue-50 to-cyan-50 px-5 py-5 sm:px-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-800">
                  Current Live Scan
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  View the latest medicine UID and detection result
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                {scannedResult && (
                  <div className="rounded-xl bg-white px-4 py-2 text-sm shadow-sm ring-1 ring-gray-200">
                    <span className="text-gray-500">Last QR:</span>{" "}
                    <span className="font-semibold text-gray-800">
                      {scannedResult}
                    </span>
                  </div>
                )}

                <button
                  onClick={handleScan}
                  disabled={scanLoading}
                  className={`inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold shadow-md transition ${
                    scanLoading
                      ? "cursor-not-allowed bg-gray-400 text-white"
                      : "bg-blue-600 text-white hover:bg-blue-700"
                  }`}
                >
                  {scanLoading ? "Scanning..." : "🔄 Take Another Scan"}
                </button>
              </div>
            </div>
          </div>

          <div className="px-1 py-1 sm:px-6">
            <div className="px-2 py-2 sm:px-6">
              <div className="flex justify-center">
                <div
                  id="qr-reader"
                  className="mb-4 w-full max-w-sm h-56 sm:h-72 overflow-hidden rounded-lg border border-dashed border-gray-300 bg-gray-50"
                />
              </div>
            </div>

            {currentScan ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <InfoCard label="UID" value={currentScan.uid || "-"} />
                <InfoCard
                  label="Medicine Name"
                  value={currentScan.medicineName || "-"}
                />
                <InfoCard label="Batch ID" value={currentScan.batchId || "-"} />
                <InfoCard
                  label="RFID Status"
                  value={currentScan.rfidStatus || "Waiting..."}
                  highlight
                  badge
                />
                <InfoCard
                  label="UV Result"
                  value={currentScan.uvResult || "Waiting..."}
                  highlight
                  badge
                />
                <InfoCard
                  label="RGB Result"
                  value={currentScan.rgbResult || "Waiting..."}
                  highlight
                  badge
                />
                <InfoCard
                  label="Final Result"
                  value={currentScan.finalResult || "Processing..."}
                  highlight
                  badge
                />
                <InfoCard
                  label="Timestamp"
                  value={
                    currentScan.timestamp
                      ? new Date(currentScan.timestamp).toLocaleString()
                      : "-"
                  }
                />
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-6 py-12 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-100 text-2xl">
                  📷
                </div>
                <p className="text-lg font-semibold text-gray-700">
                  No current scan available
                </p>
                <p className="mt-2 text-sm text-gray-500">
                  Press the scan button to read a QR code and load live results.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {error && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-red-700 shadow-sm">
            {error}
          </div>
        )}

        {stats && <StatsOverview stats={stats} />}

        <div className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <div className="rounded-3xl bg-white p-4 shadow-lg sm:p-5">
              <RecentScans
                scans={recentScans}
                onSelectScan={setSelectedScan}
                selectedScan={selectedScan}
              />
            </div>
          </div>

          <div className="xl:col-span-1">
            {selectedScan ? (
              <div className="rounded-3xl bg-white p-4 shadow-lg sm:p-5">
                <ScanDetails scan={selectedScan} />
              </div>
            ) : (
              <div className="flex h-full min-h-[320px] items-center justify-center rounded-3xl bg-white p-6 shadow-lg">
                <div className="text-center text-gray-500">
                  <div className="mb-4 text-5xl">📋</div>
                  <p className="text-lg font-semibold text-gray-700">
                    No scan selected
                  </p>
                  <p className="mt-2 text-sm text-gray-500">
                    Select a scan from the recent scans panel to view details.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
