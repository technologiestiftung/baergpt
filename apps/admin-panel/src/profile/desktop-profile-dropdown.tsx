import React from "react";
import Content from "@/content";
import { SecondaryButton } from "../components/primitives/buttons/secondary-button";
import { useAuthStore } from "@/store/use-auth-store";

export const DesktopProfileDropdown = React.forwardRef<HTMLDivElement>(
	(_, ref) => {
		const { session, logout } = useAuthStore();

		if (!session) {
			return null;
		}

		const { first_name, last_name } = session.user.user_metadata;
		return (
			<div
				ref={ref}
				className="absolute right-5 z-50 mt-3 p-[5px] w-48 rounded-sm bg-hellblau-100"
			>
				<div className="flex flex-col gap-3 justify-between">
					<div className="p-1 text-dunkelblau-200 text-base leading-6 font-semibold border-b-[0.25px] border-dunkelblau-200">
						<span>
							{first_name} {last_name}
						</span>
					</div>
					<SecondaryButton
						onClick={() => {
							logout();
						}}
						ariaLabel={Content["profile.button.logout.ariaLabel"]}
						className="w-full bg-transparent hover:bg-hellblau-60"
					>
						<span>{Content["profile.button.logout.label"]}</span>
						<img src="/icons/logout-icon.svg" alt="" />
					</SecondaryButton>
				</div>
			</div>
		);
	},
);
