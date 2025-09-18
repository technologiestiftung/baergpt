import React from "react";
import { useLocation } from "react-router-dom";
import { useAuthStore } from "../store/auth-store";
import { Sidebar } from "./sidebar/sidebar";

interface MainProps {
	children: React.ReactNode;
}

export const Main: React.FC<MainProps> = ({ children }) => {
	const { session } = useAuthStore();
	const location = useLocation();
	const isProfilePage = location.pathname === "/profile/";
	const isEmailChangedPage = location.pathname === "/email-changed/";

	return (
		<main className={`flex h-full  overflow-hidden`}>
			<div className="flex w-full flex-row">
				{session && !isProfilePage && !isEmailChangedPage && <Sidebar />}

				<div
					className={`h-full w-full pb-[48px] md:pb-0 ${isProfilePage ? "overflow-y-auto" : "overflow-y-none"}`}
				>
					{children}
				</div>
			</div>
		</main>
	);
};
