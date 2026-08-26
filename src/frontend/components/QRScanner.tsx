import React, { useState, useRef } from 'react';
import { QrCode, Camera, X } from 'lucide-react';

interface QRScannerProps {
  onScan: (code: string) => void;
}

export const QRScanner: React.FC<QRScannerProps> = ({ onScan }) => {
  const [active, setActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const startCamera = async () => {
    setActive(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.warn('Camera stream simulation fallback:', err);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
    }
    setActive(false);
  };

  const simulateScan = () => {
    const dummyScan = `QR-${Math.floor(100000 + Math.random() * 900000)}`;
    onScan(dummyScan);
    stopCamera();
  };

  return (
    <div>
      {!active ? (
        <button
          type="button"
          onClick={startCamera}
          className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center space-x-1"
        >
          <QrCode className="w-4 h-4" />
          <span>Scan Code</span>
        </button>
      ) : (
        <div className="fixed inset-0 bg-black/80 z-50 flex flex-col items-center justify-center p-4">
          <div className="relative bg-slate-900 border border-slate-800 rounded-2xl p-4 max-w-sm w-full space-y-4 text-center">
            <div className="flex items-center justify-between text-white border-b border-slate-800 pb-2">
              <span className="text-xs font-bold flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-blue-400" /> Camera QR Scanner
              </span>
              <button onClick={stopCamera} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="relative aspect-square bg-slate-950 rounded-xl overflow-hidden flex items-center justify-center border border-dashed border-blue-500/40">
              <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
              <div className="absolute inset-8 border-2 border-blue-500 rounded-lg animate-pulse pointer-events-none"></div>
            </div>

            <button
              onClick={simulateScan}
              className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold"
            >
              Simulate Instant Barcode Scan
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
