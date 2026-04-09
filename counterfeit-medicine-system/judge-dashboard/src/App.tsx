// src/App.tsx
import { useEffect, useState } from "react";
import axios from "axios";
import StatsOverview from "./components/StatsOverview";
import RecentScans from "./components/RecentScans";
import ScanDetails from "./components/ScanDetails";
import QRScannerExample from "./components/QRScannerExample";

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

export default function App() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentScans, setRecentScans] = useState<Scan[]>([]);
  const [selectedScan, setSelectedScan] = useState<Scan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  console.log("hii", import.meta.env.VITE_API_URL);

  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3001";

  // Fetch statistics
  const fetchStats = async () => {
    try {
      const response = await axios.get(`${apiUrl}/api/stats/summary`);
      setStats(response.data.data || response.data);
    } catch (err) {
      console.error("Failed to fetch stats:", err);
      setError("Failed to load statistics");
    }
  };

  // Fetch recent scans
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

  // Initial load and polling
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchStats(), fetchRecentScans()]);
      setLoading(false);
    };

    loadData();

    // Poll for updates every 5 seconds
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !stats) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-xl font-semibold text-gray-700">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-4xl font-bold">Judge Dashboard</h1>
              <p className="text-blue-100 mt-2">
                Counterfeit Medicine Detection System
              </p>
              <QRScannerExample />
            </div>
            <div className="text-right">
              <div className="text-sm text-blue-100">Backend: {apiUrl}</div>
              <div className="text-xs text-blue-100 mt-1">
                Last updated: {new Date().toLocaleTimeString()}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {/* Statistics Overview */}
        {stats && <StatsOverview stats={stats} />}

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
          {/* Recent Scans List */}
          <div className="lg:col-span-2">
            <RecentScans
              scans={recentScans}
              onSelectScan={setSelectedScan}
              selectedScan={selectedScan}
            />
          </div>

          {/* Scan Details Panel */}
          <div className="lg:col-span-1">
            {selectedScan ? (
              <ScanDetails scan={selectedScan} />
            ) : (
              <div className="bg-white rounded-lg shadow-md p-6 h-full">
                <div className="text-center text-gray-500 py-12">
                  <div className="text-4xl mb-4">📋</div>
                  <p>Select a scan to view details</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
