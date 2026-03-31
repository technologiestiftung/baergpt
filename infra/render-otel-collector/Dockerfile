FROM --platform=linux/amd64 otel/opentelemetry-collector-contrib:0.120.0

COPY otel-config.yml /etc/otelcol-contrib/config.yml

# Render assigns PORT dynamically (usually 10000).
# The OTLP receiver binds to it.
# Syslog listens on 5514 (private network only).
EXPOSE ${PORT} 5514

CMD ["--config", "/etc/otelcol-contrib/config.yml"]
