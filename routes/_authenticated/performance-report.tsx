import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ReportView } from "@/components/report-view";
import { monthRange, currentMonth, todayISO } from "@/lib/reports";

const TITLE = "Performance Report — Chhatralaya Attendance";
const DESC = "Custom date range performance report ranking students by attendance percentage across all eight schedules.";

export const Route = createFileRoute("/_authenticated/performance-report")({
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
  component: PerformanceReportPage,
});

function PerformanceReportPage() {
  const [from, setFrom] = useState(monthRange(currentMonth()).from);
  const [to, setTo] = useState(todayISO());
  return (
    <ReportView
      title="Performance Report"
      filename={`Performance_Report_${from}_to_${to}`}
      from={from}
      to={to > from ? to : from}
      controls={
        <>
          <div className="grid gap-1">
            <Label htmlFor="pr-from" className="text-xs">From</Label>
            <Input id="pr-from" type="date" className="w-40" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="pr-to" className="text-xs">To</Label>
            <Input id="pr-to" type="date" className="w-40" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </>
      }
    />
  );
}
