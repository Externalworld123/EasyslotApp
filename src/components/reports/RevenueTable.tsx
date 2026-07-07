// RevenueTable — placeholder for revenue/session history table
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface RevenueRow {
  id: string;
  date: string;
  resource: string;
  customer: string;
  duration: string;
  amount: string;
}

interface RevenueTableProps {
  rows: RevenueRow[];
}

export function RevenueTable({ rows }: RevenueTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Resource</TableHead>
          <TableHead>Customer</TableHead>
          <TableHead>Duration</TableHead>
          <TableHead className="text-right">Amount</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 ? (
          <TableRow>
            <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
              No data available
            </TableCell>
          </TableRow>
        ) : (
          rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell>{row.date}</TableCell>
              <TableCell>{row.resource}</TableCell>
              <TableCell>{row.customer}</TableCell>
              <TableCell>{row.duration}</TableCell>
              <TableCell className="text-right font-medium">{row.amount}</TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
