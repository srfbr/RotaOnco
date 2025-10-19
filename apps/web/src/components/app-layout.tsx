import { useState, type ReactNode } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { AppTopbar } from "@/components/app-topbar";

export function AppLayout({ children }: { children: ReactNode }) {
	const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

	return (
		<div className="flex min-h-svh bg-[#FCFBFA] text-[#111827]">
			<AppSidebar collapsed={isSidebarCollapsed} />
			<div className="flex min-h-svh flex-1 flex-col">
				<AppTopbar
					isSidebarCollapsed={isSidebarCollapsed}
					onToggleSidebar={() => setIsSidebarCollapsed((prev) => !prev)}
				/>
				<main className="flex-1 overflow-y-auto px-6 pb-6 pt-8 lg:px-8 xl:px-10">
					{children}
				</main>
			</div>
		</div>
	);
}
