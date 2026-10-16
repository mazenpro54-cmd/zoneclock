import { NavLink } from "react-router-dom";
import {
  Clock, Calendar, CalendarDays, Users, LayoutDashboard,
  User, BarChart2, Briefcase, Kanban, Palmtree, DollarSign
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

export default function Navbar() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";

  const navItems = [
    { to: "/", icon: <Clock size={18} />, label: "Clock" },
    { to: "/timesheet", icon: <Calendar size={18} />, label: "Timesheet" },
    { to: "/kanban", icon: <Kanban size={18} />, label: "Tasks" },
    { to: "/timeoff", icon: <Palmtree size={18} />, label: "PTO" },
    { to: "/analytics", icon: <BarChart2 size={18} />, label: "Analytics" },
    { to: "/shifts", icon: <CalendarDays size={18} />, label: "Shifts" },
    { to: "/teams", icon: <Users size={18} />, label: "Teams" },
    ...(isAdmin ? [{ to: "/payroll", icon: <DollarSign size={18} />, label: "Payroll" }] : []),
    ...(isAdmin ? [{ to: "/clients", icon: <Briefcase size={18} />, label: "Clients" }] : []),
    ...(isAdmin ? [{ to: "/admin", icon: <LayoutDashboard size={18} />, label: "Admin" }] : []),
    { to: "/profile", icon: <User size={18} />, label: "Profile" },
  ];

  return (
    <nav className="bottom-nav">
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === "/"}
          className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
        >
          {item.icon}
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
