import {
	useEffect,
	useState,
	type AnchorHTMLAttributes,
	type ImgHTMLAttributes,
	type MouseEvent,
	type ReactNode,
} from "react";
import { config } from "../../../config.ts";
import { useAuthStore } from "../../../store/auth-store.ts";
import { useErrorStore } from "../../../store/error-store.ts";

const SANDBOX_OUTPUT_PATH = /\/workspace\/output\/(.+)$/;

function getSandboxPath(url: string | undefined) {
	if (!config.featureFlagCodeSandboxAllowed || !url) {
		return null;
	}
	const match = decodeURIComponent(url).match(SANDBOX_OUTPUT_PATH);
	return match ? match[1] : null;
}

async function fetchSandboxFile(chatId: number, path: string) {
	const { session } = useAuthStore.getState();
	const response = await fetch(
		`${config.apiUrl}/sandbox/files/${chatId}?path=${encodeURIComponent(path)}`,
		{ headers: { Authorization: `Bearer ${session?.access_token}` } },
	);
	if (!response.ok) {
		throw new Error("sandbox_file_unavailable");
	}
	return response.blob();
}

/** Wraps a markdown link renderer so links to sandbox result files download them. */
export function createSandboxFileLink(
	chatId: number,
	FallbackLink: (props: AnchorHTMLAttributes<HTMLAnchorElement>) => ReactNode,
) {
	return function SandboxFileLink(
		props: AnchorHTMLAttributes<HTMLAnchorElement>,
	) {
		const path = getSandboxPath(props.href);
		if (!path) {
			return <FallbackLink {...props} />;
		}

		const download = async (event: MouseEvent<HTMLAnchorElement>) => {
			event.preventDefault();
			try {
				const blob = await fetchSandboxFile(chatId, path);
				const objectUrl = URL.createObjectURL(blob);
				const link = document.createElement("a");
				link.href = objectUrl;
				link.download = path.split("/").pop() ?? "download";
				link.click();
				URL.revokeObjectURL(objectUrl);
			} catch (error) {
				useErrorStore.getState().handleError(error);
			}
		};

		return (
			<a href={props.href} onClick={download}>
				{props.children}
			</a>
		);
	};
}

/**
 * Renders images from the chat's sandbox. Every other image URL stays hidden:
 * a remote image in a model answer can leak chat content through its query string.
 */
export function createSandboxImage(chatId: number) {
	return function SandboxImage({
		src,
		alt,
	}: ImgHTMLAttributes<HTMLImageElement>) {
		const path = getSandboxPath(src);
		const [objectUrl, setObjectUrl] = useState<string | null>(null);

		useEffect(() => {
			if (!path) {
				return undefined;
			}

			let createdUrl: string | null = null;
			let isCancelled = false;
			fetchSandboxFile(chatId, path)
				.then((blob) => {
					if (isCancelled) {
						return;
					}
					createdUrl = URL.createObjectURL(blob);
					setObjectUrl(createdUrl);
				})
				.catch(() => setObjectUrl(null));

			return () => {
				isCancelled = true;
				if (createdUrl) {
					URL.revokeObjectURL(createdUrl);
				}
			};
		}, [path]);

		if (!objectUrl) {
			return null;
		}

		return <img src={objectUrl} alt={alt ?? ""} className="my-2 max-w-full" />;
	};
}
