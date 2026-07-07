import { QRCodeSVG } from "qrcode.react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface QRCodeDisplayProps {
  value: string;
  title?: string;
  size?: number;
}

export function QRCodeDisplay({ value, title = "Session QR Code", size = 200 }: QRCodeDisplayProps) {
  return (
    <Card className="w-fit">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-center">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex items-center justify-center pb-4">
        <QRCodeSVG
          value={value}
          size={size}
          level="M"
          includeMargin
          className="rounded"
        />
      </CardContent>
    </Card>
  );
}
