import * as React from "react";
import { useLocation, Link } from "react-router-dom";
import {
	Sidebar,
	SidebarContent,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarRail,
	SidebarInset,
	SidebarProvider,
	SidebarTrigger,
} from "../ui/sidebar";
import { Separator } from "../ui/separator";
import Content from "../../content.ts";

const pages = {
	navMain: [
		{
			title: "Navigation",
			url: "#",
			items: [
				{
					title: Content["admin.sidebar.navigation.users"],
					url: "/",
				},
				{
					title: Content["admin.sidebar.navigation.baseKnowledge"],
					url: "/base-knowledge/",
				},
			],
		},
	],
};

export function AdminSidebar({
	children,
	...props
}: React.ComponentProps<typeof Sidebar>) {
	const location = useLocation();

	const breadCrumbTitle = pages.navMain
		.flatMap((group) => group.items)
		.find((item) => item.url === location.pathname)?.title;

	return (
		<SidebarProvider>
			<Sidebar {...props}>
				<SidebarHeader>
					<SidebarMenu>
						<SidebarMenuItem>
							<SidebarMenuButton size="lg" asChild>
								<a href="/">
									<div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
										B
									</div>
									<div className="flex flex-col gap-0.5 leading-none">
										<span className="font-semibold text-lg text-dunkelblau-200">
											{Content["admin.sidebar.title"]}
										</span>
									</div>
								</a>
							</SidebarMenuButton>
						</SidebarMenuItem>
					</SidebarMenu>
				</SidebarHeader>
				<SidebarContent>
					{pages.navMain.map((item) => (
						<SidebarGroup key={item.title}>
							<SidebarGroupLabel>{item.title}</SidebarGroupLabel>
							<SidebarGroupContent>
								<SidebarMenu>
									{item.items.map((sbitem) => (
										<SidebarMenuItem key={sbitem.title}>
											<SidebarMenuButton
												asChild
												isActive={location.pathname === sbitem.url}
											>
												<Link to={sbitem.url}>{sbitem.title}</Link>
											</SidebarMenuButton>
										</SidebarMenuItem>
									))}
								</SidebarMenu>
							</SidebarGroupContent>
						</SidebarGroup>
					))}
				</SidebarContent>
				<SidebarRail />
			</Sidebar>
			<SidebarInset>
				<header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
					<SidebarTrigger className="-ml-1" />
					<Separator
						orientation="vertical"
						className="mr-2 data-[orientation=vertical]:h-4"
					/>
					{breadCrumbTitle && (
						<h1 className="text-dunkelblau-200 font-semibold text-lg">
							{breadCrumbTitle}
						</h1>
					)}
				</header>
				{children}
			</SidebarInset>
		</SidebarProvider>
	);
}
