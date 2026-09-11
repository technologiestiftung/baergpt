FROM --platform=linux/amd64 timberio/vector:0.57.0-debian

COPY vector.yaml /etc/vector/vector.yaml

EXPOSE 8080

# Vector does not substitute env vars into its config unless this flag is set: an
# endpoint written as ${SOME_URL} would stay that literal text instead of becoming the
# value. Baked in here rather than set as an app env var so a deploy cannot omit it.
CMD ["--config", "/etc/vector/vector.yaml", "--dangerously-allow-env-var-interpolation"]
