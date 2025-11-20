import React, { useState, useEffect } from "react";
import { Content } from "../../../content";
import { DocumentIcon } from "../../primitives/icons/document-icon";
import { useDocumentStore } from "../../../store/document-store";
import ProfilePageSkeleton from "../../primitives/skeletons/profile-page-skeleton";
import { ChevronIcon } from "../../primitives/icons/chevron-icon";

export const BaseKnowledgeSection: React.FC = () => {
	const { getPublicDocuments, publicDocuments, isPublicDocumentsLoading } =
		useDocumentStore();
	const [showAllDocuments, setShowAllDocuments] = useState(false);

	useEffect(() => {
		const abortController = new AbortController();
		const signal = abortController.signal;

		getPublicDocuments(signal);

		return () => {
			abortController.abort();
		};
	}, []);
	const sortedBaseKnowledgeDocuments = [...publicDocuments].sort((a, b) =>
		(a.file_name || "").localeCompare(b.file_name || ""),
	);
	return (
		<section className="flex flex-col gap-2">
			<h3 className="text-base leading-6 font-semibold">
				{Content["profile.baseKnowledge.title"]}
			</h3>
			<div>
				<p className="text-base leading-6 font-normal">
					{Content["profile.baseKnowledge.description"]}
				</p>
				<p className="text-sm leading-5 font-normal text-dunkelblau-60">
					{Content["profile.baseKnowledge.usage"]}
					<a
						href={Content["profile.baseKnowledge.link.url"]}
						className="underline underline-offset-2 hover:underline focus-visible:outline-default rounded-3px"
						target="_blank"
						rel="noopener noreferrer"
					>
						{Content["profile.baseKnowledge.link.label"]}
					</a>
				</p>
			</div>
			<div>
				{isPublicDocumentsLoading ? (
					<ul className="mb-5">
						<li className="flex gap-1 items-center py-2 px-3 text-dunkelblau-60">
							<ProfilePageSkeleton count={3} />
						</li>
					</ul>
				) : (
					<>
						<ul className="mb-5">
							{(showAllDocuments
								? sortedBaseKnowledgeDocuments
								: sortedBaseKnowledgeDocuments.slice(0, 5)
							).map((doc) => {
								return (
									<li key={doc.id}>
										<a
											href={doc.previewUrl}
											target="_blank"
											rel="noopener noreferrer"
											className="flex gap-1 items-center py-2 px-3 border-b-[0.5px] border-hellblau-60 hover:bg-hellblau-30 focus-visible:outline-default rounded-3px group"
										>
											<div className="flex gap-1 items-center">
												<DocumentIcon
													variant="lightestBlue"
													className="size-5"
												/>
												<span className="group-hover:underline underline-offset-2 group-focus:underline">
													{doc.file_name}
												</span>
											</div>
										</a>
									</li>
								);
							})}
						</ul>

						{/* Show all button */}
						{sortedBaseKnowledgeDocuments.length > 5 && !showAllDocuments && (
							<button
								className="group flex items-center text-sm leading-5 font-normal hover:text-dunkelblau-80 justify-self-center focus-visible:outline-default rounded-3px"
								onClick={() => setShowAllDocuments(true)}
								aria-label={Content["profile.baseKnowledge.viewAll.ariaLabel"]}
							>
								{Content["profile.baseKnowledge.viewAll.label.start"]}
								{sortedBaseKnowledgeDocuments.length}
								{Content["profile.baseKnowledge.viewAll.label.end"]}

								<ChevronIcon
									color="dunkelblau-200"
									direction="down"
									classname="block group-hover:hidden"
								/>
								<ChevronIcon
									color="dunkelblau-80"
									direction="down"
									classname="hidden group-hover:block"
								/>
							</button>
						)}
						{/* Show less button */}
						{showAllDocuments && (
							<button
								className="group flex items-center text-sm leading-5 font-normal hover:text-dunkelblau-80 justify-self-center focus-visible:outline-default rounded-3px"
								onClick={() => setShowAllDocuments(false)}
								aria-label={
									Content["profile.baseKnowledge.collapseList.ariaLabel"]
								}
							>
								{Content["profile.baseKnowledge.collapseList.label"]}

								<ChevronIcon
									color="dunkelblau-200"
									direction="up"
									classname="block group-hover:hidden"
								/>

								<ChevronIcon
									color="dunkelblau-80"
									direction="up"
									classname="hidden group-hover:block"
								/>
							</button>
						)}
					</>
				)}
			</div>
		</section>
	);
};
