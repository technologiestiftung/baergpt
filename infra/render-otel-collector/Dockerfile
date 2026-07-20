FROM --platform=linux/amd64 otel/opentelemetry-collector-contrib:0.120.0

COPY otel-config.yml /etc/otelcol-contrib/config.yml

EXPOSE ${PORT}

CMD ["--config", "/etc/otelcol-contrib/config.yml"]
