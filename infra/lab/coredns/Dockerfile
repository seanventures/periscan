ARG LAB_PROFILE=exposed
FROM coredns/coredns:1.11.3
ARG LAB_PROFILE
# coredns image is FROM-scratch-ish; use alpine intermediary
FROM alpine:3.20
ARG LAB_PROFILE
RUN apk add --no-cache ca-certificates
COPY --from=0 /coredns /coredns
COPY Corefile /etc/coredns/Corefile
COPY ${LAB_PROFILE}/db.lab.range.test /etc/coredns/zones/db.lab.range.test
EXPOSE 53/udp 53/tcp
ENTRYPOINT ["/coredns"]
CMD ["-conf", "/etc/coredns/Corefile"]
