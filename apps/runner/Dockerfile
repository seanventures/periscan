# syntax=docker/dockerfile:1

FROM golang:1.22-alpine AS build

WORKDIR /src
COPY go.mod ./
RUN go mod download
COPY main.go ./
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/periscan-runner .

FROM alpine:3.20

RUN addgroup -S -g 65532 periscan \
  && adduser -S -D -H -u 65532 -G periscan periscan \
  && apk add --no-cache ca-certificates tzdata

COPY --from=build /out/periscan-runner /usr/local/bin/periscan-runner

USER 65532:65532

ENV PERISCAN_CONTROL_PLANE_URL="https://api.periscan.cloud" \
  PERISCAN_RUNNER_KILL_SWITCH="false"

LABEL org.opencontainers.image.title="Periscan Internal Runner" \
  org.opencontainers.image.description="Outbound-only Periscan internal validation runner" \
  org.opencontainers.image.source="https://github.com/seanheiney/periscan"

ENTRYPOINT ["/usr/local/bin/periscan-runner"]
CMD ["poll"]
