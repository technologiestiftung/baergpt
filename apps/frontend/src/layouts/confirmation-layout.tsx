import type { ReactNode } from "react";
import { AuthHeader } from "../components/headers/auth/auth-header.tsx";
import { Footer } from "../components/footer/footer.tsx";
import { Tooltip } from "../components/primitives/tooltip/tooltip.tsx";

interface ConfirmationLayout {
	children: ReactNode;
}

export function ConfirmationLayout({ children }: ConfirmationLayout) {
	return (
		<>
			<div className="flex flex-col min-h-svh">
				<AuthHeader />

				<main className="flex">{children}</main>
			</div>

			<Footer />
			<Tooltip />
		</>
	);
}
