import type React from "react";
import { LandingPageLayout } from "../../layouts/landing-page-layout.tsx";
import Content from "../../content.ts";
import { TableOfContents } from "../../components/privacy-policy/table-of-contents.tsx";
import { useSmoothScroll } from "../../components/privacy-policy/hooks/use-smooth-scroll.ts";
import { ListItem } from "../../components/privacy-policy/list-item.tsx";
import { ContactInfo } from "../../components/privacy-policy/contact-info.tsx";
import { Section } from "../../components/privacy-policy/section.tsx";

export const PrivacyPolicyPage: React.FC = () => {
	const handleSmoothScroll = useSmoothScroll();

	return (
		<LandingPageLayout>
			<div className="pb-[60px] px-5 max-w-[934px] mx-auto text-dunkelblau-100">
				<h1 className="text-4xl leading-10 font-semibold lg:text-6xl lg:leading-none py-[60px] lg:py-20">
					{Content["privacyPolicyPage.h1"]}
				</h1>
				<p className="text-base leading-6 lg:text-lg lg:leading-7 mb-4 lg:mb-5">
					{Content["privacyPolicyPage.date"]}
				</p>
				<h2 className="text-2xl leading-8 lg:text-3xl lg:leading-9 font-semibold mb-4 lg:mb-5">
					{Content["privacyPolicyPage.tableOfContents.title"]}
				</h2>
				<div className="flex flex-col gap-[60px] lg:gap-16">
					<TableOfContents onSectionClick={handleSmoothScroll} />

					<ol className="list-none pl-0 flex flex-col gap-10 lg:gap-[60px]">
						{/* Section 1 */}
						<Section
							id="section-1"
							number={1}
							title={Content["privacyPolicyPage.section1.title"]}
						>
							<div className="flex flex-col gap-1">
								<p>{Content["privacyPolicyPage.section1.p1"]}</p>
								<p>{Content["privacyPolicyPage.section1.p2"]}</p>
								<p>{Content["privacyPolicyPage.section1.p3"]}</p>
							</div>
						</Section>
						{/* Section 2 */}
						<Section
							id="section-2"
							number={2}
							title={Content["privacyPolicyPage.section2.title"]}
						>
							<div className="flex flex-col gap-3 lg:gap-5">
								<h3 className="text-base leading-6 lg:text-lg lg:leading-7 font-semibold">
									{Content["privacyPolicyPage.section2.a.title"]}
								</h3>
								<ul className="list-disc pl-5">
									<li>
										<ContactInfo
											data={{
												heading:
													Content["privacyPolicyPage.section2.a.li1.heading"],
												organisation:
													Content["privacyPolicyPage.section2.tsb.name"],
												address: {
													street:
														Content[
															"privacyPolicyPage.section2.tsb.address.street"
														],
													city: Content[
														"privacyPolicyPage.section2.tsb.address.city"
													],
												},
												phone: Content["privacyPolicyPage.section2.tsb.phone"],
												email: Content["privacyPolicyPage.section2.tsb.email"],
												website:
													Content["privacyPolicyPage.section2.tsb.website"],
											}}
										/>
									</li>
									<li>
										<ContactInfo
											data={{
												heading:
													Content["privacyPolicyPage.section2.a.li2.heading"],
												organisation:
													Content["privacyPolicyPage.section2.tsb.name"],
												role: Content["privacyPolicyPage.section2.a.li2.role"],
												address: {
													street:
														Content[
															"privacyPolicyPage.section2.tsb.address.street"
														],
													city: Content[
														"privacyPolicyPage.section2.tsb.address.city"
													],
												},
												phone: Content["privacyPolicyPage.section2.tsb.phone"],
												email:
													Content["privacyPolicyPage.section2.a.li2.email"],
											}}
										/>
									</li>
								</ul>
							</div>
							<div className="flex flex-col gap-3 lg:gap-5">
								<h3 className="text-base leading-6 lg:text-lg lg:leading-7 font-semibold">
									{Content["privacyPolicyPage.section2.b.title"]}
								</h3>
								<ul className="list-disc pl-5">
									<li>
										<ContactInfo
											data={{
												heading:
													Content["privacyPolicyPage.section2.b.li1.heading"],
												organisation:
													Content[
														"privacyPolicyPage.section2.b.li1.organisation"
													],
												role: Content["privacyPolicyPage.section2.b.li1.role"],
												name: Content["privacyPolicyPage.section2.b.li1.name"],
												address: {
													street:
														Content[
															"privacyPolicyPage.section2.b.li1.address.street"
														],
													city: Content[
														"privacyPolicyPage.section2.b.li1.address.city"
													],
												},
												email:
													Content["privacyPolicyPage.section2.b.li1.email"],
											}}
										/>
									</li>
									<li>
										<ContactInfo
											data={{
												heading:
													Content["privacyPolicyPage.section2.b.li2.heading"],
												organisation:
													Content[
														"privacyPolicyPage.section2.b.li2.organisation"
													],
												role: Content["privacyPolicyPage.section2.b.li2.role"],
												address: {
													street:
														Content[
															"privacyPolicyPage.section2.b.li2.address.street"
														],

													city: Content[
														"privacyPolicyPage.section2.b.li2.address.city"
													],
												},
												email:
													Content["privacyPolicyPage.section2.b.li2.email"],
											}}
										/>
									</li>
									<li>
										<ContactInfo
											data={{
												heading:
													Content["privacyPolicyPage.section2.b.li3.heading"],
												organisation:
													Content["privacyPolicyPage.section2.tsb.name"],
												address: {
													street:
														Content[
															"privacyPolicyPage.section2.tsb.address.street"
														],
													city: Content[
														"privacyPolicyPage.section2.tsb.address.city"
													],
												},
											}}
										/>
									</li>
								</ul>
							</div>
						</Section>
						{/* Section 3 */}
						<Section
							id="section-3"
							number={3}
							title={Content["privacyPolicyPage.section3.title"]}
						>
							<ul className="list-disc pl-5">
								<ListItem
									title={Content["privacyPolicyPage.section3.li1.title"]}
									description={
										Content["privacyPolicyPage.section3.li1.description"]
									}
								/>

								<ListItem
									title={Content["privacyPolicyPage.section3.li2.title"]}
									description={
										Content["privacyPolicyPage.section3.li2.description"]
									}
								/>

								<ListItem
									title={Content["privacyPolicyPage.section3.li3.title"]}
									description={
										Content["privacyPolicyPage.section3.li3.description"]
									}
								/>
								<ListItem
									title={Content["privacyPolicyPage.section3.li4.title"]}
									description={
										Content["privacyPolicyPage.section3.li4.description"]
									}
								/>
								<ListItem
									title={Content["privacyPolicyPage.section3.li5.title"]}
									description={
										Content["privacyPolicyPage.section3.li5.description"]
									}
								/>
							</ul>
						</Section>
						{/* Section 4 */}
						<Section
							id="section-4"
							number={4}
							title={Content["privacyPolicyPage.section4.title"]}
						>
							<ul className="list-disc pl-5">
								<ListItem
									title={Content["privacyPolicyPage.section4.li1.title"]}
									description={
										Content["privacyPolicyPage.section4.li1.description"]
									}
								/>
								<ListItem
									title={Content["privacyPolicyPage.section4.li2.title"]}
									description={
										Content["privacyPolicyPage.section4.li2.description"]
									}
								/>
							</ul>
						</Section>
						{/* Section 5 */}
						<Section
							id="section-5"
							number={5}
							title={Content["privacyPolicyPage.section5.title"]}
						>
							<ul className="list-disc pl-5">
								<li>{Content["privacyPolicyPage.section5.li1"]}</li>
								<li>{Content["privacyPolicyPage.section5.li2"]}</li>
								<li>{Content["privacyPolicyPage.section5.li3"]}</li>
								<li>{Content["privacyPolicyPage.section5.li4"]}</li>
							</ul>
						</Section>
						{/* Section 6 */}
						<Section
							id="section-6"
							number={6}
							title={Content["privacyPolicyPage.section6.title"]}
						>
							<ul className="list-disc pl-5">
								<ListItem
									title={Content["privacyPolicyPage.section6.li1.title"]}
									description={
										Content["privacyPolicyPage.section6.li1.description"]
									}
								/>
								<ListItem
									title={Content["privacyPolicyPage.section6.li2.title"]}
									description={
										Content["privacyPolicyPage.section6.li2.description"]
									}
								/>
								<ListItem
									title={Content["privacyPolicyPage.section6.li3.title"]}
									description={
										Content["privacyPolicyPage.section6.li3.description"]
									}
								/>
								<ListItem
									title={Content["privacyPolicyPage.section6.li4.title"]}
									description={
										Content["privacyPolicyPage.section6.li4.description"]
									}
								/>
								<ListItem
									title={Content["privacyPolicyPage.section6.li5.title"]}
									description={
										Content["privacyPolicyPage.section6.li5.description"]
									}
								/>
							</ul>
						</Section>
						{/* Section 7 */}
						<Section
							id="section-7"
							number={7}
							title={Content["privacyPolicyPage.section7.title"]}
						>
							<p>{Content["privacyPolicyPage.section7.p1"]}</p>
						</Section>
						{/* Section 8 */}
						<Section
							id="section-8"
							number={8}
							title={Content["privacyPolicyPage.section8.title"]}
						>
							<p>{Content["privacyPolicyPage.section8.p1"]}</p>
							<ul className="list-disc pl-5">
								<li>{Content["privacyPolicyPage.section8.li1"]}</li>
								<li>{Content["privacyPolicyPage.section8.li2"]}</li>
								<li>{Content["privacyPolicyPage.section8.li3"]}</li>
								<li>{Content["privacyPolicyPage.section8.li4"]}</li>
								<li>{Content["privacyPolicyPage.section8.li5"]}</li>
								<li>{Content["privacyPolicyPage.section8.li6"]}</li>
								<li>{Content["privacyPolicyPage.section8.li7"]}</li>
								<li>{Content["privacyPolicyPage.section8.li8"]}</li>
								<li>{Content["privacyPolicyPage.section8.li9"]}</li>
							</ul>
						</Section>
						{/* Section 9 */}
						<Section
							id="section-9"
							number={9}
							title={Content["privacyPolicyPage.section9.title"]}
						>
							<div className="flex flex-col gap-1">
								<p>{Content["privacyPolicyPage.section9.p1"]}</p>
								<p>{Content["privacyPolicyPage.section9.p2"]}</p>
							</div>
						</Section>
						{/* Section 10 */}
						<Section
							id="section-10"
							number={10}
							title={Content["privacyPolicyPage.section10.title"]}
						>
							<p>{Content["privacyPolicyPage.section10.p1"]}</p>
						</Section>
					</ol>
				</div>
			</div>
		</LandingPageLayout>
	);
};
