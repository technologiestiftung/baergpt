import Content from "../../content.ts";
import { useAuthStore } from "../../store/auth-store.ts";

export function ResetPasswordConfirmation() {
	const { passwordResetEmail } = useAuthStore();
	return (
		<div className="flex w-full min-h-[95svh] justify-center items-center bg-hellblau-100 px-6">
			<div className="bg-white w-full rounded-3px max-w-4xl border border-black flex flex-col p-6 md:py-10 md:px-12">
				<h1 className="text-xl md:text-2xl leading-8">
					{Content["resetPasswordConfirmation.h1"]}
				</h1>

				<h2 className="text-xl md:text-2xl leading-8 font-semibold mt-5">
					{passwordResetEmail}
				</h2>
				<div className="mt-10 md:mt-16 w-full">
					<span className="text-lg leading-7 font-semibold">
						{Content["resetPasswordConfirmation.p"]}
					</span>
					<ul className="list-disc leading-6 md:text-lg md:leading-7 font-normal max-w-[170rem] ml-5 mt-2 md:mt-2">
						<li>{Content["resetPasswordConfirmation.list.li.1"]}</li>
						<li>{Content["resetPasswordConfirmation.list.li.2"]}</li>
						<li>{Content["resetPasswordConfirmation.list.li.3"]}</li>
						<li>{Content["resetPasswordConfirmation.list.li.4"]}</li>
					</ul>
				</div>
			</div>
		</div>
	);
}
