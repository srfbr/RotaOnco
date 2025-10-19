import { Link } from "@tanstack/react-router";
import { useRouterState } from "@tanstack/react-router";
import {
	BellIcon,
	BarChart3Icon,
	LogOutIcon,
	SquareGanttChart,
	Stethoscope,
	Users2Icon,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { LayoutDashboardIcon } from "lucide-react";

const mainNavItems = [
	{
		label: "Dashboard",
		to: "/dashboard" as const,
		icon: LayoutDashboardIcon,
		enabled: true,
	},
	{
		label: "Pacientes",
		to: "/patients" as const,
		icon: Users2Icon,
		enabled: false,
	},
	{
		label: "Consultas",
		to: "/consultas" as const,
		icon: SquareGanttChart,
		enabled: false,
	},
	{
		label: "Equipe médica",
		to: "/team" as const,
		icon: Stethoscope,
		enabled: false,
	},
	{
		label: "Relatórios",
		to: "/reports" as const,
		icon: BarChart3Icon,
		enabled: false,
	},
] as const;

const extraNavItems = [
	{
		label: "Meu perfil",
		to: "/profile" as const,
		icon: Users2Icon,
		enabled: false,
	},
	{
		label: "Sair",
		to: "/logout" as const,
		icon: LogOutIcon,
		enabled: false,
	},
] as const;

function handleComingSoon(label: string) {
	toast.info(`${label} em breve`);
}

type AppSidebarProps = {
	collapsed?: boolean;
};

export function AppSidebar({ collapsed = false }: AppSidebarProps) {
	if (collapsed) {
		return null;
	}
	const routerState = useRouterState({
		select: (s) => s.location.pathname,
	});
	const pathname = routerState;

	return (
		<aside
			id="app-sidebar"
			className="hidden h-full min-h-svh w-[312px] border-r border-[#CECFCD] bg-white px-10 py-5 xl:flex xl:flex-col xl:gap-16"
		>
			<div className="flex items-center gap-3">
				<div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#3663D8] text-white">
					<BellIcon className="h-5 w-5" />
				</div>
				<div className="flex flex-col text-center text-[#3663D8]">
					<span className="text-[26px] font-bold leading-6">RotaOnco</span>
					<span className="text-xs font-medium leading-3 text-[#9FB5ED]">
						GERENCIADOR WEB
					</span>
				</div>
			</div>

			<nav className="flex flex-1 flex-col gap-10">
				<div className="space-y-4">
					<p className="text-sm font-medium text-[#AAAAAA]">MENU</p>
					<ul className="space-y-4">
						{mainNavItems.map((item) => {
							const Icon = item.icon;
							const isActive = pathname.startsWith(item.to);
							const commonClasses = cn(
								"flex h-12 items-center gap-3 rounded-md px-3 py-2 text-base font-medium transition",
								isActive
									? "bg-[#3663D8] text-white shadow-sm"
									: "text-[#AAAAAA] hover:bg-[#F3F6FD]",
							);

							if (!item.enabled) {
								return (
									<li key={item.label}>
										<button
											type="button"
											onClick={() => handleComingSoon(item.label)}
											className={cn(commonClasses, "w-full cursor-not-allowed opacity-60")}
										>
											<Icon className="h-4 w-4" />
											<span>{item.label}</span>
										</button>
									</li>
								);
							}

							return (
								<li key={item.label}>
									<Link to={item.to} className={cn(commonClasses, "w-full")}
										activeOptions={{ exact: true }}
									>
										<Icon className="h-4 w-4" />
										<span>{item.label}</span>
									</Link>
								</li>
							);
						})}
					</ul>
				</div>

				<div className="space-y-4">
					<p className="text-sm font-medium text-[#AAAAAA]">MAIS</p>
					<ul className="space-y-4">
						{extraNavItems.map((item) => {
							const Icon = item.icon;
							return (
								<li key={item.label}>
									<button
										type="button"
										onClick={() => handleComingSoon(item.label)}
										className="flex h-12 w-full items-center gap-3 rounded-md px-3 py-2 text-base font-medium text-[#AAAAAA] opacity-60 transition hover:bg-[#F3F6FD]"
									>
										<Icon className="h-4 w-4" />
										<span>{item.label}</span>
									</button>
								</li>
							);
						})}
					</ul>
				</div>
			</nav>
		</aside>
	);
}
