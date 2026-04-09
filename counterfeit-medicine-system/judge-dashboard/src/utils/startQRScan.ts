// utils/startQRScan.ts
import { Html5QrcodeScanner } from "html5-qrcode";

let qrScanner: Html5QrcodeScanner | null = null;
let isStarting = false;

export const startQRScan = (onScanned: (data: string) => void): void => {
  if (isStarting || qrScanner) return;

  const container = document.getElementById("qr-reader");
  if (!container) {
    console.error('QR scanner container with id "qr-reader" not found.');
    return;
  }

  isStarting = true;
  container.innerHTML = "";

  try {
    qrScanner = new Html5QrcodeScanner(
      "qr-reader",
      {
        fps: 10,
        qrbox: 250,
      },
      false
    );

    qrScanner.render(
      async (decodedText: string) => {
        console.log("QR scanned:", decodedText);

        try {
          onScanned(decodedText);
        } catch {
          // silent
        }

        try {
          await qrScanner?.clear();
        } catch {
          // silent
        } finally {
          qrScanner = null;
          isStarting = false;
        }
      },
      () => {
        // scan errors handled silently
      }
    );
  } catch {
    qrScanner = null;
    isStarting = false;
  }
};