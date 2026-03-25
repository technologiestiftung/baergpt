import React from "react";
import { ChatSection } from "../components/chat/chat-section.tsx";
import { AppLayout } from "../layouts/app-layout.tsx";
import { DocumentsSection } from "../components/documents/documents-section.tsx";
import { useAuthStore } from "../store/auth-store.ts";
import { DocumentPreviewSection } from "../components/documents/document-preview-section.tsx";
import { MobileHistoryDrawer } from "../components/sidebar/history/mobile-history-drawer.tsx";
import { MobileProfileDrawer } from "../components/profile/mobile-profile-drawer.tsx";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";

import { LandingPage } from "../components/landing-page/landing-page.tsx";
import { SplashModal } from "../components/splash-modal.tsx";
import { config } from "../config.ts";

export const IndexPage: React.FC = () => {
	const { session } = useAuthStore();

	/**
	 * On page load, the session will be undefined until the auth store checks for an existing session.
	 * During this time, we don't want to render anything (not even the landing page) to avoid content flickering.
	 * Once the session is determined (either null or a valid session), we can render the appropriate content.
	 */
	if (session === undefined) {
		return null;
	}

	if (session === null) {
		return <LandingPage />;
	}

	return (
		<AppLayout>
			<div className="relative flex flex-row h-full w-full">
				<DndProvider backend={HTML5Backend}>
					<MobileHistoryDrawer />
					<DocumentsSection />
					<MobileProfileDrawer />
					<div className="relative flex-1">
						<ChatSection />
						<DocumentPreviewSection />
					</div>
				</DndProvider>
				{config.featureFlagSplashScreenAllowed && <SplashModal />}
			</div>
		</AppLayout>
	);
};
