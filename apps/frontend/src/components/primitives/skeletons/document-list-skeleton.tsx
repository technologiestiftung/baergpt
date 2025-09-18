import React from "react";

interface DocumentListSkeletonProps {
	count?: number;
	className?: string;
}

const DocumentListSkeleton: React.FC<DocumentListSkeletonProps> = ({
	count = 1,
	className = "",
}) => {
	return (
		<div className="flex flex-col gap-5 mt-4">
			{Array.from({ length: count }).map((_, index) => (
				<div className="flex gap-4 items-center" key={index}>
					<div className="w-5 h-5 rounded-[3px] bg-white" />
					<div
						className={`relative rounded-[3px] before:rounded-[3px] overflow-hidden 
						before:bg-[length:200%_100%] 
						before:animate-gradient-move 
						before:absolute before:inset-0 before:rounded-inherit 
						before:bg-[linear-gradient(90deg,_rgb(254,254,254)_0%,_transparent_48%,_transparent_50%,_rgb(254,254,254)_100%)] 
						w-full h-5`}
					>
						<div className={`bg-white ${className}`} />
					</div>
				</div>
			))}
		</div>
	);
};

export default DocumentListSkeleton;
