import { readFileSync } from "node:fs";
import { supabase as supabaseAdminClient } from "../../supabase";
import { createClient } from "@supabase/supabase-js";
import {
	chunk_index,
	chunk_jina_embedding,
	content,
	created_at,
	file_checksum,
	file_size,
	folder_id,
	num_pages,
	page,
	processing_finished_at,
	short_summary,
	summary,
	summary_jina_embedding,
	tags,
} from "./constants";
import { expect } from "vitest";

export async function mockDocumentUpload({
	userId,
	accessGroupId,
	fileName,
	filePath,
	sourceType,
	bucketName,
	userEmail,
	userPassword,
}: {
	userId: string;
	accessGroupId: string | null;
	fileName: string;
	filePath: string;
	sourceType: "public_document" | "personal_document";
	bucketName: "documents" | "public_documents";
	userEmail?: string;
	userPassword?: string;
}) {
	const source_url = `${userId}/${fileName}`;
	const file = readFileSync(filePath);

	// For personal documents, upload as the user (not admin) so owner_id is set correctly
	// For public documents, use admin client
	let uploadError;

	if (bucketName === "documents" && userEmail && userPassword) {
		// Create authenticated client and upload as user
		const userClient = createClient(
			process.env.SUPABASE_URL as string,
			process.env.SUPABASE_ANON_KEY as string,
		);

		await userClient.auth.signInWithPassword({
			email: userEmail,
			password: userPassword,
		});

		const { error } = await userClient.storage
			.from(bucketName)
			.upload(
				source_url,
				new File([file], fileName, { type: "application/pdf" }),
				{ upsert: true },
			);

		uploadError = error;
		await userClient.auth.signOut();
	} else {
		// Public documents or fallback to admin client
		const { error } = await supabaseAdminClient.storage
			.from(bucketName)
			.upload(
				source_url,
				new File([file], fileName, { type: "application/pdf" }),
				{ upsert: true },
			);
		uploadError = error;
	}

	expect(uploadError).toBeNull();

	const { data: documentData, error: documentsInsertError } =
		await supabaseAdminClient
			.from("documents")
			.insert({
				owned_by_user_id: accessGroupId ? null : userId,
				access_group_id: accessGroupId,
				uploaded_by_user_id: accessGroupId ? userId : null,
				source_type: sourceType,
				source_url,
				file_name: fileName,
				file_checksum,
				file_size,
				num_pages,
				folder_id,
				created_at,
				processing_finished_at,
			})
			.select()
			.single();

	expect(documentsInsertError).toBeNull();

	const { error: documentSummariesInsertError } = await supabaseAdminClient
		.from("document_summaries")
		.insert({
			owned_by_user_id: accessGroupId ? null : userId,
			access_group_id: accessGroupId,
			document_id: documentData.id,
			folder_id,
			summary,
			tags,
			short_summary,
			summary_jina_embedding,
		});

	expect(documentSummariesInsertError).toBeNull();

	const { data: chunkData, error: documentChunksInsertError } =
		await supabaseAdminClient
			.from("document_chunks")
			.insert({
				owned_by_user_id: accessGroupId ? null : userId,
				access_group_id: accessGroupId,
				document_id: documentData.id,
				folder_id,
				content,
				page,
				chunk_index,
				chunk_jina_embedding,
			})
			.select()
			.single();

	expect(documentChunksInsertError).toBeNull();

	return chunkData.id;
}

export async function cleanupDocuments(userId: string) {
	const { error: deleteDocumentsError } = await supabaseAdminClient
		.from("documents")
		.delete()
		.eq("owned_by_user_id", userId);
	expect(deleteDocumentsError).toBeNull();

	const { error: deleteFoldersError } = await supabaseAdminClient
		.from("document_folders")
		.delete()
		.eq("user_id", userId);
	expect(deleteFoldersError).toBeNull();

	const { error: deleteDocumentChunksError } = await supabaseAdminClient
		.from("document_chunks")
		.delete()
		.eq("owned_by_user_id", userId);
	expect(deleteDocumentChunksError).toBeNull();

	const { error: deleteDocumentSummariesError } = await supabaseAdminClient
		.from("document_summaries")
		.delete()
		.eq("owned_by_user_id", userId);
	expect(deleteDocumentSummariesError).toBeNull();

	const { data: personalDocumentsData, error: personalDocumentsError } =
		await supabaseAdminClient.storage.from("documents").list(`${userId}`);

	expect(personalDocumentsError).toBeNull();

	const personalDocumentsToRemove = personalDocumentsData.map(
		(file) => `${userId}/${file.name}`,
	);

	if (personalDocumentsToRemove.length > 0) {
		const { error: deletePersonalDocumentsError } =
			await supabaseAdminClient.storage
				.from("documents")
				.remove(personalDocumentsToRemove);
		expect(deletePersonalDocumentsError).toBeNull();
	}

	const { data: publicDocumentsData, error: publicDocumentsError } =
		await supabaseAdminClient.storage
			.from("public_documents")
			.list(`${userId}`);

	expect(publicDocumentsError).toBeNull();

	const publicDocumentsToRemove = publicDocumentsData.map(
		(file) => `${userId}/${file.name}`,
	);

	if (publicDocumentsToRemove.length > 0) {
		const { error: deletePublicDocumentsError } =
			await supabaseAdminClient.storage
				.from("public_documents")
				.remove(publicDocumentsToRemove);

		expect(deletePublicDocumentsError).toBeNull();
	}
}
