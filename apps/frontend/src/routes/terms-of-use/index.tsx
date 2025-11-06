import type React from "react";
import { LandingPageLayout } from "../../layouts/landing-page-layout.tsx";
import Content from "../../content.ts";
import { TableOfContents } from "../../components/privacy-policy/table-of-contents.tsx";
import { ListItem } from "../../components/privacy-policy/list-item.tsx";
import {
	tableOfContentsItems,
	section1ListItems,
	section2Sub2ItemA,
	section2Sub2ItemB,
	section3Sub2ListItems,
	section4Sub2ListItems,
} from "./content.ts";
import { ContactInfo } from "../../components/privacy-policy/contact-info.tsx";

export const TermsOfUsePage: React.FC = () => {
	const section2SubSections = [
		{
			id: "section-2-1",
			number: 2.1,
			title: Content["termsOfUsePage.section2.sub1.title"],
			content: (
				<p>
					<span>{Content["termsOfUsePage.section2.sub1.p1.1"]}</span>
					<a
						href={Content["termsOfUsePage.section2.sub1.p1.1.link"]}
						target="_blank"
						rel="noopener noreferrer"
						className="underline underline-offset-2"
					>
						{Content["termsOfUsePage.section2.sub1.p1.1.link"]}
					</a>
					<span>{Content["termsOfUsePage.section2.sub1.p1.2"]}</span>
				</p>
			),
		},
		{
			id: "section-2-2",
			number: 2.2,
			title: Content["termsOfUsePage.section2.sub2.title"],
			content: (
				<ul className="list-disc pl-5">
					<li>
						<ContactInfo data={section2Sub2ItemA} />
					</li>
					<li>
						<ContactInfo data={section2Sub2ItemB} />
					</li>
				</ul>
			),
		},
		{
			id: "section-2-3",
			number: 2.3,
			title: Content["termsOfUsePage.section2.sub3.title"],
			content: <p>{Content["termsOfUsePage.section2.sub3.p1"]}</p>,
		},
	];

	const section3SubSections = [
		{
			id: "section-3-1",
			number: 3.1,
			title: Content["termsOfUsePage.section3.sub1.title"],
			content: <p>{Content["termsOfUsePage.section3.sub1.p1"]}</p>,
		},
		{
			id: "section-3-2",
			number: 3.2,
			title: Content["termsOfUsePage.section3.sub2.title"],
			content: (
				<div className="flex flex-col gap-1">
					<p>{Content["termsOfUsePage.section3.sub2.p1"]}</p>
					<ul className="list-disc pl-5">
						{section3Sub2ListItems.map((item, index) => (
							<li key={index}>{item.item}</li>
						))}
					</ul>
					<p>{Content["termsOfUsePage.section3.sub2.p2"]}</p>
				</div>
			),
		},
		{
			id: "section-3-3",
			number: 3.3,
			title: Content["termsOfUsePage.section3.sub3.title"],
			content: <p>{Content["termsOfUsePage.section3.sub3.p1"]}</p>,
		},
		{
			id: "section-3-4",
			number: 3.4,
			title: Content["termsOfUsePage.section3.sub4.title"],
			content: (
				<div className="flex flex-col gap-1">
					<p>{Content["termsOfUsePage.section3.sub4.p1"]}</p>
					<p>{Content["termsOfUsePage.section3.sub4.p2"]}</p>
				</div>
			),
		},
	];
	const section4SubSections = [
		{
			id: "section-4-1",
			number: 4.1,
			title: Content["termsOfUsePage.section4.sub1.title"],
			content: <p>{Content["termsOfUsePage.section4.sub1.p1"]}</p>,
		},
		{
			id: "section-4-2",
			number: 4.2,
			title: Content["termsOfUsePage.section4.sub2.title"],
			content: (
				<>
					<p>{Content["termsOfUsePage.section4.sub2.p1"]}</p>
					<ul className="list-disc pl-5">
						{section4Sub2ListItems.map((item) => (
							<ListItem
								key={item.heading}
								title={item.heading}
								description={item.description}
							/>
						))}
					</ul>
					<p>
						<span>{Content["termsOfUsePage.section4.sub2.p2.start"]}</span>
						<a
							href={Content["termsOfUsePage.section4.sub2.p2.link"]}
							target="_blank"
							rel="noopener noreferrer"
							className="underline underline-offset-2"
						>
							{Content["termsOfUsePage.section4.sub2.p2.link"]}
						</a>
						<span>{Content["termsOfUsePage.section4.sub2.p2.end"]}</span>
					</p>
				</>
			),
		},
		{
			id: "section-4-3",
			number: 4.3,
			title: Content["termsOfUsePage.section4.sub3.title"],
			content: <p>{Content["termsOfUsePage.section4.sub3.p1"]}</p>,
		},
		{
			id: "section-4-4",
			number: 4.4,
			title: Content["termsOfUsePage.section4.sub4.title"],
			content: <p>{Content["termsOfUsePage.section4.sub4.p1"]}</p>,
		},
	];

	// Section Content
	const sections = [
		{
			id: "section-1",
			number: 1,
			title: Content["termsOfUsePage.section1.title"],
			content: (
				<ol className="list-decimal pl-5">
					{section1ListItems.map((item) => (
						<ListItem
							key={item.title}
							title={item.title}
							description={item.description}
						/>
					))}
				</ol>
			),
		},
		{
			id: "section-2",
			number: 2,
			title: Content["termsOfUsePage.section2.title"],
			subsections: section2SubSections,
		},
		{
			id: "section-3",
			number: 3,
			title: Content["termsOfUsePage.section3.title"],
			subsections: section3SubSections,
		},
		{
			id: "section-4",
			number: 4,
			title: Content["termsOfUsePage.section4.title"],
			subsections: section4SubSections,
		},
	];

	return (
		<LandingPageLayout>
			<div className="pb-[60px] px-5 max-w-[934px] mx-auto text-dunkelblau-100">
				<h1 className="text-4xl leading-10 font-semibold lg:text-6xl lg:leading-none py-[60px] lg:py-20">
					{Content["termsOfUsePage.h1"]}
				</h1>
				<p className="text-base leading-6 lg:text-lg lg:leading-7 mb-4 lg:mb-5">
					{Content["termsOfUsePage.date"]}
				</p>
				<h2 className="text-2xl leading-8 lg:text-3xl lg:leading-9 font-semibold mb-4 lg:mb-5">
					{Content["termsOfUsePage.tableOfContents.title"]}
				</h2>
				<div className="flex flex-col gap-[60px] lg:gap-16">
					<TableOfContents items={tableOfContentsItems} />

					<ol className="list-none pl-0 flex flex-col gap-10 lg:gap-[60px]">
						{sections.map((section) => (
							<li
								key={section.id}
								id={section.id}
								className="flex flex-col gap-5 lg:gap-6 scroll-mt-[100px]"
							>
								<h2 className="flex gap-2 text-3xl leading-9 lg:text-4xl lg:leading-10 font-semibold">
									<span>{section.number}.</span>
									<span>{section.title}</span>
								</h2>
								{section.content}
								{section.subsections && (
									<div className="flex flex-col gap-6">
										{section.subsections.map((subsection) => (
											<div
												key={subsection.id}
												id={subsection.id}
												className="flex flex-col gap-4 scroll-mt-[100px]"
											>
												<h3 className="text-xl leading-7 font-semibold">
													{subsection.number} {subsection.title}
												</h3>
												{subsection.content}
											</div>
										))}
									</div>
								)}
							</li>
						))}
					</ol>
				</div>
			</div>
		</LandingPageLayout>
	);
};
