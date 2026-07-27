UPDATE storage.buckets
SET
	allowed_mime_types = ARRAY[
		'application/pdf',
		'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
		'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/csv'
	]
;
