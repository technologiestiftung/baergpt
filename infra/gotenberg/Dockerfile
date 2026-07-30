# Pinned wrapper over upstream Gotenberg (document → PDF). Build for linux/amd64.
# Inherently large (~1 GB+): bundles Chromium + LibreOffice, no slim variant.
FROM gotenberg/gotenberg:8.34.0

# Make the image's built-in non-root user (uid 1001) explicit.
USER gotenberg

# Enforce Basic Auth on all API routes (credentials via
# GOTENBERG_API_BASIC_AUTH_USERNAME/PASSWORD env vars set at deploy time).
CMD ["gotenberg", "--api-enable-basic-auth"]
