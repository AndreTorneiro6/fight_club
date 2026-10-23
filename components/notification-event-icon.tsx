import {
  Bell,
  CalendarDays,
  Clock,
  Flag,
  Handshake,
  Info,
  Shield,
  Swords,
  Trophy,
} from "lucide-react";
import { notificationPresentation } from "@/lib/notification-presentation";
import type { Notification } from "@/lib/types";
const icons = {
  season: Flag,
  challenge: Swords,
  accepted: Handshake,
  schedule: CalendarDays,
  result: Trophy,
  roles: Shield,
  reminder: Clock,
  update: Info,
  general: Bell,
};
export default function NotificationEventIcon({
  notice,
}: {
  notice: Notification;
}) {
  const event = notificationPresentation(notice),
    Icon = icons[event.kind];
  return (
    <span
      role="img"
      aria-label={event.label}
      className={notice.read ? "muted" : "gold"}
    >
      <Icon size={22} aria-hidden="true" />
    </span>
  );
}
