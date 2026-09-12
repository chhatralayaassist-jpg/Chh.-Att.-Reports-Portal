import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ReportView } from "@/components/report-view";
import { currentMonth, monthRange, todayISO } from "@/lib/reports";

const TITLE = "Group Wise Summary Report — Chhatralaya Attendance";
const DESC = "Group wise attendance summary combining every leader and member, ranked by the group's average attendance.";

export const Route = createFileRoute("/_authenticated/group-summary")({
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
  component: GroupSummaryPage,
});

function GroupSummaryPage() {
  const [from, setFrom] = useState(monthRange(currentMonth()).from);
  const [to, setTo] = useState(todayISO());
  return (
    <ReportView
      variant="groups"
      title="Group Wise Summary"
      filename={`Group_Wise_Summary_${from}_to_${to}`}
      from={from}
      to={to > from ? to : from}
      controls={
        <>
          <div className="grid gap-1">
            <Label htmlFor="gs-from" className="text-xs">From</Label>
            <Input id="gs-from" type="date" className="w-40" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="gs-to" className="text-xs">To</Label>
            <Input id="gs-to" type="date" className="w-40" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </>
      }
    />
  );
}
