import type React from "react";
import { LandingPageLayout } from "../../layouts/landing-page-layout.tsx";
import Content from "../../content.ts";

export const AccessibilityStatementPage: React.FC = () => {
	const sections = [
		{
			id: "section-1",
			title: Content["accessibilityStatementPage.section1.title"],
			content: (
				<div className="flex flex-col gap-1">
					<p className="font-semibold">
						{Content["accessibilityStatementPage.section1.org"]}
					</p>
					<p>{Content["accessibilityStatementPage.section1.p1"]}</p>
					<p>
						{Content["accessibilityStatementPage.section1.p2.part1"]}{" "}
						<a
							href={Content["accessibilityStatementPage.section1.p2.link.href"]}
							target="_blank"
							rel="noopener noreferrer"
							className="underline underline-offset-2"
						>
							{Content["accessibilityStatementPage.section1.p2.link"]}
						</a>{" "}
						{Content["accessibilityStatementPage.section1.p2.part2"]}{" "}
						<a
							href={
								Content["accessibilityStatementPage.section1.p2.link2.href"]
							}
							target="_blank"
							rel="noopener noreferrer"
							className="underline underline-offset-2"
						>
							{Content["accessibilityStatementPage.section1.p2.link2"]}
						</a>
						.
					</p>
					<p>{Content["accessibilityStatementPage.section1.p3"]}</p>
				</div>
			),
		},
		{
			id: "section-2",
			title: Content["accessibilityStatementPage.section2.title"],
			content: (
				<div className="flex flex-col gap-1">
					<p>
						{Content["accessibilityStatementPage.section2.p1.part1"]}{" "}
						<span className="font-semibold">
							{Content["accessibilityStatementPage.section2.date"]}
						</span>{" "}
						{Content["accessibilityStatementPage.section2.p1.part2"]}
					</p>
					<p>
						{Content["accessibilityStatementPage.section2.p2.part1"]}{" "}
						<span className="font-semibold">
							{Content["accessibilityStatementPage.section2.date"]}
						</span>{" "}
						{Content["accessibilityStatementPage.section2.p2.part2"]}
					</p>
					<p>{Content["accessibilityStatementPage.section2.p3"]}</p>
				</div>
			),
		},
		{
			id: "section-3",
			title: Content["accessibilityStatementPage.section3.title"],
			content: <p>{Content["accessibilityStatementPage.section3.p1"]}</p>,
		},
		{
			id: "section-4",
			title: Content["accessibilityStatementPage.section4.title"],
			content: (
				<div className="flex flex-col gap-1">
					<p>{Content["accessibilityStatementPage.section4.p1"]}</p>
					<p className="font-semibold">
						{Content["accessibilityStatementPage.section4.label1"]}
					</p>
					<p>{Content["accessibilityStatementPage.section4.p2"]}</p>
					<p className="font-semibold">
						{Content["accessibilityStatementPage.section4.label2"]}
					</p>
					<p>{Content["accessibilityStatementPage.section4.p3"]}</p>
					<p className="font-semibold">
						{Content["accessibilityStatementPage.section4.label3"]}
					</p>
					<ul className="list-disc pl-5">
						<li>{Content["accessibilityStatementPage.section4.li1"]}</li>
					</ul>
					<div className="flex flex-col gap-1 mt-6 mb-6">
						<p className="font-semibold">
							{Content["accessibilityStatementPage.section4.label4"]}
						</p>
						<p>{Content["accessibilityStatementPage.section4.p4"]}</p>
						<p>{Content["accessibilityStatementPage.section4.p5"]}</p>
					</div>
					<p className="font-semibold">
						{Content["accessibilityStatementPage.section4.label5"]}
					</p>
					<p>{Content["accessibilityStatementPage.section4.p6"]}</p>
				</div>
			),
		},
		{
			id: "section-5",
			title: Content["accessibilityStatementPage.section5.title"],
			content: (
				<div className="flex flex-col gap-1">
					<p>{Content["accessibilityStatementPage.section5.p1"]}</p>
					<p>{Content["accessibilityStatementPage.section5.p2"]}</p>
					<div className="flex flex-col">
						<span>
							{
								Content[
									"accessibilityStatementPage.section5.contact.organisation"
								]
							}
						</span>
						<span>
							{Content["accessibilityStatementPage.section5.contact.address"]}
						</span>
						<span>
							{
								Content[
									"accessibilityStatementPage.section5.contact.email.label"
								]
							}{" "}
							{Content["accessibilityStatementPage.section5.contact.email"]}
						</span>
						<span>
							{
								Content[
									"accessibilityStatementPage.section5.contact.phone.label"
								]
							}{" "}
							{Content["accessibilityStatementPage.section5.contact.phone"]}
						</span>
					</div>
				</div>
			),
		},
		{
			id: "section-6",
			title: Content["accessibilityStatementPage.section6.title"],
			content: (
				<div className="flex flex-col gap-3">
					<p>{Content["accessibilityStatementPage.section6.p1"]}</p>
					<ul className="list-disc pl-5">
						{section6Links.map((link) => (
							<li key={link.href}>
								<a
									href={link.href}
									target={link.external ? "_blank" : undefined}
									rel={link.external ? "noopener noreferrer" : undefined}
									className="underline underline-offset-2"
								>
									{link.label}
								</a>
							</li>
						))}
					</ul>
				</div>
			),
		},
	];

	return (
		<LandingPageLayout>
			<div className="pb-[60px] px-5 max-w-[934px] mx-auto text-dunkelblau-100">
				<h1 className="text-4xl leading-10 font-semibold lg:text-6xl lg:leading-none py-[60px] lg:py-20">
					{Content["accessibilityStatementPage.h1"]}
				</h1>

				<ol className="list-none pl-0 flex flex-col gap-10 lg:gap-[60px]">
					{sections.map((section) => (
						<li
							key={section.id}
							id={section.id}
							className="flex flex-col gap-5 lg:gap-6 scroll-mt-[100px]"
						>
							<h2 className="text-3xl leading-9 lg:text-4xl lg:leading-10 font-semibold">
								{section.title}
							</h2>
							{section.content}
						</li>
					))}
				</ol>
			</div>
		</LandingPageLayout>
	);
};

const section6Links = [
	{
		label: Content["accessibilityStatementPage.section6.li1"],
		href: Content["accessibilityStatementPage.section6.li1.link"],
		external: false,
	},
	{
		label: Content["accessibilityStatementPage.section6.li2"],
		href: Content["accessibilityStatementPage.section6.li2.link"],
		external: false,
	},
	{
		label: Content["accessibilityStatementPage.section6.li3"],
		href: Content["accessibilityStatementPage.section6.li3.link"],
		external: true,
	},
	{
		label: Content["accessibilityStatementPage.section6.li4"],
		href: Content["accessibilityStatementPage.section6.li4.link"],
		external: true,
	},
];
