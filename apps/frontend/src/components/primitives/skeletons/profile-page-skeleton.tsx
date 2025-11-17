import React from "react";

interface ProfilePageSkeletonProps {
	count?: number;
	className?: string;
}

const ProfilePageSkeleton: React.FC<ProfilePageSkeletonProps> = ({
	count = 1,
	className = "",
}) => {
	return (
		<div className="flex flex-col gap-2 mt-4 w-full">
			{Array.from({ length: count }).map((_, index) => (
				<div
					key={index}
					className={`relative rounded-[3px] before:rounded-[3px] overflow-hidden 
						before:bg-[length:200%_100%] 
						before:animate-gradient-move 
						before:absolute before:inset-0 before:rounded-inherit 
						before:bg-[linear-gradient(90deg,_rgb(254,254,254)_0%,_rgb(213,230,245)_48%,_rgb(213,230,245)_50%,_rgb(254,254,254)_100%)] 
						w-full h-5`}
				>
					<div className={`bg-hellblau-30 ${className}`} />
				</div>
			))}
		</div>
	);
};

export default ProfilePageSkeleton;
