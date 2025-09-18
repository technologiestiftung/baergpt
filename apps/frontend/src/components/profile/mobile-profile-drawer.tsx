import { BottomDrawer } from "../primitives/bottom-drawer/bottom-drawer.tsx";
import { useDrawerStore } from "../../store/drawer-store.ts";
import Content from "../../content.ts";
import { useAuthStore } from "../../store/auth-store.ts";
import { useFileUploadsStore } from "../../store/use-file-uploads-store.ts";

export const MobileProfileDrawer = () => {
	const { session, logout } = useAuthStore();
	const { clearFileUploads } = useFileUploadsStore();
	const { openDrawerId, setOpenDrawer } = useDrawerStore();
	const isProfileSectionOpen = openDrawerId === "profile";

	const handleToggle = () => {
		setOpenDrawer(null);
	};

	if (!session) {
		return null;
	}

	const { first_name, last_name } = session.user.user_metadata;

	return (
		<BottomDrawer
			isOpen={isProfileSectionOpen}
			onClose={handleToggle}
			title={`${first_name} ${last_name}`}
			classNames="md:hidden"
			style="dark"
			isCompact
		>
			{session && (
				<div className={`w-full px-5 mt-7 mb-2 h-fit mx-auto`}>
					<div className="flex flex-col">
						<a
							href="/profile/"
							className="flex rounded-3px h-10 w-fit items-center px-1 gap-1 text-white"
							aria-label={Content["profile.title"]}
						>
							<img src="/icons/profile-icon-white.svg" alt="" />
							<span className="text-hellblau-50">
								{Content["profile.button.mobile"]}
							</span>
						</a>
						<button
							className={`
								flex rounded-3px h-10 w-fit items-center px-1 gap-1 text-white
								`}
							onClick={() => {
								clearFileUploads();
								logout();
							}}
							type="button"
							aria-label={Content["profile.button.logout.ariaLabel"]}
						>
							<img src="/icons/logout-icon-white.svg" alt="" />
							<span className="text-hellblau-50">
								{Content["profile.button.logout.label"]}
							</span>
						</button>
					</div>
				</div>
			)}
		</BottomDrawer>
	);
};
