import { DefaultDialog } from "./primitives/dialogs/default-dialog";
import Content from "../content";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
	markVersionAsSeen,
	useSplashScreenStore,
} from "../store/splash-screen-store.ts";

export const SplashModal = () => {
	const { isOpen, content, closeSplashScreen } = useSplashScreenStore();

	const handleAfterClose = () => {
		closeSplashScreen();
		markVersionAsSeen();
	};

	return (
		<DefaultDialog
			id="splash-modal"
			isOpen={isOpen}
			className="md:w-[600px] max-h-[650px] max-w-[90vw] text-dunkelblau-200"
			afterClose={handleAfterClose}
		>
			<div className="sticky top-0 bg-white flex flex-row items-center justify-between py-3 pl-[30px] pr-[23px] border-b-[0.5px] border-dunkelblau-50">
				<div className="flex flex-col gap-2">
					<h2 className="text-2xl leading-8 font-semibold">
						{Content["splashModal.title"]}
					</h2>
					<p className="text-sm leading-5 font-normal">
						{Content["splashModal.description"]}
					</p>
				</div>
				<button
					className="size-7 p-1 rounded-3px focus-visible:outline-default hover:bg-hellblau-50 flex items-center justify-center"
					onClick={closeSplashScreen}
					data-testid={`close-splash-modal-button`}
				>
					<img
						src="/icons/close-dialog-icon.svg"
						alt={Content["closeIcon.imgAlt"]}
					/>
				</button>
			</div>
			<div
				className="px-[30px] py-5 overflow-y-auto"
				data-testid="splash-modal-markdown-container"
			>
				<ReactMarkdown
					remarkPlugins={[remarkGfm]}
					className="markdown-container"
				>
					{content}
				</ReactMarkdown>
			</div>
		</DefaultDialog>
	);
};
