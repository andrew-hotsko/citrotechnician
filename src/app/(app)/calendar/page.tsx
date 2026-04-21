import { startOfWeek, endOfWeek, parseISO, isValid } from "date-fns";
import { getCurrentUser } from "@/lib/auth";
import { listTechs } from "@/lib/jobs-query";
import {
  listScheduledJobs,
  listUnscheduledJobs,
} from "@/lib/calendar-query";
import { CalendarView } from "./calendar-view";

type Search = Promise<{ week?: string }>;

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Search;
}) {
  const params = await searchParams;
  const base = params.week && isValid(parseISO(params.week))
    ? parseISO(params.week)
    : new Date();
  const weekStart = startOfWeek(base, { weekStartsOn: 1 }); // Monday
  const weekEnd = endOfWeek(base, { weekStartsOn: 1 });     // Sunday

  const [user, scheduled, unscheduled, techs] = await Promise.all([
    getCurrentUser(),
    listScheduledJobs(weekStart, weekEnd),
    listUnscheduledJobs(),
    listTechs(),
  ]);

  const canEdit =
    user?.role === "ADMIN" || user?.role === "OPS_MANAGER";

  return (
    <CalendarView
      weekStartISO={weekStart.toISOString()}
      weekEndISO={weekEnd.toISOString()}
      techs={techs}
      scheduled={scheduled.map((j) => ({
        id: j.id,
        jobNumber: j.jobNumber,
        stage: j.stage,
        product: j.product,
        propertyName: j.property.name,
        propertyCity: j.property.city,
        propertyRegion: j.property.region,
        dueDate: j.dueDate.toISOString(),
        scheduledDate: j.scheduledDate!.toISOString(),
        assignedTechId: j.assignedTechId,
      }))}
      unscheduled={unscheduled.map((j) => ({
        id: j.id,
        jobNumber: j.jobNumber,
        stage: j.stage,
        product: j.product,
        propertyName: j.property.name,
        propertyCity: j.property.city,
        propertyRegion: j.property.region,
        dueDate: j.dueDate.toISOString(),
        assignedTech: j.assignedTech,
      }))}
      canEdit={canEdit}
    />
  );
}
