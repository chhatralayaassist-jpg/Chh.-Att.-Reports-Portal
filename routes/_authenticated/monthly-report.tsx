import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ReportView } from "@/components/report-view";
import { currentMonth, monthRange } from "@/lib/reports";

const TITLE = "Attendance Monthly Summary — Chhatralaya Attendance";
const DESC = "Full month attendance summary of every student with schedule-wise counts, attendance percentage and rank.";

export const Route = createFileRoute("/_authenticated/monthly-report")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESC },
    ],
  }),
  component: MonthlyReportPage,
});

function MonthlyReportPage() {
  const [month, setMonth] = useState(currentMonth());
  const { from, to } = monthRange(month);
  return (
    <ReportView
      title="Attendance Monthly Summary"
      filename={`Attendance_Monthly_Summary_${month}`}
      from={from}
      to={to}
      controls={
        <div className="grid gap-1">
          <Label htmlFor="mr-month" className="text-xs">Month</Label>
          <Input id="mr-month" type="month" className="w-40" value={month} onChange={(e) => setMonth(e.target.value)} />
        </div>
      }
    />
  );
}
