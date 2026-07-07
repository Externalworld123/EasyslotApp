import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Camera, CameraOff } from "lucide-react";

interface QRScannerProps {
  onScan: (value: string) => void;
}

export function QRScanner({ onScan }: QRScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerId = "qr-reader";

  const startScanning = async () => {
    setError(null);
    try {
      const scanner = new Html5Qrcode(containerId);
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          onScan(decodedText);
          stopScanning();
        },
        () => {} // ignore scan failures
      );
      setIsScanning(true);
    } catch (err: any) {
      setError(err?.message || "Failed to start camera. Please allow camera access.");
    }
  };

  const stopScanning = async () => {
    if (scannerRef.current?.isScanning) {
      await scannerRef.current.stop();
    }
    setIsScanning(false);
  };

  useEffect(() => {
    return () => {
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Camera className="h-4 w-4" />
          QR Check-In Scanner
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div id={containerId} className="w-full overflow-hidden rounded-lg" />

        {error && (
          <p className="text-sm text-destructive text-center">{error}</p>
        )}

        <Button
          variant={isScanning ? "destructive" : "default"}
          onClick={isScanning ? stopScanning : startScanning}
          className="w-full"
        >
          {isScanning ? (
            <><CameraOff className="h-4 w-4 mr-2" />Stop Scanner</>
          ) : (
            <><Camera className="h-4 w-4 mr-2" />Start Scanner</>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
