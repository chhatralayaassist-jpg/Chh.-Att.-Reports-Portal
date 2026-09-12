import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ReportView } from "@/components/report-view";
import { currentMonth, decDayRange } from "@/lib/reports";

const TITLE = "Attendance Summary Decday_1 — Chhatralaya Attendance";
const DESC = "Dec Day 1 (1st to 10th) attendance summary with schedule-wise P, P1, P2, AB counts, percentage and rank.";

export const Route = createFileRoute("/_authenticated/dec-day-1")({
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
  component: DecDay1Page,
});

function DecDay1Page() {
  const preset = decDayRange(currentMonth(), 1);
  const [from, setFrom] = useState(preset.from);
  const [to, setTo] = useState(preset.to);
  return (
    <ReportView
      title="Attendance Summary Decday_1"
      filename={`Attendance_Summary_Decday_1_${from}_to_${to}`}
      from={from}
      to={to <  from ? from : to}
      controls={
        <>
          <div className="grid gap-1">
            <Label htmlFor="dd1-from" className="text-xs">From</Label>
            <Input id="dd1-from" type="date" className="w-40" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="dd1-to" className="text-xs">To</Label>
            <Input id="dd1-to" type="date" className="w-40" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </>
      }
    />
  );
}
