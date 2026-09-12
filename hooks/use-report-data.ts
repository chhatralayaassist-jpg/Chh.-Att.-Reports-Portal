import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { AttendanceRow, SlipRow, Student } from "@/lib/reports";

export type GroupInfo = {
  id: string;
  name: string;
  leaderId: string;
  leaderName: string;
  memberIds: string[];
};

export function useStudents() {
  return useQuery({
    queryKey: ["report-students"],
    queryFn: async (): Promise<Student[]> => {
      const { data, error } = await supabase
        .from("students")
        .select("id, enrollment_no, name, standard")
        .order("name");
      if (error) throw error;
      return (data ?? []) as Student[];
    },
  });
}

export function useGroups() {
  return useQuery({
    queryKey: ["report-groups"],
    queryFn: async (): Promise<GroupInfo[]> => {
      const [{ data: groups, error: ge }, { data: members, error: me }, { data: students, error: se }] =
        await Promise.all([
          supabase.from("report_groups").select("id, name, leader_student_id").order("created_at"),
          supabase.from("report_group_members").select("group_id, student_id"),
          supabase.from("students").select("id, name"),
        ]);
      if (ge) throw ge;
      if (me) throw me;
      if (se) throw se;
      const nameById = new Map((students ?? []).map((s: any) => [s.id, s.name as string]));
      return (groups ?? []).map((g: any) => {
        const memberIds = (members ?? [])
          .filter((m: any) => m.group_id === g.id)
          .map((m: any) => m.student_id as string);
        const leaderName = nameById.get(g.leader_student_id) ?? "";
        return {
          id: g.id,
          name: g.name || leaderName,
          leaderId: g.leader_student_id,
          leaderName,
          memberIds: [g.leader_student_id, ...memberIds.filter((id) => id !== g.leader_student_id)],
        };
      });
    },
  });
}

export function useAttendanceRange(from: string, to: string) {
  return useQuery({
    queryKey: ["report-attendance", from, to],
    queryFn: async (): Promise<AttendanceRow[]> => {
      const { data, error } = await supabase
        .from("attendance")
        .select("student_id, attendance_date, pooja, ma, gdc, ekant, sa, ss, sabha, lib, created_at")
        .gte("attendance_date", from)
        .lte("attendance_date", to)
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as unknown as AttendanceRow[];
    },
  });
}

export function useSlipsRange(from: string, to: string) {
  return useQuery({
    queryKey: ["report-slips", from, to],
    queryFn: async (): Promise<SlipRow[]> => {
      const { data, error } = await supabase
        .from("slips_attendance")
        .select("student_id, attendance_date, activity, source")
        .gte("attendance_date", from)
        .lte("attendance_date", to);
      if (error) throw error;
      return (data ?? []) as SlipRow[];
    },
  });
}
