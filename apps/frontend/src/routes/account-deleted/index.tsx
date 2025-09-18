import { AppLayout } from "../../layouts/app-layout.tsx";
import Content from "../../content.ts";
import { Link } from "react-router-dom";

export function AccountDeleted() {
	return (
		<AppLayout>
			<div className="flex w-full min-h-[95svh] items-center justify-center bg-hellblau-100 px-5">
				<div className="flex flex-col  gap-1.5 border border-black py-10 px-12 rounded-3px bg-white max-w-3xl">
					<h1 className="text-xl leading-7 md:text-4xl md:leading-10 font-normal">
						{Content["accountDeleted.title"]}
					</h1>
					<p>{Content["accountDeleted.description"]}</p>

					<Link
						to={Content["accountDeleted.buttonLink"]}
						className={`
							flex gap-x-2 text-lg items-center self-end
							w-fit py-2 px-3 text-white rounded-3px 
							bg-dunkelblau-100 disabled:bg-schwarz-40
							hover:bg-dunkelblau-80 focus-visible:outline-default
						`}
					>
						{Content["accountDeleted.button"]}
						<img
							src="/icons/arrow-top-right-light-icon.svg"
							alt={Content["arrowWhiteTopRightIcon.imgAlt"]}
							width={24}
							height={24}
						/>
					</Link>
				</div>
			</div>
		</AppLayout>
	);
}
