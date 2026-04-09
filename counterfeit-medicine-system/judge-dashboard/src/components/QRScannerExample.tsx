import { useState } from "react";
import axios from "axios";
import { startQRScan } from "../utils/startQRScan";

export default function QRScannerExample() {
  const [scannedResult, setScannedResult] = useState("");

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

  const handleScan = () => {
    startQRScan(async (data: string) => {
      setScannedResult(data);
      await sendToESP32(data);
    });
  };

  return (
    <div>
      <button onClick={handleScan}>Scan QR Code</button>
      <div id="qr-reader" />
      <p>{scannedResult}</p>
    </div>
  );
}
